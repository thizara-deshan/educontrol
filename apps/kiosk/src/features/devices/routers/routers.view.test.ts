import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { gangTileView, routerHeaderView } from "./routers.view";

const NOW = new Date("2026-10-05T10:42:00Z");

function lights() {
  const state = roomState();
  const device = state.devices.find((d) => d.id === "lights");
  if (device === undefined) throw new Error("fixture has no lights device");
  return { state, device, node: state.zigbee.nodes.find((n) => n.friendly_name === device.hw_ref) };
}

describe("routerHeaderView (S2.E6/E10)", () => {
  it("online: green dot, ids, `LQI 214`", () => {
    const { device, node } = lights();
    expect(routerHeaderView(device, node, NOW)).toEqual({
      title: "Lighting switch", ids: "ZBM5-2C-86W · r101_lights", online: true, tone: "confirmed", link: "LQI 214",
    });
  });
  it("offline: red dot, `Offline · last seen 5 min ago` instead of LQI", () => {
    const { device, node } = lights();
    if (node === undefined) throw new Error("fixture has no r101_lights node");
    const view = routerHeaderView(device, { ...node, online: false, last_seen: "2026-10-05T10:37:00Z" }, NOW);
    expect(view).toMatchObject({ online: false, tone: "offline", link: "Offline · last seen 5 min ago" });
  });
  it("no node paired: offline, ids from the registry", () => {
    const { device } = lights();
    expect(routerHeaderView(device, undefined, NOW)).toMatchObject({ ids: "ZBM5-2C-86W · r101_lights", link: "Offline", online: false });
  });
});

describe("gangTileView (S2.E7/E8/E11)", () => {
  it("front On (green fill), rear Off (neutral), unknown", () => {
    const { state } = lights();
    expect(gangTileView(state.environment.lights.front)).toEqual({ tone: "confirmed", text: "On", fill: "confirmed" });
    expect(gangTileView(state.environment.lights.rear)).toEqual({ tone: "off", text: "Off", fill: null });
    expect(gangTileView({ ...state.environment.lights.rear, value: null, confidence: "unknown" })).toEqual({
      tone: "unknown", text: "Unknown", fill: null,
    });
  });
});
