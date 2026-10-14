import { describe, expect, it } from "vitest";
import { derive } from "../../src/domain/derive.ts";
import { transportChangeError } from "../../src/domain/devices.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import { bootModel, hwEvent, RULES, snapshotEvent, T0 } from "../helpers.ts";

const at = (ms: number) => new Date(Date.parse(T0) + ms);
const online = (model: ReturnType<typeof bootModel>, id: string) => model.state.devices.find((d) => d.id === id)?.online;

describe("H8 device online", () => {
  it("before hw reports anything: unknown; after the snapshot every device is online", () => {
    const boot = derive(bootModel(), new Date(T0), RULES);
    expect(online(boot, "lights")?.value).toBeNull();
    const up = derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES);
    expect(up.state.devices.every((d) => d.online.value === true)).toBe(true);
    expect(online(up, "ac")?.confidence).toBe("assumed");
    expect(up.state.devices.find((d) => d.id === "lights")?.outputs.map((o) => o.id)).toEqual(["lights.front", "lights.rear"]);
  });
  it.each([
    [hwEvent("zigbee.node", { ieee: "0xa4c1380f2b9e0001", friendly_name: "r101_lights", model: "ZBM5-2C-86W", role: "router", power_source: "mains", lqi: null, battery_pct: null, last_seen: T0, online: false }), ["lights"]],
    [hwEvent("ir.blaster", { online: false, lqi: null }), ["ir_blaster", "projector", "ac"]],
  ] as const)("%j takes %j offline", (event, ids) => {
    const model = derive(applyHwEvent(applyHwEvent(bootModel(), snapshotEvent()), event), new Date(T0), RULES);
    expect(model.state.devices.filter((d) => d.online.value === false).map((d) => d.id).sort()).toEqual([...ids].sort());
  });
  it("§6.7: hw down keeps values for the grace, then every device is offline and every value stale", () => {
    const up = derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES); // the store always holds a derived model
    const down = applyHwDown(up, T0);
    const early = derive(down, at(9_999), RULES);
    expect(early.state.devices.every((d) => d.online.value === true)).toBe(true);
    expect(early.state.room.status.text).toBe("Hardware service offline");
    const late = derive(down, at(10_000), RULES);
    expect(late.state.devices.every((d) => d.online.value === false && d.online.stale)).toBe(true);
    expect(late.state.environment.lights.front).toMatchObject({ value: true, stale: true });
    expect(late.state.display.projector.power.value?.watts).toBe(287); // last value kept
    expect(late.state.zigbee.coordinator.status).toBe("offline");
    const back = derive(applyHwEvent(late, snapshotEvent(at(20_000).toISOString())), at(20_000), RULES);
    expect(back.state.connection.hw).toBe("up");
    expect(back.state.devices.every((d) => d.online.value === true && !d.online.stale)).toBe(true);
    expect(back.state.environment.lights.front.stale).toBe(false);
  });
});

describe("R8 transport change", () => {
  it.each([
    ["ir_zs06", "ir_mcu", null],
    ["ir_mcu", "ir_zs06", null],
    ["zigbee", "zigbee", null],
    ["zigbee", undefined, null],
    ["ir_zs06", "zigbee", "Only IR devices change transport (ZS06 or MCU)"],
    ["zigbee", "ir_mcu", "Only IR devices change transport (ZS06 or MCU)"],
    ["local", "zigbee", "Only IR devices change transport (ZS06 or MCU)"],
  ] as const)("%s → %s: %s", (current, next, expected) => {
    expect(transportChangeError(current, next)).toBe(expected);
  });
});
