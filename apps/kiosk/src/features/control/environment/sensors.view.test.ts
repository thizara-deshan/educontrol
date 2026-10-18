import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { reportingLine, sensorsView } from "./sensors.view";

const NOW = new Date("2026-10-05T10:42:00Z");

describe("reportingLine (S1.E41)", () => {
  it("all reporting: green, `3 reporting`", () => {
    expect(reportingLine({ count: 3, of: 3 })).toEqual({ tone: "confirmed", text: "3 reporting" });
  });
  it("some: amber, `2 of 3 reporting`", () => {
    expect(reportingLine({ count: 2, of: 3 })).toEqual({ tone: "warning", text: "2 of 3 reporting" });
  });
  it("none: red, `No sensors reporting`", () => {
    expect(reportingLine({ count: 0, of: 3 })).toEqual({ tone: "offline", text: "No sensors reporting" });
  });
});

describe("sensorsView (S1.E42–E45)", () => {
  it("screenshot 01 values with model captions", () => {
    const { environment, devices, zigbee } = roomState();
    expect(sensorsView(environment.sensors, devices, zigbee.nodes, NOW).tiles).toEqual([
      { kind: "temperature", label: "Temperature", value: "26.4°", caption: "SNZB-02P", tone: "default", numeric: true, suffix: null },
      { kind: "humidity", label: "Humidity", value: "61%", caption: "SNZB-02P", tone: "default", numeric: true, suffix: null },
      { kind: "occupancy", label: "Occupancy", value: "Detected", caption: "SNZB-03P", tone: "accent", numeric: false, suffix: null },
      { kind: "contact", label: "Door", value: "Closed", caption: "SNZB-04PR2", tone: "default", numeric: false, suffix: null },
    ]);
  });
  it("stale reading: `14 min ago` suffix (H10)", () => {
    const { environment, devices, zigbee } = roomState();
    const temperature = { ...environment.sensors.temperature, stale: true, at: "2026-10-05T10:28:00Z" };
    const view = sensorsView({ ...environment.sensors, temperature }, devices, zigbee.nodes, NOW);
    expect(view.tiles[0]?.suffix).toBe("14 min ago");
  });
  it("no reading ever: value null (H11)", () => {
    const { environment, devices, zigbee } = roomState();
    const contact = { kind: "contact" as const, value: null, node: "r101_door", at: null, stale: false };
    expect(sensorsView({ ...environment.sensors, contact }, devices, zigbee.nodes, NOW).tiles[3]).toMatchObject({ value: null, suffix: null });
  });
  it("door open is amber, occupancy clear is plain", () => {
    const { environment, devices, zigbee } = roomState();
    const contact = { ...environment.sensors.contact, kind: "contact" as const, value: "open" as const };
    const occupancy = { ...environment.sensors.occupancy, kind: "occupancy" as const, value: "clear" as const };
    const tiles = sensorsView({ ...environment.sensors, contact, occupancy }, devices, zigbee.nodes, NOW).tiles;
    expect(tiles[3]).toMatchObject({ value: "Open", tone: "warn" });
    expect(tiles[2]).toMatchObject({ value: "Clear", tone: "default" });
  });
  it("offline sensor device: `offline` suffix (H8/H9)", () => {
    const { environment, devices, zigbee } = roomState();
    const offline = devices.map((d) => (d.id === "room_climate" ? { ...d, online: { ...d.online, value: false } } : d));
    const tiles = sensorsView(environment.sensors, offline, zigbee.nodes, NOW).tiles;
    expect(tiles[0]?.suffix).toBe("offline");
    expect(tiles[1]?.suffix).toBe("offline");
    expect(tiles[2]?.suffix).toBeNull();
  });
  it("sensor removed from the registry: caption and offline come from its node, not its friendly name", () => {
    const { environment, devices, zigbee } = roomState();
    const registry = devices.filter((d) => d.id !== "room_climate" && d.id !== "door");
    const nodes = zigbee.nodes.map((n) => (n.friendly_name === "r101_door" ? { ...n, online: false } : n));
    const tiles = sensorsView(environment.sensors, registry, nodes, NOW).tiles;
    expect(tiles.map((t) => t.caption)).toEqual(["SNZB-02P", "SNZB-02P", "SNZB-03P", "SNZB-04PR2"]);
    expect(tiles.map((t) => t.suffix)).toEqual([null, null, null, "offline"]);
  });
});
