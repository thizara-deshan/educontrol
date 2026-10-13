import type { ChangedBy, HwEvent, HwSnapshot, Observed, RoomState, ScreenPosition } from "@eduscope/contracts";
import { applyAudioReport } from "./audio.ts";
import { applyLightsReport } from "./lights.ts";
import type { RoomModel } from "./model.ts";
import { reported, sameValue, withChangedBy } from "./observed.ts";
import { applyPowerReading } from "./projector.ts";
import { applySensorReading } from "./sensors.ts";
import { upsertNode } from "./zigbee.ts";

// HwEvent → RoomModel (ARCHITECTURE §3.4, §6.4). Pure; the store derives the rest afterwards.

/** A controllable output as commands and reports name it (LWW and correlation key, §6.5). */
export type OutputKey =
  | "display.source" | "projector.ir" | "projector.mains" | "screen" | "audio.mic" | "audio.pc" | "audio.mute"
  | "lights.front" | "lights.rear" | "ac";

const REPORTED_BY_SNAPSHOT: readonly OutputKey[] = [
  "display.source", "projector.mains", "screen", "audio.mic", "audio.pc", "audio.mute", "lights.front", "lights.rear",
];

/** Outputs whose value an event reports (an echo of a command, or a change by hand). */
export function reportedKeys(event: HwEvent): readonly OutputKey[] {
  switch (event.type) {
    case "snapshot":
      return REPORTED_BY_SNAPSHOT;
    case "lights.state":
      return [event.data.gang === "front" ? "lights.front" : "lights.rear"];
    case "projector_power.relay":
      return ["projector.mains"];
    case "hdmi.state":
      return ["display.source"];
    case "projection_screen.state":
      return ["screen"];
    case "audio.state":
      return [event.data.channel === "mic" ? "audio.mic" : "audio.pc", "audio.mute"];
    default:
      return [];
  }
}

function observedAt(state: RoomState, key: OutputKey): Observed<unknown> | null {
  switch (key) {
    case "display.source":
      return state.display.source;
    case "projector.mains":
      return state.display.projector.mains;
    case "screen":
      return state.display.screen;
    case "audio.mic":
      return state.audio.channels.mic;
    case "audio.pc":
      return state.audio.channels.pc;
    case "audio.mute":
      return state.audio.muted_all;
    case "lights.front":
      return state.environment.lights.front;
    case "lights.rear":
      return state.environment.lights.rear;
    case "projector.ir":
    case "ac":
      return null; // IR outputs have no read-back (R2, R3)
  }
}

/** Did a report change this output's value? */
export function valueChanged(before: RoomState, after: RoomState, key: OutputKey): boolean {
  return !sameValue(observedAt(before, key)?.value, observedAt(after, key)?.value);
}

/** Sets `changed_by` on one reported output (H13). */
export function setChangedBy(state: RoomState, key: OutputKey, by: ChangedBy | null): RoomState {
  const { display, audio, environment } = state;
  switch (key) {
    case "display.source":
      return { ...state, display: { ...display, source: withChangedBy(display.source, by) } };
    case "projector.mains":
      return { ...state, display: { ...display, projector: { ...display.projector, mains: withChangedBy(display.projector.mains, by) } } };
    case "screen":
      return { ...state, display: { ...display, screen: withChangedBy(display.screen, by) } };
    case "audio.mic":
    case "audio.pc": {
      const channel = key === "audio.mic" ? "mic" : "pc";
      return { ...state, audio: { ...audio, channels: { ...audio.channels, [channel]: withChangedBy(audio.channels[channel], by) } } };
    }
    case "audio.mute":
      return { ...state, audio: { ...audio, muted_all: withChangedBy(audio.muted_all, by) } };
    case "lights.front":
    case "lights.rear": {
      const gang = key === "lights.front" ? "front" : "rear";
      const lights = { ...environment.lights, [gang]: withChangedBy(environment.lights[gang], by) };
      return { ...state, environment: { ...environment, lights } };
    }
    case "projector.ir":
    case "ac":
      return state;
  }
}

function applyScreen(state: RoomState, position: ScreenPosition, at: string): RoomState {
  const screen = reported(state.display.screen, position, at, position === "unknown" ? "unknown" : "confirmed");
  return { ...state, display: { ...state.display, screen } };
}

