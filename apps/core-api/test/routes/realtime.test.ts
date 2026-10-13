import { describe, expect, it } from "vitest";
import { FAKE_PROJECTOR_CODES } from "../../src/db/seed.ts";
import { hwEvent } from "../helpers.ts";
import { call, cookieOf, openSocket, sessionAt, startApp } from "./app-helpers.ts";

describe("WS hub (§6.6)", () => {
  it("sends the full snapshot on connect", async () => {
    const { app } = await startApp();
    const socket = await openSocket(app);
    const snapshot = await socket.next("snapshot");
    expect(snapshot.state).toMatchObject({ room: { id: "R-101" }, connection: { hw: "up" } });
    expect(snapshot.state.rev).toBe(app.room.store.get().rev);
    socket.ws.terminate();
    await app.close();
  });

  it("fans every state change out to N sockets with a monotonic rev", async () => {
    const { app } = await startApp();
    const sockets = await Promise.all([openSocket(app), openSocket(app), openSocket(app)]);
    await Promise.all(sockets.map((s) => s.next("snapshot")));
    app.room.ingest.handle(hwEvent("lights.state", { gang: "rear", on: true }));
    app.room.ingest.handle(hwEvent("hdmi.state", { input: "smart_board" }));
    for (const socket of sockets) {
      const state = await socket.next("state");
      expect(state.state.environment.lights.rear.value).toBe(true);
      const activity = await socket.next("activity");
      expect(activity).toEqual({ type: "activity", text: "Rear of room turned on", by: "by hand", public_id: null });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
    for (const socket of sockets) {
      const revs = socket.frames.flatMap((f) => (f.type === "snapshot" || f.type === "state" ? [f.state.rev] : []));
      expect(revs.length).toBeGreaterThanOrEqual(2);
      expect(revs).toEqual([...revs].sort((a, b) => a - b));
      expect(new Set(revs).size).toBe(revs.length);
    }
    for (const socket of sockets) socket.ws.terminate();
    await app.close();
  });

  it("`session` goes only to that session's sockets (login, lock, expiry)", async () => {
    const { app, clock } = await startApp();
    const cookie = await sessionAt(app, "view");
    const mine = await openSocket(app, { cookie });
    const other = await openSocket(app);
    await call(app, "POST", "/api/session/login", { cookie, payload: { level: "control", pin: "1234", label: "phone" } });
    expect((await mine.next("session")).session).toMatchObject({ access: "control", label: "phone" });
    clock.advance(2 * 60 * 60_000);
    app.room.sessions.sweep();
    await expect.poll(() => mine.frames.filter((f) => f.type === "session").at(-1)).toMatchObject({ session: { access: "view" } });
    expect(other.frames.some((f) => f.type === "session")).toBe(false);
    mine.ws.terminate();
    other.ws.terminate();
    await app.close();
  });

  it("never carries IR codes or PIN data", async () => {
    const { app } = await startApp({ SEED_FAKE_IR_CODES: "true" });
    const socket = await openSocket(app);
    const text = JSON.stringify(await socket.next("snapshot"));
    expect(text).not.toContain(FAKE_PROJECTOR_CODES["projector.power_on"]);
    expect(text).not.toContain("scrypt$");
    socket.ws.terminate();
    await app.close();
  });

  it("refuses a foreign Origin at the upgrade", async () => {
    const { app } = await startApp();
    await expect(openSocket(app, { origin: "http://evil.example" })).rejects.toThrow("Unexpected server response: 403");
    await app.close();
  });

  it("hello names the client (S3b list, attribution); junk frames are dropped; > 4 KB closes", async () => {
    const { app } = await startApp();
    const cookie = cookieOf(await call(app, "GET", "/api/session"));
    const socket = await openSocket(app, { cookie });
    await socket.next("snapshot");
    socket.ws.send(JSON.stringify({ type: "hello", label: "tablet" }));
    socket.ws.send("not json");
    socket.ws.send(JSON.stringify({ type: "command", body: {} }));
    await expect.poll(() => app.room.hub.clients()).toEqual([{ public_id: expect.any(String), label: "tablet", client_type: "remote", access: "view" }]);
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ label: "tablet" });
    const closed = new Promise<number>((resolve) => socket.ws.on("close", (code) => resolve(code)));
    socket.ws.send("x".repeat(5000));
    expect(await closed).toBe(1009);
    await expect.poll(() => app.room.hub.size()).toBe(0);
    await app.close();
  });

  it("ping every round; a socket that misses 2 pongs is terminated", async () => {
    const { app } = await startApp();
    const socket = await openSocket(app);
    await socket.next("snapshot");
    app.room.hub.ping();
    await socket.next("ping");
    socket.ws.send(JSON.stringify({ type: "pong" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    app.room.hub.ping();
    app.room.hub.ping();
    expect(app.room.hub.size()).toBe(1); // one pong answered, so only 2 unanswered so far
    app.room.hub.ping();
    expect(app.room.hub.size()).toBe(0);
    await app.close();
  });
});
