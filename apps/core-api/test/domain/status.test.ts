import type { RoomState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import { deriveStatus } from "../../src/domain/status.ts";
import { bootModel, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const up = () => derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES);
const node = (state: RoomState, name: string) => must(state.zigbee.nodes.find((n) => n.friendly_name === name));
const withEvent = (event: Parameters<typeof applyHwEvent>[1]) => derive(applyHwEvent(up(), event), new Date(T0), RULES).state;

describe("S1.E4 room status", () => {
  it("normal when everything reports", () => {
    expect(up().state.room.status).toEqual({ level: "normal", text: "All systems normal" });
  });
  it("fault: hw-service offline beats everything", () => {
    expect(deriveStatus(derive(applyHwDown(up(), T0), new Date(T0), RULES).state)).toEqual({ level: "fault", text: "Hardware service offline" });
  });
  it("fault: coordinator offline (H9)", () => {
    const state = withEvent(hwEvent("zigbee.coordinator", { ...up().state.zigbee.coordinator, status: "offline" }));
    expect(state.room.status).toEqual({ level: "fault", text: "Coordinator offline" });
  });
  it("degraded: one router offline names the device (R7: never fault)", () => {
    const state = withEvent(hwEvent("zigbee.node", { ...node(up().state, "r101_proj_plug"), online: false }));
    expect(state.room.status).toEqual({ level: "degraded", text: "Projector socket offline" });
  });
  it("degraded: two devices offline are counted", () => {
    let model = applyHwEvent(up(), hwEvent("zigbee.node", { ...node(up().state, "r101_lights"), online: false }));
    model = applyHwEvent(model, hwEvent("ir.blaster", { online: false, lqi: null }));
    // blaster offline takes the projector and the AC (both ir_zs06) with it
    expect(derive(model, new Date(T0), RULES).state.room.status).toEqual({ level: "degraded", text: "4 devices offline" });
  });
  it("S1.E41 counts sensor devices, not tiles; a stale climate tile drops one device", () => {
    expect(up().state.environment.sensors.reporting).toEqual({ count: 3, of: 3 });
    const fresh = applyHwEvent(applyHwEvent(up(), hwEvent("sensors.reading", { node: "r101_motion", kind: "occupancy", value: "clear" })), hwEvent("sensors.reading", { node: "r101_door", kind: "contact", value: "closed" }));
    const later = derive(fresh, new Date(Date.parse(T0) + 11 * 60_000), RULES); // climate reading is 11 min old
    expect(later.state.environment.sensors.reporting).toEqual({ count: 2, of: 3 });
    expect(later.state.room.status).toEqual({ level: "degraded", text: "Sensor not reporting" });
  });
  it("degraded: battery at 20 % (H16)", () => {
    const state = withEvent(hwEvent("zigbee.node", { ...node(up().state, "r101_door"), battery_pct: 20 }));
    expect(state.room.status).toEqual({ level: "degraded", text: "Sensor battery low" });
  });
});