function applyBlaster(state: RoomState, data: { online: boolean; lqi: number | null }, at: string): RoomState {
  return { ...state, ir_blaster: { ...state.ir_blaster, lqi: data.lqi, online: reported(state.ir_blaster.online, data.online, at) } };
}

function withState(model: RoomModel, state: RoomState): RoomModel {
  return { ...model, state };
}

/** The first SSE event (and every reconnect): full truth from hw, link up (§6.7 recovery). */
export function applySnapshot(model: RoomModel, snap: HwSnapshot, at: string): RoomModel {
  let state: RoomState = { ...model.state, connection: { hw: "up" } };
  state = applyLightsReport(state, "front", snap.lights.front, at);
  state = applyLightsReport(state, "rear", snap.lights.rear, at);
  const { projector } = state.display;
  state = { ...state, display: { ...state.display, projector: { ...projector, mains: reported(projector.mains, snap.projector_power.relay, at) } } };
  state = { ...state, display: { ...state.display, source: reported(state.display.source, snap.hdmi.input, at) } };
  state = applyScreen(state, snap.projection_screen.position, at);
  state = {
    ...state,
    zigbee: {
      ...state.zigbee,
      nodes: snap.zigbee.nodes,
      coordinator: snap.zigbee.coordinator ?? { ...state.zigbee.coordinator, status: "offline" },
    },
  };
  if (snap.ir.blaster !== null) state = applyBlaster(state, snap.ir.blaster, at);
  for (const sample of snap.sensors) state = applySensorReading(state, sample.reading, sample.at);

  let next: RoomModel = { ...model, state, facts: { ...model.facts, hw_down_since: null, joining_until: snap.zigbee.joining_until } };
  const reading = snap.projector_power.reading;
  if (reading !== null) next = applyPowerReading(next, reading, reading.at);
  for (const channel of ["mic", "pc"] as const) {
    const level = snap.audio[channel];
    if (level !== null) next = applyAudioReport(next, { channel, ...level }, at);
  }
  return next;
}

/** One HwEvent applied to the model. Events with no state (heartbeat, errors, IR learn) change nothing. */
export function applyHwEvent(model: RoomModel, event: HwEvent): RoomModel {
  const { state } = model;
  const at = event.at;
  switch (event.type) {
    case "snapshot":
      return applySnapshot(model, event.data, at);
    case "lights.state":
      return withState(model, applyLightsReport(state, event.data.gang, event.data.on, at));
    case "projector_power.relay": {
      const { projector } = state.display;
      return withState(model, { ...state, display: { ...state.display, projector: { ...projector, mains: reported(projector.mains, event.data.on, at) } } });
    }
    case "projector_power.reading":
      return applyPowerReading(model, event.data, at);
    case "hdmi.state":
      return withState(model, { ...state, display: { ...state.display, source: reported(state.display.source, event.data.input, at) } });
    case "projection_screen.state":
      return withState(model, applyScreen(state, event.data.position, at));
    case "audio.state":
      return applyAudioReport(model, event.data, at);
    case "sensors.reading":
      return withState(model, applySensorReading(state, event.data, at));
    case "zigbee.node":
      return withState(model, { ...state, zigbee: { ...state.zigbee, nodes: upsertNode(state.zigbee.nodes, event.data) } });
    case "zigbee.coordinator":
      return withState(model, { ...state, zigbee: { ...state.zigbee, coordinator: event.data } });
    case "zigbee.mesh":
      return { ...model, facts: { ...model.facts, joining_until: event.data.joining_until } };
    case "ir.blaster":
      return withState(model, applyBlaster(state, event.data, at));
    case "ir.learn":
    case "hw.error":
    case "heartbeat":
      return model;
  }
}

/** The SSE stream dropped (§6.7): link down now; devices go offline after the grace (derive.ts). */
export function applyHwDown(model: RoomModel, at: string): RoomModel {
  if (model.state.connection.hw === "down" && model.facts.hw_down_since !== null) return model;
  return { ...model, state: { ...model.state, connection: { hw: "down" } }, facts: { ...model.facts, hw_down_since: at } };
}
