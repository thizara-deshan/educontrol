import { describe, expect, it } from "vitest";
import { Interlock } from "../src/domain/interlock.ts";
import { Coordinator, Mesh, ZigbeeNode } from "../src/domain/zigbee.ts";
import { AT } from "./helpers.ts";

const lightsNode = {
  ieee: "0xa4c1380f2b9e0001",
  friendly_name: "r101_lights",
  model: "ZBM5-2C-86W",
  role: "router",
  power_source: "mains",
  lqi: 214,
  battery_pct: null,
  last_seen: AT,
  online: true,
};

describe("zigbee", () => {
  it("accepts the lighting switch node", () => {
    expect(ZigbeeNode.safeParse(lightsNode).success).toBe(true);
  });
  it("rejects an LQI above 255", () => {
    expect(ZigbeeNode.safeParse({ ...lightsNode, lqi: 256 }).success).toBe(false);
  });
  it("accepts the ZG-808Z coordinator", () => {
    const coordinator = {
      model: "ZG-808Z", chipset: "CC2652P1", firmware: "Z-Stack 3.x.0", channel: 25,
      tx_power_dbm: 20, port: "zigbee-coord", antenna: "SMA, external", status: "online",
    };
    expect(Coordinator.safeParse(coordinator).success).toBe(true);
  });
  it("requires `until` only when joining is open", () => {
    const base = { paired: 5, routers: 2, end_devices: 3 };
    expect(Mesh.safeParse({ ...base, joining: { state: "closed" } }).success).toBe(true);
    expect(Mesh.safeParse({ ...base, joining: { state: "open", until: AT } }).success).toBe(true);
    expect(Mesh.safeParse({ ...base, joining: { state: "open" } }).success).toBe(false);
  });
  it("rejects an unknown interlock status", () => {
    expect(Interlock.safeParse({ status: "armed", rule_text: "x" }).success).toBe(true);
    expect(Interlock.safeParse({ status: "off", rule_text: "x" }).success).toBe(false);
  });
});
