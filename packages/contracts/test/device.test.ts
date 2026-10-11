import { describe, expect, it } from "vitest";
import { Device, DeviceKind, DevicePatch, OutputId } from "../src/domain/device.ts";
import { Room } from "../src/domain/room.ts";
import { obs } from "./helpers.ts";

const lights = {
  id: "lights",
  name: "Lighting switch",
  kind: "lights",
  transport: "zigbee",
  brand: null,
  model: "ZBM5-2C-86W",
  hw_ref: "r101_lights",
  online: obs(true),
  outputs: [
    { id: "lights.front", name: "Front of room", kind: "switch" },
    { id: "lights.rear", name: "Rear of room", kind: "switch" },
  ],
};

describe("Room", () => {
  it("accepts R-101 in normal status", () => {
    const room = { id: "R-101", hostname: "r-101.local", status: { level: "normal", text: "All systems normal" } };
    expect(Room.safeParse(room).success).toBe(true);
  });
  it("rejects an unknown status level", () => {
    const room = { id: "R-101", hostname: "r-101.local", status: { level: "ok", text: "" } };
    expect(Room.safeParse(room).success).toBe(false);
  });
});

describe("Device", () => {
  it("accepts the lighting switch", () => {
    expect(Device.safeParse(lights).success).toBe(true);
  });
  it("rejects an unknown transport", () => {
    expect(Device.safeParse({ ...lights, transport: "wifi" }).success).toBe(false);
  });
  it("accepts kind other (S3.E9)", () => {
    expect(DeviceKind.safeParse("other").success).toBe(true);
  });
  it("rejects an unknown output id", () => {
    expect(OutputId.safeParse("lights.middle").success).toBe(false);
  });
});

describe("DevicePatch", () => {
  it("accepts an empty patch and a rename + transport change", () => {
    expect(DevicePatch.safeParse({}).success).toBe(true);
    expect(DevicePatch.safeParse({ name: "Projector 2", transport: "ir_mcu" }).success).toBe(true);
  });
  it("rejects a blank name", () => {
    expect(DevicePatch.safeParse({ name: "   " }).success).toBe(false);
  });
});
