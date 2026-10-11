import { describe, expect, it } from "vitest";
import { Command, CommandBody, CommandRequest } from "../src/domain/command.ts";
import { ClientSession } from "../src/domain/session.ts";
import { AT } from "./helpers.ts";

const CMD_ID = "3b241101-e2bb-4255-8caf-4136c566a962";

describe("CommandBody", () => {
  it.each([
    { kind: "source.select", input: "smart_board" },
    { kind: "projector.power", on: true },
    { kind: "projector.mains", on: false },
    { kind: "screen.move", to: "raise" },
    { kind: "audio.level", channel: "mic", level: 62, final: true },
    { kind: "audio.mute_all", muted: true },
    { kind: "lights.set", gang: "rear", on: true },
    { kind: "ac.power", on: false },
    { kind: "ac.step", direction: "up" },
  ])("accepts $kind", (body) => {
    expect(CommandBody.safeParse(body).success).toBe(true);
  });
  it("rejects an unknown AC step direction", () => {
    expect(CommandBody.safeParse({ kind: "ac.step", direction: "left" }).success).toBe(false);
  });
  it("rejects audio.level without final", () => {
    expect(CommandBody.safeParse({ kind: "audio.level", channel: "pc", level: 38 }).success).toBe(false);
  });
});

describe("CommandRequest / Command", () => {
  it("rejects a client_cmd_id that is not a uuid", () => {
    expect(CommandRequest.safeParse({ client_cmd_id: "abc", body: { kind: "ac.power", on: true } }).success).toBe(false);
  });
  it("accepts a scheduled command (issued_by null)", () => {
    const command = { id: "c1", client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "front", on: false },
      issued_by: null, status: "confirmed", error: null, at: AT };
    expect(Command.safeParse(command).success).toBe(true);
  });
});

describe("ClientSession", () => {
  const session = { public_id: "p_7f3a", client_type: "remote", label: "phone", access: "control",
    unlocked_at: AT, last_activity: AT, expires_at: AT };
  it("accepts a remote control session", () => {
    expect(ClientSession.safeParse(session).success).toBe(true);
  });
  it("rejects an unknown access level", () => {
    expect(ClientSession.safeParse({ ...session, access: "admin" }).success).toBe(false);
  });
});
