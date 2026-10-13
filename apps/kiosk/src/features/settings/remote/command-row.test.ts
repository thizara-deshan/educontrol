import type { IrCommand } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { commandRowView, irErrorMessage, ROW_IDLE, rowReducer, type RowContext, type RowLocal } from "./command-row";

const NOW = new Date("2026-10-13T09:00:00Z");
const command = (patch: Partial<IrCommand> = {}): IrCommand => ({
  id: "c1", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
  captured: true, captured_at: "2026-10-01T09:00:00Z", test: "reacted", tested_at: null, ...patch,
});
const ctx = (patch: Partial<RowContext> = {}): RowContext => ({
  command: command(), capture: undefined, local: ROW_IDLE, deviceName: "Projector", transport: "ir_zs06",
  blasterOnline: true, writable: true, otherListening: false, now: NOW, ...patch,
});

describe("rowReducer (H21/H22 local steps)", () => {
  it("test → asking → answer → done", () => {
    let state: RowLocal = ROW_IDLE;
    state = rowReducer(state, { type: "test" });
    expect(state).toEqual({ kind: "test_sending" });
    state = rowReducer(state, { type: "test_sent" });
    expect(state).toEqual({ kind: "asking" });
    state = rowReducer(state, { type: "answer", reacted: false });
    expect(state).toEqual({ kind: "answer_sending", reacted: false });
    expect(rowReducer(state, { type: "answer_failed" })).toEqual({ kind: "asking" });
    expect(rowReducer(state, { type: "done" })).toEqual(ROW_IDLE);
  });

  it("ignores repeat taps while a request is in flight (H5)", () => {
    const sending: RowLocal = { kind: "learn_sending" };
    expect(rowReducer(sending, { type: "learn" })).toBe(sending);
    expect(rowReducer(sending, { type: "test" })).toBe(sending);
    expect(rowReducer(ROW_IDLE, { type: "answer", reacted: true })).toBe(ROW_IDLE);
    expect(rowReducer(ROW_IDLE, { type: "test_sent" })).toBe(ROW_IDLE);
  });
});

describe("commandRowView", () => {
  it("default: stored status, Test + Re-learn enabled", () => {
    const view = commandRowView(ctx());
    expect(view.status).toEqual({ text: "Tuya code · captured", tone: "muted" });
    expect(view.note).toBeNull();
    expect(view.actions).toEqual({
      kind: "default",
      test: { label: "Test", enabled: true, pending: false, highlighted: false },
      learn: { label: "Re-learn", enabled: true, pending: false },
    });
  });

  it("not captured: Test disabled, the button reads Learn (S3.E14)", () => {
    const view = commandRowView(ctx({ command: command({ captured: false, captured_at: null, test: "untested" }) }));
    expect(view.status).toEqual({ text: "Not captured", tone: "warn" });
    expect(view.actions).toMatchObject({ kind: "default", test: { enabled: false }, learn: { label: "Learn", enabled: true } });
  });

  it("learn in flight: Re-learn pulses", () => {
    expect(commandRowView(ctx({ local: { kind: "learn_sending" } })).actions).toMatchObject({ learn: { pending: true } });
  });

  it("listening: verbatim prompt, 20 s countdown, Cancel only (H21)", () => {
    const view = commandRowView(ctx({ capture: { status: "listening", deadline: "2026-10-13T09:00:18.2Z" } }));
    expect(view.status).toEqual({ text: "Listening… point the remote at the ZS06 and press the button", tone: "default" });
    expect(view.countdown).toBe("0:19");
    expect(view.actions).toEqual({ kind: "listening", cancel: { label: "Cancel", enabled: true, pending: false } });
    const mcu = commandRowView(ctx({ transport: "ir_mcu", capture: { status: "listening", deadline: null } }));
    expect(mcu.status.text).toBe("Listening… point the remote at the MCU and press the button");
    expect(mcu.countdown).toBe("0:00");
  });

  it("captured: amber untested status, 'Captured · now test it', Test highlighted (H21, H20)", () => {
    const view = commandRowView(ctx({ command: command({ test: "untested" }), capture: { status: "captured", deadline: null } }));
    expect(view.status).toEqual({ text: "Tuya code · captured · untested", tone: "warn" });
    expect(view.note).toEqual({ text: "Captured · now test it", tone: "accent" });
    expect(view.actions).toMatchObject({ test: { enabled: true, highlighted: true }, learn: { label: "Re-learn" } });
  });

  it("timeout: old status kept, 'Nothing received', Try again (H21)", () => {
    const view = commandRowView(ctx({ capture: { status: "timeout", deadline: null } }));
    expect(view.status.text).toBe("Tuya code · captured");
    expect(view.note).toEqual({ text: "Nothing received", tone: "danger" });
    expect(view.actions).toMatchObject({ learn: { label: "Try again", enabled: true } });
  });

  it("failed capture reads 'Capture failed' with Try again", () => {
    const view = commandRowView(ctx({ capture: { status: "failed", deadline: null } }));
    expect(view.note).toEqual({ text: "Capture failed", tone: "danger" });
    expect(view.actions).toMatchObject({ learn: { label: "Try again" } });
  });

  it("asking: 'Did the Projector react?' with Yes / No; the chosen answer pulses (H22)", () => {
    expect(commandRowView(ctx({ local: { kind: "asking" } }))).toMatchObject({
      note: { text: "Did the Projector react?", tone: "default" },
      actions: { kind: "asking", yes: { label: "Yes", pending: false }, no: { label: "No", pending: false } },
    });
    expect(commandRowView(ctx({ local: { kind: "answer_sending", reacted: false } })).actions).toMatchObject({
      yes: { pending: false }, no: { pending: true },
    });
  });

  it("no reaction shows red after the answer (H22)", () => {
    const view = commandRowView(ctx({ command: command({ test: "no_reaction", tested_at: "2026-10-13T08:59:59Z" }) }));
    expect(view.status).toEqual({ text: "Tuya code · no reaction", tone: "danger" });
  });

  it("blaster offline disables Test and Re-learn on ZS06 devices only (H25, R8)", () => {
    expect(commandRowView(ctx({ blasterOnline: false })).actions).toMatchObject({ test: { enabled: false }, learn: { enabled: false } });
    expect(commandRowView(ctx({ blasterOnline: false, transport: "ir_mcu" })).actions).toMatchObject({
      test: { enabled: true }, learn: { enabled: true },
    });
  });

  it("disconnected or another row listening disables IR buttons", () => {
    expect(commandRowView(ctx({ writable: false })).actions).toMatchObject({ test: { enabled: false }, learn: { enabled: false } });
    expect(commandRowView(ctx({ otherListening: true })).actions).toMatchObject({ test: { enabled: false }, learn: { enabled: false } });
  });

  it("error copy (H6a)", () => {
    expect(irErrorMessage("hw_unavailable")).toBe("Couldn't reach the blaster");
    expect(irErrorMessage("network")).toBe("Command failed");
  });
});
