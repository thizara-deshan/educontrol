import type { ApiErrorCode, ChangedBy, CommandBody, HwAck, RoomState } from "@eduscope/contracts";
import { acSent, powerOnSetpoint, stepTarget } from "../domain/ac.ts";
import { saveLevels } from "../domain/audio.ts";
import type { OutputKey } from "../domain/hw-events.ts";
import { mainsOffBlocked } from "../domain/interlock.ts";
import type { RoomModel } from "../domain/model.ts";
import { feedbackAfterIr } from "../domain/projector.ts";
import type { HwClient, HwTimeouts } from "../hw/client.ts";
import type { IrCodeLookup, IrMatch } from "./ir-codes.ts";

// ARCHITECTURE §6.5 policies: required access per kind, preconditions (hw up, device online,
// blaster online H25, interlock R11, AC rules R4/Q5/H19, captured code), and the hw calls to make.

export type HwCall = (hw: HwClient) => Promise<HwAck>;

export interface CommandPlan {
  key: OutputKey;
  calls: readonly HwCall[];
  /** Pause before each call after the first (the projector's Power off confirmation). */
  gapMs?: number;
  /** Deadline for the whole command: acks + read-back (Q12). */
  timeoutMs: number;
  /** H6a line when hw refuses. */
  failureText: string;
  /** IR has no read-back: the command ends `assumed` right after the ack (R2, R3). */
  ir: boolean;
  /** Applied before the first hw call (R9 saved levels, H7b waiting). */
  before?: (model: RoomModel, at: string) => RoomModel;
  /** Undoes `before` when hw refuses. */
  revert?: (model: RoomModel) => RoomModel;
  /** IR only: the assumed values once the blaster accepted the frame. */
  after?: (model: RoomModel, at: string, by: ChangedBy) => RoomModel;
  /** Non-IR: the state that proves the command worked (correlation). */
  confirmedBy?: (state: RoomState) => boolean;
}

export type PlanResult = { ok: true; plan: CommandPlan } | { ok: false; status: 409 | 503; code: ApiErrorCode; message: string };

export const FAILURE_TEXT = {
  ir: "Couldn't reach the blaster",
  zigbee: "Switch didn't respond",
  other: "Command failed",
} as const;

/** R14 + ARCHITECTURE §5: projector mains is technician-only, everything else needs control. */
export function requiredAccess(body: CommandBody): "control" | "technician" {
  return body.kind === "projector.mains" ? "technician" : "control";
}

const refuse = (message: string): PlanResult => ({ ok: false, status: 409, code: "precondition", message });

function deviceOffline(state: RoomState, deviceId: string): string | null {
  const device = state.devices.find((d) => d.id === deviceId);
  return device?.online.value === false ? `${device.name} offline` : null;
}

function withAc(model: RoomModel, change: Parameters<typeof acSent>[1], at: string, by: ChangedBy): RoomModel {
  const { environment } = model.state;
  return { ...model, state: { ...model.state, environment: { ...environment, ac: acSent(environment.ac, change, at, by) } } };
}

function irPlan(
  model: RoomModel, ir: IrCodeLookup, timeouts: HwTimeouts, deviceId: string, match: IrMatch, key: OutputKey,
  extra: Pick<CommandPlan, "before" | "revert" | "after">, repeatAfterMs?: number,
): PlanResult {
  const found = ir.find(deviceId, match);
  if (!found.ok) return refuse(found.message);
  if (found.transport === "ir_zs06" && model.state.ir_blaster.online.value === false) return refuse("IR blaster offline"); // H25
  const send: HwCall = (hw) => hw.irSend({ transport: found.transport, code_format: "tuya", code: found.code });
  if (repeatAfterMs === undefined) {
    return { ok: true, plan: { key, calls: [send], timeoutMs: timeouts.irSendMs, failureText: FAILURE_TEXT.ir, ir: true, ...extra } };
  }
  return {
    ok: true,
    plan: {
      key, calls: [send, send], gapMs: repeatAfterMs, timeoutMs: 2 * timeouts.irSendMs + repeatAfterMs,
      failureText: FAILURE_TEXT.ir, ir: true, ...extra,
    },
  };
}

