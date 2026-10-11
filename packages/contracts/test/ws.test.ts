import { describe, expect, it } from "vitest";
import { ClientMessage, ServerEvent } from "../src/ws.ts";
import { AT, readFixture } from "./helpers.ts";

describe("ServerEvent", () => {
  it("accepts a snapshot of room-normal", () => {
    const result = ServerEvent.safeParse({ type: "snapshot", state: readFixture("state/room-normal.json") });
    expect(result.error?.issues ?? []).toEqual([]);
  });
  it("accepts activity, ir_capture, invalidate and ping", () => {
    expect(ServerEvent.safeParse({ type: "activity", text: "Rear of room turned on · from phone", by: "phone", public_id: "p1" }).success).toBe(true);
    expect(ServerEvent.safeParse({ type: "ir_capture", command_id: "cmd_ac_24", status: "listening", deadline: AT }).success).toBe(true);
    expect(ServerEvent.safeParse({ type: "invalidate", keys: [["ir", "devices"]] }).success).toBe(true);
    expect(ServerEvent.safeParse({ type: "ping" }).success).toBe(true);
  });
  it("rejects an unknown event type and an empty query key", () => {
    expect(ServerEvent.safeParse({ type: "patch", ops: [] }).success).toBe(false);
    expect(ServerEvent.safeParse({ type: "invalidate", keys: [[]] }).success).toBe(false);
  });
});

describe("ClientMessage", () => {
  it("accepts hello with a label and pong", () => {
    expect(ClientMessage.safeParse({ type: "hello", label: "tablet" }).success).toBe(true);
    expect(ClientMessage.safeParse({ type: "pong" }).success).toBe(true);
  });
  it("rejects commands over WS (D-03)", () => {
    expect(ClientMessage.safeParse({ type: "command", body: { kind: "ac.power", on: true } }).success).toBe(false);
  });
});
