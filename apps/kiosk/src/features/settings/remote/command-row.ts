import type { IrCommand, IrTransport } from "@eduscope/contracts";
import type { CaptureEntry } from "@/data/ir/capture-store";
import { formatCountdown } from "@/lib/format";
import { commandStatus, TRANSPORT_LABEL, type ToneText } from "./remote.view";

// One S3.E14 command row: capture flow (H21) + test flow (H22, R5) + blaster offline (H25).
// Server state = the IrCommand and the latest `ir_capture` push. Local state = which request is
// in flight and whether the "Did it react?" question is open. Nothing here changes a value.

export type RowLocal =
  | { kind: "idle" }
  | { kind: "learn_sending" }
  | { kind: "cancel_sending" }
  | { kind: "test_sending" }
  | { kind: "asking" }
  | { kind: "answer_sending"; reacted: boolean };

export type RowAction =
  | { type: "learn" }
  | { type: "cancel" }
  | { type: "test" }
  | { type: "answer"; reacted: boolean }
  /** The request finished (either way); errors are shown by the inline-error store. */
  | { type: "done" }
  /** POST test succeeded: ask the technician. */
  | { type: "test_sent" }
  /** Saving the answer failed: ask again. */
  | { type: "answer_failed" };

export const ROW_IDLE: RowLocal = { kind: "idle" };

export function rowReducer(state: RowLocal, action: RowAction): RowLocal {
  switch (action.type) {
    case "learn":
      return state.kind === "idle" ? { kind: "learn_sending" } : state;
    case "cancel":
      return state.kind === "idle" ? { kind: "cancel_sending" } : state;
    case "test":
      return state.kind === "idle" ? { kind: "test_sending" } : state;
    case "test_sent":
      return state.kind === "test_sending" ? { kind: "asking" } : state;
    case "answer":
      return state.kind === "asking" ? { kind: "answer_sending", reacted: action.reacted } : state;
    case "answer_failed":
      return state.kind === "answer_sending" ? { kind: "asking" } : state;
    case "done":
      return ROW_IDLE;
  }
}

export interface RowContext {
  command: IrCommand;
  capture: CaptureEntry | undefined;
  local: RowLocal;
  deviceName: string;
  transport: IrTransport;
  /** `ir_blaster.online.value`; only ZS06 devices need it (R8). */
  blasterOnline: boolean;
  /** Connection live and the session can write. */
  writable: boolean;
  /** Another row of any device is listening (one blaster, one capture). */
  otherListening: boolean;
  /** Server now. */
  now: Date;
}

export interface RowButton {
  label: string;
  enabled: boolean;
  pending: boolean;
  /** Test right after a capture ("Captured · now test it"). */
  highlighted?: boolean;
}

export type RowActions =
  | { kind: "default"; test: RowButton; learn: RowButton }
  | { kind: "listening"; cancel: RowButton }
  | { kind: "asking"; yes: RowButton; no: RowButton };

export interface RowView {
  status: ToneText;
  /** H21 countdown `0:18` while listening. */
  countdown: string | null;
  /** Second line in the capture cell: "Captured · now test it", "Nothing received", "Did the Projector react?". */
  note: ToneText | null;
  actions: RowActions;
}

/** H21 copy. The MCU fallback has its own receiver `[INFERRED]`. */
export function listeningText(transport: IrTransport): string {
  return `Listening… point the remote at the ${TRANSPORT_LABEL[transport]} and press the button`;
}

export function commandRowView(ctx: RowContext): RowView {
  const { command, capture, local } = ctx;
  const blasterBlocks = ctx.transport === "ir_zs06" && !ctx.blasterOnline; // H25
  const canUseIr = ctx.writable && !blasterBlocks && !ctx.otherListening;
  const stored = commandStatus(command, ctx.now);

  if (capture?.status === "listening") {
    const leftS = capture.deadline === null ? 0 : (Date.parse(capture.deadline) - ctx.now.getTime()) / 1000;
    return {
      status: { text: listeningText(ctx.transport), tone: "default" },
      countdown: formatCountdown(leftS),
      note: null,
      actions: { kind: "listening", cancel: { label: "Cancel", enabled: ctx.writable, pending: local.kind === "cancel_sending" } },
    };
  }

  if (local.kind === "asking" || local.kind === "answer_sending") {
    const sending = local.kind === "answer_sending" ? local.reacted : null;
    return {
      status: stored,
      countdown: null,
      note: { text: `Did the ${ctx.deviceName} react?`, tone: "default" },
      actions: {
        kind: "asking",
        yes: { label: "Yes", enabled: ctx.writable, pending: sending === true },
        no: { label: "No", enabled: ctx.writable, pending: sending === false },
      },
    };
  }

  const note: ToneText | null =
    capture?.status === "captured" ? { text: "Captured · now test it", tone: "accent" }
    : capture?.status === "timeout" ? { text: "Nothing received", tone: "danger" }
    : capture?.status === "failed" ? { text: "Capture failed", tone: "danger" }
    : null;
  const retry = capture?.status === "timeout" || capture?.status === "failed";
  return {
    status: stored,
    countdown: null,
    note,
    actions: {
      kind: "default",
      test: {
        label: "Test",
        enabled: canUseIr && command.captured,
        pending: local.kind === "test_sending",
        highlighted: capture?.status === "captured",
      },
      learn: {
        label: retry ? "Try again" : command.captured ? "Re-learn" : "Learn",
        enabled: canUseIr,
        pending: local.kind === "learn_sending",
      },
    },
  };
}

/** H6a copy for a failed IR request. */
export function irErrorMessage(code: string | null): string {
  return code === "hw_unavailable" ? "Couldn't reach the blaster" : "Command failed";
}
