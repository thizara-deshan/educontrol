import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { applyCommandToState, describeCommand, MOCK_PLUG_WATTS, statusFor, stepSetpoint } from "./mock-rules";

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
    expect(stepSetpoint([18, 20, 24], null, "down")).toBe(18);
    expect(stepSetpoint([18, 20, 24], null, "up")).toBe(24);
    const next = applyCommandToState(roomState(), { kind: "ac.step", direction: "up" }, ctx);
    expect(next.environment.ac.setpoint_c.value).toBe(25);
  });

  it("projector.power only records the IR and waits for draw (R2)", () => {
    const next = applyCommandToState(roomState(), { kind: "projector.power", on: false }, ctx);
    expect(next.display.projector.state.value).toBe("running");
    expect(next.display.projector.feedback).toEqual({ last_ir: "power_off", sent_at: ctx.at, phase: "waiting_for_draw" });
    expect(statusFor({ kind: "projector.power", on: false })).toBe("assumed");
  });

  it("source.select is exclusive and confirmed (R10)", () => {
    const next = applyCommandToState(roomState(), { kind: "source.select", input: "smart_board" }, ctx);
    expect(next.display.source).toMatchObject({ value: "smart_board", confidence: "confirmed" });
  });

  it("screen.move starts moving (FakeRoom finishes the travel)", () => {
    const next = applyCommandToState(roomState(), { kind: "screen.move", to: "raise" }, ctx);
    expect(next.display.screen.value).toBe("moving");
  });

  it("mute zeroes and saves the levels; unmute restores them (R9)", () => {
    const muted = applyCommandToState(roomState(), { kind: "audio.mute_all", muted: true }, ctx);
    expect(muted.audio.channels.mic.value).toBe(0);
    expect(muted.audio.channels.pc.value).toBe(0);
    expect(muted.audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    const again = applyCommandToState(muted, { kind: "audio.mute_all", muted: true }, ctx);
    expect(again.audio.saved_levels).toEqual({ mic: 62, pc: 38 }); // a second mute keeps the saved levels
    const unmuted = applyCommandToState(muted, { kind: "audio.mute_all", muted: false }, ctx);
    expect(unmuted.audio.channels.mic.value).toBe(62);
    expect(unmuted.audio.channels.pc.value).toBe(38);
    expect(unmuted.audio.saved_levels).toEqual({ mic: null, pc: null });
  });

  it("ac.power on after a restart sends the default setpoint; ac.step is ignored while off (Q5)", () => {
    const base = roomState();
    const unknown = { value: null, confidence: "unknown" as const, source: "none" as const, updated_at: null, stale: false, changed_by: null };
    const restarted = { ...base, environment: { ...base.environment, ac: { ...base.environment.ac, power: unknown, setpoint_c: unknown } } };
    const on = applyCommandToState(restarted, { kind: "ac.power", on: true }, ctx);
    expect(on.environment.ac.power).toMatchObject({ value: "on", confidence: "assumed" });
    expect(on.environment.ac.setpoint_c).toMatchObject({ value: 24, confidence: "assumed" });
    const off = applyCommandToState(on, { kind: "ac.power", on: false }, ctx);
    expect(applyCommandToState(off, { kind: "ac.step", direction: "up" }, ctx).environment.ac.setpoint_c.value).toBe(24);
  });

  it("plug.set switches the relay and the mock load (D-34)", () => {
    const off = applyCommandToState(roomState(), { kind: "plug.set", on: false }, ctx);
    expect(off.plug.on).toMatchObject({ value: false, confidence: "confirmed" });
    expect(off.plug.reading.value).toMatchObject({ watts: 0, amps: 0 });
    const on = applyCommandToState(off, { kind: "plug.set", on: true }, ctx);
    expect(on.plug.reading.value).toMatchObject({ watts: MOCK_PLUG_WATTS, volts: 231.2 });
    expect(describeCommand({ kind: "plug.set", on: true })).toBe("Smart plug turned on");
  });

  it("describes commands for activity toasts", () => {
    expect(describeCommand({ kind: "lights.set", gang: "rear", on: true })).toBe("Rear of room turned on");
  });
});
