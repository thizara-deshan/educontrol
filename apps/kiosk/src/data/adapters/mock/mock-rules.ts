import type { ChangedBy, CommandBody, Confidence, Observed, RoomState, Source } from "@eduscope/contracts";

// The mock's own rough approximation of core-api's domain rules (never imported from
// apps/core-api). Commands change state here; FakeRoom adds the timed parts (R1 draw ramp,
// screen travel, H7b) on top.

export interface ChangeContext {
  at: string;
  by: ChangedBy;
}

export function observe<T>(
  prev: Observed<T>, value: T, ctx: ChangeContext, confidence: Confidence = "confirmed", source: Source = prev.source,
): Observed<T> {
  return { ...prev, value, confidence, source, updated_at: ctx.at, stale: false, changed_by: ctx.by };
}

/** The resulting command status: IR targets are never confirmed by the command (R2, R3). */
export function statusFor(body: CommandBody): "confirmed" | "assumed" {
  return body.kind === "ac.power" || body.kind === "ac.step" || body.kind === "projector.power" ? "assumed" : "confirmed";
}

/** AC Power on with no setpoint sent since start (R3 "Unknown"): this frame is sent [ASSUMED]. */
export const DEFAULT_AC_SETPOINT_C = 24;

function defaultSetpoint(available: readonly number[]): number | null {
  if (available.includes(DEFAULT_AC_SETPOINT_C)) return DEFAULT_AC_SETPOINT_C;
  return available[Math.floor(available.length / 2)] ?? null;
}

/** Next captured setpoint in a direction (R4); stays put at the ends. */
export function stepSetpoint(available: readonly number[], current: number | null, direction: "down" | "up"): number | null {
  if (current === null) return available[0] ?? null;
  const candidates = direction === "up" ? available.filter((t) => t > current) : available.filter((t) => t < current);
  if (candidates.length === 0) return current;
  return direction === "up" ? Math.min(...candidates) : Math.max(...candidates);
}

export function applyCommandToState(state: RoomState, body: CommandBody, ctx: ChangeContext): RoomState {
  const { display, audio, environment } = state;
  switch (body.kind) {
    case "source.select":
      return { ...state, display: { ...display, source: observe(display.source, body.input, ctx) } };
    case "projector.power":
      // R2: IR alone changes nothing but the feedback; the draw ramp (FakeRoom) moves the state.
      return {
        ...state,
        display: {
          ...display,
          projector: {
            ...display.projector,
            feedback: { last_ir: body.on ? "power_on" : "power_off", sent_at: ctx.at, phase: "waiting_for_draw" },
          },
        },
      };
    case "projector.mains":
      return {
        ...state,
        display: { ...display, projector: { ...display.projector, mains: observe(display.projector.mains, body.on, ctx) } },
      };
    case "screen.move":
      return {
        ...state,
        display: { ...display, screen: observe(display.screen, "moving", ctx) }, // FakeRoom finishes the travel
      };
    case "audio.level":
      return {
        ...state,
        audio: {
          ...audio,
          channels: { ...audio.channels, [body.channel]: observe(audio.channels[body.channel], body.level, ctx) },
        },
      };
    case "audio.mute_all": {
      // R9: mute saves each level and the mixer reads 0; unmute restores the saved levels.
      if (body.muted === (audio.muted_all.value === true)) return state;
      const { mic, pc } = audio.channels;
      const saved = audio.saved_levels;
      return {
        ...state,
        audio: {
          muted_all: observe(audio.muted_all, body.muted, ctx),
          channels: body.muted
            ? { mic: observe(mic, 0, ctx), pc: observe(pc, 0, ctx) }
            : { mic: observe(mic, saved.mic ?? mic.value ?? 0, ctx), pc: observe(pc, saved.pc ?? pc.value ?? 0, ctx) },
          saved_levels: body.muted ? { mic: mic.value, pc: pc.value } : { mic: null, pc: null },
        },
      };
    }
    case "lights.set":
      return {
        ...state,
        environment: {
          ...environment,
          lights: { ...environment.lights, [body.gang]: observe(environment.lights[body.gang], body.on, ctx) },
        },
      };
    case "ac.power": {
      const { ac } = environment;
      // Power on sends the frame for the current setpoint (S1.E35); after a start that is the default.
      const setpoint = body.on ? (ac.setpoint_c.value ?? defaultSetpoint(ac.available_setpoints)) : ac.setpoint_c.value;
      return {
        ...state,
        environment: {
          ...environment,
          ac: {
            ...ac,
            power: observe(ac.power, body.on ? "on" : "off", ctx, "assumed", "ir"),
            setpoint_c: body.on && setpoint !== null ? observe(ac.setpoint_c, setpoint, ctx, "assumed", "ir") : ac.setpoint_c,
          },
        },
      };
    }
    case "ac.step": {
      if (environment.ac.power.value !== "on") return state; // Q5: core-api rejects −/+ while off
      const next = stepSetpoint(environment.ac.available_setpoints, environment.ac.setpoint_c.value, body.direction);
      if (next === null) return state;
      return {
        ...state,
        environment: {
          ...environment,
          ac: { ...environment.ac, setpoint_c: observe(environment.ac.setpoint_c, next, ctx, "assumed", "ir") },
        },
      };
    }
  }
}

/** Activity text for H13 toasts, e.g. "Rear of room turned on". */
export function describeCommand(body: CommandBody): string {
  switch (body.kind) {
    case "source.select":
      return body.input === "podium_pc" ? "Podium PC selected" : "Smart board selected";
    case "projector.power":
      return body.on ? "Projector power on sent" : "Projector power off sent";
    case "projector.mains":
      return body.on ? "Projector mains turned on" : "Projector mains turned off";
    case "screen.move":
      return body.to === "raise" ? "Projection screen raised" : "Projection screen lowered";
    case "audio.level":
      return `${body.channel === "mic" ? "Lecturer microphone" : "PC audio"} set to ${body.level}`;
    case "audio.mute_all":
      return body.muted ? "All audio muted" : "All audio unmuted";
    case "lights.set":
      return `${body.gang === "front" ? "Front" : "Rear"} of room turned ${body.on ? "on" : "off"}`;
    case "ac.power":
      return body.on ? "Air conditioning turned on" : "Air conditioning turned off";
    case "ac.step":
      return body.direction === "up" ? "Air conditioning setpoint raised" : "Air conditioning setpoint lowered";
  }
}