export function planCommand(body: CommandBody, model: RoomModel, ir: IrCodeLookup, timeouts: HwTimeouts): PlanResult {
  const { state } = model;
  if (state.connection.hw === "down") return { ok: false, status: 503, code: "hw_unavailable", message: "Hardware service offline" };

  switch (body.kind) {
    case "source.select": {
      const offline = deviceOffline(state, "hdmi_switch");
      if (offline !== null) return refuse(offline);
      return {
        ok: true,
        plan: {
          key: "display.source", calls: [(hw) => hw.hdmiSelect({ input: body.input })], timeoutMs: timeouts.hdmiMs,
          failureText: FAILURE_TEXT.other, ir: false, confirmedBy: (s) => s.display.source.value === body.input,
        },
      };
    }
    case "projector.power": {
      const previous = state.display.projector.feedback;
      return irPlan(model, ir, timeouts, "projector", { role: body.on ? "power_on" : "power_off" }, "projector.ir", {
        before: (m, at) => {
          const { projector } = m.state.display;
          const feedback = feedbackAfterIr(body.on, projector.state.value, at);
          return { ...m, state: { ...m.state, display: { ...m.state.display, projector: { ...projector, feedback } } } };
        },
        revert: (m) => ({ ...m, state: { ...m.state, display: { ...m.state.display, projector: { ...m.state.display.projector, feedback: previous } } } }),
      }, body.on ? undefined : timeouts.projectorOffConfirmMs); // Epson: Power off, "Power off?" prompt, Power off again
    }
    case "projector.mains": {
      const offline = deviceOffline(state, "projector_socket");
      if (offline !== null) return refuse(offline);
      if (!body.on) {
        const blocked = mainsOffBlocked(state, model.facts.interlock_bypassed); // R11
        if (blocked !== null) return refuse(blocked);
      }
      return {
        ok: true,
        plan: {
          key: "projector.mains", calls: [(hw) => hw.projectorRelay({ on: body.on })], timeoutMs: timeouts.zigbeeMs,
          failureText: FAILURE_TEXT.zigbee, ir: false, confirmedBy: (s) => s.display.projector.mains.value === body.on,
        },
      };
    }
    case "screen.move": {
      const offline = deviceOffline(state, "projection_screen");
      if (offline !== null) return refuse(offline);
      const target = body.to === "raise" ? "raised" : "lowered";
      return {
        ok: true,
        plan: {
          key: "screen", calls: [(hw) => hw.screenMove({ to: body.to })], timeoutMs: timeouts.screenMs,
          failureText: FAILURE_TEXT.other, ir: false, confirmedBy: (s) => s.display.screen.value === target,
        },
      };
    }
    case "audio.level": {
      const offline = deviceOffline(state, "audio");
      if (offline !== null) return refuse(offline);
      return {
        ok: true,
        plan: {
          key: body.channel === "mic" ? "audio.mic" : "audio.pc",
          calls: [(hw) => hw.audioLevel({ channel: body.channel, level: body.level })], timeoutMs: timeouts.mixerMs,
          failureText: FAILURE_TEXT.other, ir: false, confirmedBy: (s) => s.audio.channels[body.channel].value === body.level,
        },
      };
    }
    case "audio.mute_all": {
      const offline = deviceOffline(state, "audio");
      if (offline !== null) return refuse(offline);
      const mute: HwCall[] = [(hw) => hw.audioMute({ channel: "mic", muted: body.muted }), (hw) => hw.audioMute({ channel: "pc", muted: body.muted })];
      const saved = state.audio.saved_levels;
      // R9: unmute restores the levels saved by the mute, after both channels are unmuted.
      const restore: HwCall[] = body.muted
        ? []
        : (["mic", "pc"] as const).flatMap((channel): HwCall[] => {
            const level = saved[channel];
            return level === null ? [] : [(hw) => hw.audioLevel({ channel, level })];
          });
      const calls = [...mute, ...restore];
      return {
        ok: true,
        plan: {
          key: "audio.mute", calls, timeoutMs: timeouts.mixerMs * calls.length, failureText: FAILURE_TEXT.other, ir: false,
          before: (m) => (body.muted ? { ...m, state: { ...m.state, audio: saveLevels(m.state.audio) } } : m),
          confirmedBy: (s) => s.audio.muted_all.value === body.muted,
        },
      };
    }
    case "lights.set": {
      const offline = deviceOffline(state, "lights");
      if (offline !== null) return refuse(offline);
      return {
        ok: true,
        plan: {
          key: body.gang === "front" ? "lights.front" : "lights.rear",
          calls: [(hw) => hw.lightsSet({ gang: body.gang, on: body.on })], timeoutMs: timeouts.zigbeeMs,
          failureText: FAILURE_TEXT.zigbee, ir: false, confirmedBy: (s) => s.environment.lights[body.gang].value === body.on,
        },
      };
    }
    case "ac.power": {
      if (!body.on) {
        return irPlan(model, ir, timeouts, "ac", { role: "power_off" }, "ac", {
          after: (m, at, by) => withAc(m, { power: "off" }, at, by),
        });
      }
      // D-26: the captured Power on code first. The AC resumes its own last setpoint, so core-api leaves setpoint_c as it was.
      if (ir.find("ac", { role: "power_on" }).ok) {
        return irPlan(model, ir, timeouts, "ac", { role: "power_on" }, "ac", {
          after: (m, at, by) => withAc(m, { power: "on" }, at, by),
        });
      }
      const setpoint = powerOnSetpoint(state.environment.ac);
      if (setpoint === null) return refuse("Air conditioning has no captured power-on or setpoint frame");
      return irPlan(model, ir, timeouts, "ac", { setpoint_c: setpoint }, "ac", {
        after: (m, at, by) => withAc(m, { power: "on", setpoint_c: setpoint }, at, by),
      });
    }
    case "ac.step": {
      const step = stepTarget(state.environment.ac, body.direction);
      if (!step.ok) return refuse(step.reason);
      return irPlan(model, ir, timeouts, "ac", { setpoint_c: step.temp_c }, "ac", {
        after: (m, at, by) => withAc(m, { setpoint_c: step.temp_c }, at, by),
      });
    }
  }
}
