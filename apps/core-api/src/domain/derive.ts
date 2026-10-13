import type { RoomState } from "@eduscope/contracts";
import { deriveDevices } from "./devices.ts";
import { deriveInterlock } from "./interlock.ts";
import type { RoomModel, RuleConfig } from "./model.ts";
import { reported, withStale } from "./observed.ts";
import { nextPhase } from "./projector.ts";
import { applyStaleness, deriveReporting } from "./sensors.ts";
import { deriveStatus } from "./status.ts";
import { deriveMesh } from "./zigbee.ts";

// Every derived field, recomputed after each change and on the periodic tick (ARCHITECTURE §6.4).

/** H8 after the hw grace: every reported value keeps its last value but is greyed (stale). */
function markAllStale(state: RoomState): RoomState {
  const { display, audio, environment } = state;
  const sensors = environment.sensors;
  return {
    ...state,
    display: {
      ...display,
      source: withStale(display.source, true),
      screen: withStale(display.screen, true),
      projector: {
        ...display.projector,
        state: withStale(display.projector.state, true),
        power: withStale(display.projector.power, true),
        mains: withStale(display.projector.mains, true),
      },
    },
    audio: {
      ...audio,
      channels: { mic: withStale(audio.channels.mic, true), pc: withStale(audio.channels.pc, true) },
      muted_all: withStale(audio.muted_all, true),
    },
    environment: {
      ...environment,
      lights: { front: withStale(environment.lights.front, true), rear: withStale(environment.lights.rear, true) },
      sensors: {
        ...sensors,
        temperature: { ...sensors.temperature, stale: true },
        humidity: { ...sensors.humidity, stale: true },
        occupancy: { ...sensors.occupancy, stale: true },
        contact: { ...sensors.contact, stale: true },
      },
    },
  };
}

export function derive(model: RoomModel, now: Date, cfg: RuleConfig): RoomModel {
  const nowIso = now.toISOString();
  const { facts } = model;
  const hwDown = model.state.connection.hw === "down";
  const hwOffline = hwDown && facts.hw_down_since !== null && now.getTime() - Date.parse(facts.hw_down_since) >= cfg.hwDownGraceMs;

  let state = applyStaleness(model.state, now, cfg);
  if (hwOffline) {
    state = markAllStale(state);
    const blaster = state.ir_blaster.online.value === false ? state.ir_blaster.online : reported(state.ir_blaster.online, false, nowIso);
    state = {
      ...state,
      ir_blaster: { ...state.ir_blaster, online: withStale(blaster, true) },
      zigbee: { ...state.zigbee, coordinator: { ...state.zigbee.coordinator, status: "offline" } },
    };
  }
  const { projector } = state.display;
  state = { ...state, display: { ...state.display, projector: { ...projector, feedback: nextPhase(projector.feedback, projector.state.value, now) } } };
  state = { ...state, devices: deriveDevices(model.registry, state, { hwDown, hwOffline }, nowIso) };
  state = { ...state, zigbee: { ...state.zigbee, mesh: deriveMesh(state.zigbee.nodes, facts.joining_until, now) } };
  state = { ...state, environment: { ...state.environment, sensors: { ...state.environment.sensors, reporting: deriveReporting(state) } } };
  state = { ...state, interlock: deriveInterlock(state, facts.interlock_bypassed) };
  state = { ...state, room: { ...state.room, status: deriveStatus(state) } };
  return { ...model, state };
}
