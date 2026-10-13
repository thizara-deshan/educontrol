import { HwAudioLevelRequest, HwLightsSetRequest } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { hwEvent } from "../helpers.ts";
import { LAPTOP, PHONE, room } from "./setup.ts";

const lightsEcho = (method: string, body: unknown) =>
  method === "lightsSet" ? hwEvent("lights.state", HwLightsSetRequest.parse(body)) : null;

describe("correlation: a hw report confirms the in-flight command (§6.5)", () => {
  it("confirmed: the switch reports the new state before the ack", async () => {
    const r = room();
    r.echo(lightsEcho);
    const command = r.send({ kind: "lights.set", gang: "rear", on: true });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "confirmed"]);
    expect(r.store.get().environment.lights.rear).toMatchObject({ value: true, confidence: "confirmed", changed_by: "phone" });
    expect(r.activities()).toEqual(["Rear of room turned on · phone"]);
    expect(r.logs.filter((l) => l.type === "command")).toEqual([
      expect.objectContaining({ actor: "phone", public_id: "pub-phone", subject: "lights.set", result: "confirmed" }),
    ]);
    // the state carrying the new value reaches clients before `confirmed` clears their overlay
    const stateIndex = r.events.findIndex((e) => e.type === "state" && e.state.environment.lights.rear.value === true);
    const confirmedIndex = r.events.findIndex((e) => e.type === "command" && e.command.status === "confirmed");
    expect(stateIndex).toBeLessThan(confirmedIndex);
  });

  it("confirmed: the report arrives after the ack (sent first)", async () => {
    const r = room();
    const command = r.send({ kind: "source.select", input: "smart_board" });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent"]);
    r.report(hwEvent("hdmi.state", { input: "smart_board" }));
    expect(r.statuses(command)).toEqual(["pending", "sent", "confirmed"]);
    expect(r.store.get().display.source).toMatchObject({ value: "smart_board", changed_by: "phone" });
  });

  it("last write wins: the newest command is the one the report confirms", async () => {
    const r = room();
    r.send({ kind: "lights.set", gang: "rear", on: true }, PHONE);
    const second = r.send({ kind: "lights.set", gang: "rear", on: false }, LAPTOP);
    r.report(hwEvent("lights.state", { gang: "rear", on: false }));
    await expect.poll(() => r.statuses(second).at(-1)).toBe("confirmed");
    expect(r.store.get().environment.lights.rear.changed_by).toBe("laptop");
    expect(r.activities()).toEqual(["Rear of room turned off · laptop"]);
  });

  it("slider drags (final:false) are not logged and raise no toast", async () => {
    const r = room();
    r.echo((method, body) => (method === "audioLevel" ? hwEvent("audio.state", { ...HwAudioLevelRequest.parse(body), muted: false }) : null));
    const drag = r.send({ kind: "audio.level", channel: "mic", level: 40, final: false });
    await expect.poll(() => r.statuses(drag).at(-1)).toBe("confirmed");
    expect(r.logs.filter((l) => l.type === "command")).toEqual([]);
    expect(r.activities()).toEqual([]);
  });

  it("R9: mute all needs both channels muted; unmute unmutes then restores the saved levels", async () => {
    const r = room();
    const mute = r.send({ kind: "audio.mute_all", muted: true });
    expect(r.store.get().audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    await expect.poll(() => r.statuses(mute).at(-1)).toBe("sent");
    r.report(hwEvent("audio.state", { channel: "mic", level: 62, muted: true }));
    expect(r.statuses(mute).at(-1)).toBe("sent"); // one channel is not "all"
    r.report(hwEvent("audio.state", { channel: "pc", level: 38, muted: true }));
    expect(r.statuses(mute).at(-1)).toBe("confirmed");
    r.hw.calls.length = 0;
    r.send({ kind: "audio.mute_all", muted: false });
    await expect.poll(() => r.hw.calls.length).toBe(4);
    expect(r.hw.calls.map((c) => [c.method, c.body])).toEqual([
      ["audioMute", { channel: "mic", muted: false }], ["audioMute", { channel: "pc", muted: false }],
      ["audioLevel", { channel: "mic", level: 62 }], ["audioLevel", { channel: "pc", level: 38 }],
    ]);
  });
});
