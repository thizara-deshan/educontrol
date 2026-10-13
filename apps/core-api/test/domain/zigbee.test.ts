import { HwSnapshot } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { deriveMesh, placeholderCoordinator, upsertNode } from "../../src/domain/zigbee.ts";
import { hwFixture, must, T0 } from "../helpers.ts";

const nodes = HwSnapshot.parse(hwFixture("response.snapshot.json")).zigbee.nodes; // R-101: 2 routers, 3 end devices

describe("S2 mesh", () => {
  it("counts paired nodes by role, online or not (M05-L2)", () => {
    const offline = nodes.map((node) => (node.friendly_name === "r101_lights" ? { ...node, online: false } : node));
    expect(deriveMesh(offline, null, new Date(T0))).toEqual({ paired: 5, routers: 2, end_devices: 3, joining: { state: "closed" } });
  });
  it("joining is open until the deadline, closed after", () => {
    const until = "2026-10-05T10:46:00.000Z";
    expect(deriveMesh(nodes, until, new Date(T0)).joining).toEqual({ state: "open", until });
    expect(deriveMesh(nodes, until, new Date(until)).joining).toEqual({ state: "closed" });
  });
  it("upsertNode replaces by IEEE address or appends", () => {
    const first = must(nodes[0]);
    expect(upsertNode(nodes, { ...first, lqi: 99 })[0]?.lqi).toBe(99);
    expect(upsertNode(nodes, { ...first, ieee: "0xnew" })).toHaveLength(6);
  });
  it("before hw reports, the coordinator is the registry model, offline", () => {
    expect(placeholderCoordinator("ZG-808Z", "zigbee-coord")).toMatchObject({ model: "ZG-808Z", port: "zigbee-coord", status: "offline" });
  });
});
