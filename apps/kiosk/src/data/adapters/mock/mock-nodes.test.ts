import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { deriveRoomStatus, NODE_OFFLINE_AGE_MS, rebaseNodeTimes, withNodesOnline } from "./mock-rules";

describe("mock room status: low battery (H16)", () => {
  it("a battery at 20% or less degrades the room: `Sensor battery low`", () => {
    const base = roomState();
    const withBattery = (pct: number) => ({
      ...base,
      zigbee: { ...base.zigbee, nodes: base.zigbee.nodes.map((n) => (n.friendly_name === "r101_temp" ? { ...n, battery_pct: pct } : n)) },
    });
    expect(deriveRoomStatus(withBattery(21))).toEqual({ level: "normal", text: "All systems normal" });
    expect(deriveRoomStatus(withBattery(20))).toEqual({ level: "degraded", text: "Sensor battery low" });
    expect(deriveRoomStatus(withBattery(8))).toEqual({ level: "degraded", text: "Sensor battery low" });
  });
});

const NOW = Date.parse("2026-10-13T09:00:00Z");

describe("mock Zigbee nodes (S2)", () => {
  it("rebases last_seen so every node keeps its age (fixture r101_temp is 12 s old)", () => {
    const state = rebaseNodeTimes(roomState(), NOW);
    const temp = state.zigbee.nodes.find((n) => n.friendly_name === "r101_temp");
    expect(temp?.last_seen).toBe("2026-10-13T08:59:48.000Z");
  });

  it("offline nodes were last seen 5 min ago; back online = seen now", () => {
    const off = withNodesOnline(roomState(), new Set(["r101_lights"]), false, NOW);
    const lights = off.zigbee.nodes.find((n) => n.friendly_name === "r101_lights");
    expect(lights).toMatchObject({ online: false, last_seen: new Date(NOW - NODE_OFFLINE_AGE_MS).toISOString() });
    expect(off.zigbee.nodes.find((n) => n.friendly_name === "r101_proj_plug")?.online).toBe(true);
    const on = withNodesOnline(off, new Set(["r101_lights"]), true, NOW);
    expect(on.zigbee.nodes.find((n) => n.friendly_name === "r101_lights")).toMatchObject({ online: true, last_seen: new Date(NOW).toISOString() });
  });
});
