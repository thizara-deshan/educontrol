import type {
  ChangedBy, CommandBody, Confidence, Observed, ProjectorFeedback, ProjectorState, RoomState, RoomStatus, Source,
} from "@eduscope/contracts";

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

// ── R1 projector draw ramp ─────────────────────────────────────────────────────────────

export const STANDBY_WATTS = 3;
export const RUNNING_WATTS = 287;
const WARM_FROM_W = 6;
const WARM_TO_W = 49;
const COOL_FROM_W = 45;
const COOL_TO_W = 6;

/** Real-time lengths of the ramp; FakeRoom multiplies them by its time scale. */
export interface RampTimes {
  /** IR sent → the draw starts to move ("waiting for draw", H7b). */
  irToDrawMs: number;
  warmUpMs: number;
  coolDownMs: number;
}

export interface ProjectorStep {
  watts: number;
  state: ProjectorState;
  phase: ProjectorFeedback["phase"];
  /** The ramp has reached running / standby. */
  done: boolean;
}

/** Where the R1 ramp is `elapsedMs` after the IR command (>50 W running, <5 W standby). */
export function projectorRamp(on: boolean, elapsedMs: number, times: RampTimes): ProjectorStep {
  if (elapsedMs < times.irToDrawMs) {
    return on
      ? { watts: STANDBY_WATTS, state: "standby", phase: "waiting_for_draw", done: false }
      : { watts: RUNNING_WATTS, state: "running", phase: "waiting_for_draw", done: false };
  }
  const into = elapsedMs - times.irToDrawMs;
  if (on) {
    if (into >= times.warmUpMs) return { watts: RUNNING_WATTS, state: "running", phase: "idle", done: true };
    const watts = Math.round(WARM_FROM_W + ((WARM_TO_W - WARM_FROM_W) * into) / times.warmUpMs);
    return { watts, state: "warming_up", phase: "idle", done: false };
  }
  if (into >= times.coolDownMs) return { watts: STANDBY_WATTS, state: "standby", phase: "idle", done: true };
  const watts = Math.round(COOL_FROM_W - ((COOL_FROM_W - COOL_TO_W) * into) / times.coolDownMs);
  return { watts, state: "cooling_down", phase: "idle", done: false };
}

/** Writes a ramp step: state + live power confirmed by draw; interlock holds while cooling (R11). */
export function applyProjectorStep(state: RoomState, step: ProjectorStep, at: string): RoomState {
  const { projector } = state.display;
  const reading = projector.power.value ?? { watts: 0, volts: 231, kwh_today: 0, rating_a: 13, at };
  return {
    ...state,
    display: {
      ...state.display,
      projector: {
        ...projector,
        state: { ...projector.state, value: step.state, confidence: "confirmed", source: "power_meter", updated_at: at, stale: false },
        power: {
          ...projector.power,
          value: { ...reading, watts: step.watts, at },
          confidence: "confirmed",
          source: "power_meter",
          updated_at: at,
          stale: false,
        },
        feedback: { ...projector.feedback, phase: step.phase },
      },
    },
    interlock: { ...state.interlock, status: step.state === "cooling_down" ? "holding" : "armed" },
  };
}

/** H7b phase only (no change in draw after 90 s, or IR that the draw already agrees with). */
export function setProjectorPhase(state: RoomState, phase: ProjectorFeedback["phase"]): RoomState {
  const { projector } = state.display;
  return { ...state, display: { ...state.display, projector: { ...projector, feedback: { ...projector.feedback, phase } } } };
}

// ── Derived fields (core-api recomputes these on every change, ARCHITECTURE §6.4) ──────

/** S1.E41: sensor devices that are online with a fresh, non-null reading on every tile. */
export function deriveReporting(state: RoomState): { count: number; of: number } {
  const { temperature, humidity, occupancy, contact } = state.environment.sensors;
  const readings = [temperature, humidity, occupancy, contact];
  const sensors = state.devices.filter((device) => device.kind === "sensor");
  const count = sensors.filter((device) => {
    if (device.online.value === false) return false;
    const own = readings.filter((reading) => reading.node === device.hw_ref);
    return own.length > 0 && own.every((reading) => !reading.stale && reading.value !== null);
  }).length;
  return { count, of: sensors.length };
}

/** S1.E4 (approximation of core-api `status.ts`): fault > degraded > normal. */
export function deriveRoomStatus(state: RoomState): RoomStatus {
  if (state.zigbee.coordinator.status === "offline") return { level: "fault", text: "Coordinator offline" };
  const offline = state.devices.filter((device) => device.online.value === false);
  const first = offline[0];
  if (first !== undefined) {
    return { level: "degraded", text: offline.length === 1 ? `${first.name} offline` : `${offline.length} devices offline` };
  }
  const { count, of } = state.environment.sensors.reporting;
  if (count < of) return { level: "degraded", text: "Sensor not reporting" };
  return { level: "normal", text: "All systems normal" };
}

/** Recomputes `sensors.reporting` then `room.status`. */
export function withDerived(state: RoomState): RoomState {
  const reporting = deriveReporting(state);
  const withReporting: RoomState = {
    ...state,
    environment: { ...state.environment, sensors: { ...state.environment.sensors, reporting } },
  };
  return { ...withReporting, room: { ...withReporting.room, status: deriveRoomStatus(withReporting) } };
}
