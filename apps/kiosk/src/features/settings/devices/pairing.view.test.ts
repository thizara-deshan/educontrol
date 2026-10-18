import type { ZigbeeNode } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { pairingRows } from "./pairing.view";

const NOW = new Date("2026-10-18T09:00:00Z");
const devices = roomState().devices;

function node(friendly_name: string, model: string, patch: Partial<ZigbeeNode> = {}): ZigbeeNode {
  return {
    ieee: `0x${friendly_name}`, friendly_name, model, role: "end_device", power_source: "battery",
    lqi: null, battery_pct: null, last_seen: null, online: true, ...patch,
  };
}
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

/** What the real zigbee_status driver reports on R-101: the four devices zigbee2mqtt knows. */
const R101 = [
  node("r101_ir", "ZS06", { role: "router", power_source: "mains", last_seen: ago(10_000) }),
  node("r101_temp", "SNZB-02P", { last_seen: ago(60_000) }),
  node("r101_door", "SNZB-04PR2", { last_seen: ago(61_000) }),
  node("r101_motion", "SNZB-03P"),
];

describe("pairingRows (PLAN-H05 D3)", () => {
  it("one row per registry Zigbee device the coordinator reports, in registry order", () => {
    expect(pairingRows(devices, R101, NOW).map((row) => [row.id, row.hwRef, row.model])).toEqual([
      ["room_climate", "r101_temp", "SNZB-02P"],
      ["motion", "r101_motion", "SNZB-03P"],
      ["door", "r101_door", "SNZB-04PR2"],
      ["ir_blaster", "r101_ir", "ZS06"],
    ]);
  });

  it("heard within 60 s → just now; older → last heard; none → not heard yet", () => {
    const status = Object.fromEntries(pairingRows(devices, R101, NOW).map((row) => [row.hwRef, [row.tone, row.status]]));
    expect(status).toEqual({
      r101_ir: ["confirmed", "Heard just now"],
      r101_temp: ["confirmed", "Heard just now"],
      r101_door: ["off", "Last heard 1 min ago"],
      r101_motion: ["unknown", "Not heard yet"],
    });
  });

  it("offline unless it was heard just now (a rejoining device speaks before availability catches up)", () => {
    const offline = [node("r101_door", "SNZB-04PR2", { online: false, last_seen: ago(3_600_000) })];
    expect(pairingRows(devices, offline, NOW)[0]).toMatchObject({ tone: "offline", status: "Offline" });
    const back = [node("r101_door", "SNZB-04PR2", { online: false, last_seen: ago(5_000) })];
    expect(pairingRows(devices, back, NOW)[0]).toMatchObject({ tone: "confirmed", status: "Heard just now" });
  });

  it("reset steps by model; an unknown model points to the manual", () => {
    const steps = Object.fromEntries(pairingRows(devices, R101, NOW).map((row) => [row.hwRef, row.resetSteps]));
    expect(steps.r101_temp).toBe("Hold the button about 5 s until the LED flashes.");
    expect(steps.r101_ir).toBe("Hold the reset pin about 5 s until the LED flashes fast.");
    const odd = [node("r101_motion", "SNZB-03PX")];
    expect(pairingRows(devices, odd, NOW)[0]?.resetSteps).toBe("See the device manual.");
  });

  it("no rows when the coordinator reports none of the registry's devices", () => {
    expect(pairingRows(devices, [node("0x1234", "TS0601")], NOW)).toEqual([]);
  });
});
