import { describe, expect, it } from "vitest";
import { RoomState } from "../src/state.ts";
import { readFixture } from "./helpers.ts";

describe("room-normal.json", () => {
  it("room-normal.json parses as RoomState", () => {
    const result = RoomState.safeParse(readFixture("state/room-normal.json"));
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it("reproduces the screenshot 01/02 values", () => {
    const state = RoomState.parse(readFixture("state/room-normal.json"));
    const node = (name: string) => state.zigbee.nodes.find((n) => n.friendly_name === name);
    expect(state.room.status.text).toBe("All systems normal");
    expect(state.display.source.value).toBe("podium_pc");
    expect(state.display.projector.state.value).toBe("running");
    expect(state.display.projector.power.value).toMatchObject({ watts: 287, volts: 231, kwh_today: 1.84, rating_a: 13 });
    expect(state.display.screen.value).toBe("lowered");
    expect(state.audio.channels.mic.value).toBe(62);
    expect(state.audio.channels.pc.value).toBe(38);
    expect(state.environment.lights.front.value).toBe(true);
    expect(state.environment.lights.rear.value).toBe(false);
    expect(state.environment.ac.power).toMatchObject({ value: "on", confidence: "assumed" });
    expect(state.environment.ac.setpoint_c.value).toBe(24);
    expect(state.environment.sensors.temperature.value).toBe(26.4);
    expect(state.environment.sensors.humidity.value).toBe(61);
    expect(state.environment.sensors.occupancy.value).toBe("detected");
    expect(state.environment.sensors.contact.value).toBe("closed");
    expect(state.environment.sensors.reporting).toEqual({ count: 3, of: 3 });
    expect(node("r101_lights")?.lqi).toBe(214);
    expect(node("r101_proj_plug")?.lqi).toBe(231);
    expect(node("r101_temp")).toMatchObject({ battery_pct: 98, lqi: 168, last_seen: "2026-10-05T10:41:48Z" });
    expect(state.zigbee.mesh).toMatchObject({ paired: 5, routers: 2, end_devices: 3, joining: { state: "closed" } });
    expect(state.ir_blaster).toMatchObject({ id: "ZS06", lqi: 196, topic: "r101_ir" });
  });

  it("AC is never confirmed (R3)", () => {
    const state = RoomState.parse(readFixture("state/room-normal.json"));
    expect(state.environment.ac.power.confidence).not.toBe("confirmed");
    expect(state.environment.ac.setpoint_c.confidence).not.toBe("confirmed");
  });

  it("rejects a negative rev", () => {
    const state = RoomState.parse(readFixture("state/room-normal.json"));
    expect(RoomState.safeParse({ ...state, rev: -1 }).success).toBe(false);
  });
});
