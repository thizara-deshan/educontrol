import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { applyCommandToState, describeCommand, statusFor, stepSetpoint } from "./mock-rules";

const ctx = { at: "2026-10-05T10:43:00Z", by: "phone" } as const;

describe("mock rules", () => {
  it("lights.set sets the gang confirmed with attribution", () => {
    const next = applyCommandToState(roomState(), { kind: "lights.set", gang: "rear", on: true }, ctx);
    expect(next.environment.lights.rear).toMatchObject({
      value: true, confidence: "confirmed", updated_at: ctx.at, changed_by: "phone", stale: false,
    });
    expect(next.environment.lights.front.value).toBe(true); // untouched
  });

  it("audio.level sets one channel", () => {
    const next = applyCommandToState(roomState(), { kind: "audio.level", channel: "mic", level: 40, final: true }, ctx);
    expect(next.audio.channels.mic.value).toBe(40);
    expect(next.audio.channels.pc.value).toBe(38);
  });

  it("audio.mute_all saves and clears the levels (R9)", () => {
    const muted = applyCommandToState(roomState(), { kind: "audio.mute_all", muted: true }, ctx);
    expect(muted.audio.muted_all.value).toBe(true);
    expect(muted.audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    const unmuted = applyCommandToState(muted, { kind: "audio.mute_all", muted: false }, ctx);
    expect(unmuted.audio.saved_levels).toEqual({ mic: null, pc: null });
  });

  it("ac.power is assumed from ir (R3)", () => {
    const next = applyCommandToState(roomState(), { kind: "ac.power", on: false }, ctx);
    expect(next.environment.ac.power).toMatchObject({ value: "off", confidence: "assumed", source: "ir" });
    expect(statusFor({ kind: "ac.power", on: false })).toBe("assumed");
    expect(statusFor({ kind: "lights.set", gang: "front", on: true })).toBe("confirmed");
  });

  it("ac.step moves to the adjacent captured setpoint (R4)", () => {
    expect(stepSetpoint([18, 20, 24], 24, "down")).toBe(20);
    expect(stepSetpoint([18, 20, 24], 20, "up")).toBe(24);
    expect(stepSetpoint([18, 20, 24], 24, "up")).toBe(24);
    expect(stepSetpoint([18, 20, 24], null, "up")).toBe(18);
    const next = applyCommandToState(roomState(), { kind: "ac.step", direction: "up" }, ctx);
    expect(next.environment.ac.setpoint_c.value).toBe(25);
  });

  it("projector.power sets the state and the IR feedback", () => {
    const next = applyCommandToState(roomState(), { kind: "projector.power", on: false }, ctx);
    expect(next.display.projector.state.value).toBe("standby");
    expect(next.display.projector.feedback.last_ir).toBe("power_off");
  });

  it("source.select and screen.move set their values", () => {
    const a = applyCommandToState(roomState(), { kind: "source.select", input: "smart_board" }, ctx);
    expect(a.display.source.value).toBe("smart_board");
    const b = applyCommandToState(roomState(), { kind: "screen.move", to: "raise" }, ctx);
    expect(b.display.screen.value).toBe("raised");
  });

  it("describes commands for activity toasts", () => {
    expect(describeCommand({ kind: "lights.set", gang: "rear", on: true })).toBe("Rear of room turned on");
  });
});
