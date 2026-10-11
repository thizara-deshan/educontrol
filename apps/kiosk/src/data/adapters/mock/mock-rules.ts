import type { ChangedBy, CommandBody, Confidence, Observed, RoomState, Source } from "@eduscope/contracts";

// The mock's own rough approximation of core-api's domain rules (never imported from
// apps/core-api). M02: every command lands immediately; M04 adds the R1 draw ramp etc.

export interface ChangeContext {
  at: string;
  by: ChangedBy;
}

export function observe<T>(
  prev: Observed<T>, value: T, ctx: ChangeContext, confidence: Confidence = "confirmed", source: Source = prev.source,
): Observed<T> {
  return { ...prev, value, confidence, source, updated_at: ctx.at, stale: false, changed_by: ctx.by };
}

/** The resulting command status: IR-only targets can never be confirmed (R3). */
export function statusFor(body: CommandBody): "confirmed" | "assumed" {
  return body.kind === "ac.power" || body.kind === "ac.step" ? "assumed" : "confirmed";
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
      return {
        ...state,
        display: {
          ...display,
          projector: {
            ...display.projector,
            state: observe(display.projector.state, body.on ? "running" : "standby", ctx),
            feedback: { last_ir: body.on ? "power_on" : "power_off", sent_at: ctx.at, phase: "idle" },
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
        display: { ...display, screen: observe(display.screen, body.to === "raise" ? "raised" : "lowered", ctx) },
      };
    case "audio.level":
      return {
        ...state,
        audio: {
          ...audio,
          channels: { ...audio.channels, [body.channel]: observe(audio.channels[body.channel], body.level, ctx) },
        },
      };
    case "audio.mute_all":
      return {
        ...state,
        audio: {
          ...audio,
          muted_all: observe(audio.muted_all, body.muted, ctx),
          saved_levels: body.muted
            ? { mic: audio.channels.mic.value, pc: audio.channels.pc.value }
            : { mic: null, pc: null },
        },
      };
    case "lights.set":
      return {
        ...state,
        environment: {
          ...environment,
          lights: { ...environment.lights, [body.gang]: observe(environment.lights[body.gang], body.on, ctx) },
        },
      };
    case "ac.power":
      return {
        ...state,
        environment: {
          ...environment,
          ac: { ...environment.ac, power: observe(environment.ac.power, body.on ? "on" : "off", ctx, "assumed", "ir") },
        },
      };
    case "ac.step": {
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
