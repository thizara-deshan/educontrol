import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { deriveRoomStatus } from "./mock-rules";

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
