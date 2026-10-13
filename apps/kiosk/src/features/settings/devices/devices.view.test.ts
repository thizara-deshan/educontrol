import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { devicePatch, permitJoinView, registryRow, transportChoices } from "./devices.view";

const devices = roomState().devices;
const byId = (id: string) => {
  const device = devices.find((d) => d.id === id);
  if (device === undefined) throw new Error(id);
  return device;
};

describe("registry rows (S3d)", () => {
  it("name, kind, transport, hardware id or friendly name", () => {
    expect(registryRow(byId("lights"))).toEqual({ id: "lights", name: "Lighting switch", kind: "Lights", transport: "Zigbee", hardwareId: "r101_lights" });
    expect(registryRow(byId("projector"))).toMatchObject({ kind: "Projector", transport: "ZS06", hardwareId: "—" });
    expect(registryRow(byId("hdmi_switch"))).toMatchObject({ transport: "Local" });
  });
});

describe("edit sheet", () => {
  it("IR devices choose ZS06 / MCU; others are fixed", () => {
    expect(transportChoices("ir_zs06")?.map((c) => c.label)).toEqual(["ZS06", "MCU"]);
    expect(transportChoices("zigbee")).toBeNull();
  });
  it("patch holds only what changed", () => {
    const projector = byId("projector");
    expect(devicePatch(projector, { name: "Projector", transport: "ir_zs06" })).toEqual({ ok: true, patch: null });
    expect(devicePatch(projector, { name: " Main projector ", transport: "ir_mcu" })).toEqual({
      ok: true, patch: { name: "Main projector", transport: "ir_mcu" },
    });
  });
  it("refuses an empty or long name", () => {
    const projector = byId("projector");
    expect(devicePatch(projector, { name: " ", transport: "ir_zs06" })).toEqual({ ok: false, error: "Enter a name" });
    expect(devicePatch(projector, { name: "x".repeat(41), transport: "ir_zs06" })).toEqual({ ok: false, error: "40 characters at most" });
  });
});

describe("permitJoinView", () => {
  const now = new Date("2026-10-13T09:00:00Z");
  it("closed → the button; open → the countdown", () => {
    expect(permitJoinView({ state: "closed" }, now)).toEqual({ label: "Permit joining", open: false });
    expect(permitJoinView({ state: "open", until: "2026-10-13T09:03:59Z" }, now)).toEqual({ label: "Joining open · 3:59 left", open: true });
  });
});
