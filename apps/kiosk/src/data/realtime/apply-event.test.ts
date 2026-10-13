import type { ClientSession, Command, RoomState, ServerEvent } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { createInlineErrorStore, MESSAGE_FAILED, MESSAGE_TIMED_OUT } from "@/data/commands/inline-errors";
import { createPendingStore } from "@/data/commands/pending-store";
import { createIrCaptureStore } from "@/data/ir/capture-store";
import { roomState } from "@/data/test/room-state";
import { applyEvent, type CachePort } from "./apply-event";

const CMD_ID = "00000000-0000-4000-8000-000000000001";
const session: ClientSession = {
  public_id: "me", client_type: "remote", label: "laptop", access: "control",
  unlocked_at: null, last_activity: null, expires_at: null,
};

function fakeCache(initial?: RoomState) {
  let state = initial;
  let currentSession: ClientSession | undefined = session;
  const cache: CachePort & { invalidated: string[][]; allInvalidated: number } = {
    invalidated: [],
    allInvalidated: 0,
    getState: () => state,
    setState: (next) => { state = next; },
    getSession: () => currentSession,
    setSession: (next) => { currentSession = next; },
    invalidateAllExceptState() { cache.allInvalidated += 1; },
    invalidate(keys) { cache.invalidated.push(...keys.map((key) => [...key])); },
  };
  return cache;
}

function setup(initial?: RoomState) {
  const cache = fakeCache(initial);
  const pending = createPendingStore();
  const inlineErrors = createInlineErrorStore();
  const toast = vi.fn();
  const syncServerTime = vi.fn();
  const irCapture = createIrCaptureStore();
  const deps = { cache, pending, inlineErrors, irCapture, toast, syncServerTime };
  return { ...deps, apply: (event: ServerEvent) => applyEvent(event, deps) };
}

const command = (status: Command["status"], error: string | null = null): Command => ({
  id: "cmd-1", client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true },
  issued_by: { public_id: "me", label: "laptop" }, status, error, at: "2026-10-05T10:42:01Z",
});

describe("applyEvent", () => {
  it("snapshot replaces state, syncs the clock, clears pending and invalidates other queries", () => {
    const t = setup(roomState({ rev: 50 }));
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    const next = roomState({ rev: 3, server_time: "2026-10-05T11:00:00Z" });
    t.apply({ type: "snapshot", state: next });
    expect(t.cache.getState()).toBe(next); // lower rev accepted: snapshots always win
    expect(t.syncServerTime).toHaveBeenCalledWith("2026-10-05T11:00:00Z");
    expect(t.pending.entries.get().size).toBe(0);
    expect(t.cache.allInvalidated).toBe(1);
  });

  it("state with a higher rev replaces the cache", () => {
    const t = setup(roomState({ rev: 1 }));
    const next = roomState({ rev: 2 });
    t.apply({ type: "state", state: next });
    expect(t.cache.getState()).toBe(next);
    expect(t.syncServerTime).toHaveBeenCalledWith(next.server_time);
  });

  it("drops a state with a stale or equal rev", () => {
    const current = roomState({ rev: 5 });
    const t = setup(current);
    t.apply({ type: "state", state: roomState({ rev: 4 }) });
    t.apply({ type: "state", state: roomState({ rev: 5 }) });
    expect(t.cache.getState()).toBe(current);
    expect(t.syncServerTime).not.toHaveBeenCalled();
  });

  it("drops a state that arrives before any snapshot", () => {
    const t = setup(undefined);
    t.apply({ type: "state", state: roomState({ rev: 9 }) });
    expect(t.cache.getState()).toBeUndefined();
  });

  it("command sent keeps the overlay", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("sent") });
    expect(t.pending.entries.get().get("lights.rear")?.status).toBe("sent");
  });

  it.each(["confirmed", "assumed"] as const)("command %s clears the overlay without an error", (status) => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command(status) });
    expect(t.pending.isPending("lights.rear")).toBe(false);
    expect(t.inlineErrors.errors.get().size).toBe(0);
  });

  it("command failed clears the overlay and shows the server error (H6a)", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("failed", "Switch didn't respond") });
    expect(t.pending.isPending("lights.rear")).toBe(false);
    expect(t.inlineErrors.errors.get().get("lights.rear")).toBe("Switch didn't respond");
  });

  it("command failed without an error text shows the generic message", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("failed") });
    expect(t.inlineErrors.errors.get().get("lights.rear")).toBe(MESSAGE_FAILED);
  });

  it("command timed_out shows 'No response · tap to retry' (H6b)", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("timed_out") });
    expect(t.inlineErrors.errors.get().get("lights.rear")).toBe(MESSAGE_TIMED_OUT);
  });

  it("ignores failures of other clients' commands", () => {
    const t = setup(roomState());
    t.apply({ type: "command", command: command("failed", "x") });
    expect(t.inlineErrors.errors.get().size).toBe(0);
  });

  it("activity from another client shows an attributed toast (H13)", () => {
    const t = setup(roomState());
    t.apply({ type: "activity", text: "Rear of room turned on", by: "phone", public_id: "other" });
    expect(t.toast).toHaveBeenCalledWith("Rear of room turned on · from phone");
  });

  it("activity by hand (no session) shows a toast", () => {
    const t = setup(roomState());
    t.apply({ type: "activity", text: "Front of room turned off", by: "by hand", public_id: null });
    expect(t.toast).toHaveBeenCalledWith("Front of room turned off · by hand");
  });

  it("activity from this client is not toasted", () => {
    const t = setup(roomState());
    t.apply({ type: "activity", text: "Rear of room turned on", by: "laptop", public_id: "me" });
    expect(t.toast).not.toHaveBeenCalled();
  });

  it("invalidate forwards the keys", () => {
    const t = setup(roomState());
    t.apply({ type: "invalidate", keys: [["ir", "devices"], ["schedule"]] });
    expect(t.cache.invalidated).toEqual([["ir", "devices"], ["schedule"]]);
  });

  it("session replaces the cached session", () => {
    const t = setup(roomState());
    const next: ClientSession = { ...session, access: "view" };
    t.apply({ type: "session", session: next });
    expect(t.cache.getSession()).toBe(next);
  });

  it("ping changes nothing", () => {
    const state = roomState();
    const t = setup(state);
    t.apply({ type: "ping" });
    expect(t.cache.getState()).toBe(state);
    expect(t.toast).not.toHaveBeenCalled();
    expect(t.cache.invalidated).toEqual([]);
  });

  it("ir_capture goes to the capture store only; a snapshot clears it (H21, H4)", () => {
    const state = roomState();
    const t = setup(state);
    t.apply({ type: "ir_capture", command_id: "c", status: "listening", deadline: "2026-10-05T10:42:20Z" });
    expect(t.irCapture.entries.get().get("c")).toEqual({ status: "listening", deadline: "2026-10-05T10:42:20Z" });
    expect(t.cache.getState()).toBe(state);
    t.apply({ type: "snapshot", state: roomState({ rev: 9 }) });
    expect(t.irCapture.entries.get().size).toBe(0);
  });
});
