import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_JOIN_WINDOW_MS, MOCK_LATENCY_MAX_MS, MOCK_STALE_AGE_MS } from "./fake-room";
import { NODE_OFFLINE_AGE_MS } from "./mock-rules";

function connected() {
  const room = new FakeRoom({ random: () => 1 });
  const events: ServerEvent[] = [];
  room.connect("phone", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const last = (): RoomState => {
    const found = events.findLast((e) => e.type === "state" || e.type === "snapshot");
    if (found === undefined || (found.type !== "state" && found.type !== "snapshot")) throw new Error("no state");
    return found.state;
  };
  return { room, last };
}

const node = (state: RoomState, name: string) => state.zigbee.nodes.find((n) => n.friendly_name === name);

describe("FakeRoom: Zigbee nodes follow the room (S2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with node ages as in the fixture (r101_temp seen 12 s before the snapshot)", () => {
    const { last } = connected();
    const state = last();
    const age = Date.parse(state.server_time) - Date.parse(node(state, "r101_temp")?.last_seen ?? "");
    expect(age).toBe(12_000 + MOCK_LATENCY_MAX_MS);
  });

  it("lights offline takes its router node offline, last seen 5 min ago (S2.E6, R7)", () => {
    const { room, last } = connected();
    room.toggleDeviceOffline("lights");
    expect(node(last(), "r101_lights")).toMatchObject({ online: false, last_seen: new Date(Date.now() - NODE_OFFLINE_AGE_MS).toISOString() });
    expect(node(last(), "r101_proj_plug")?.online).toBe(true);
    room.toggleDeviceOffline("lights");
    expect(node(last(), "r101_lights")?.online).toBe(true);
  });

  it("coordinator offline takes every node offline (H9)", () => {
    const { room, last } = connected();
    room.toggleCoordinatorOffline();
    expect(last().zigbee.nodes.every((n) => !n.online)).toBe(true);
  });

  it("climate stale backdates the r101_temp node too (H10)", () => {
    const { room, last } = connected();
    room.toggleClimateStale();
    expect(node(last(), "r101_temp")?.last_seen).toBe(new Date(Date.now() - MOCK_STALE_AGE_MS).toISOString());
  });
});

describe("FakeRoom panel actions (S2 hidden states)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("battery 18% / 8% degrade the room; 98% restores it (H16)", () => {
    const { room, last } = connected();
    room.setBattery("r101_temp", 18);
    expect(node(last(), "r101_temp")?.battery_pct).toBe(18);
    expect(last().room.status).toEqual({ level: "degraded", text: "Sensor battery low" });
    room.setBattery("r101_temp", 8);
    expect(node(last(), "r101_temp")?.battery_pct).toBe(8);
    room.setBattery("r101_temp", 98);
    expect(last().room.status.level).toBe("normal");
  });

  it("no battery devices: only the two routers remain (S2.E19)", () => {
    const { room, last } = connected();
    room.noBatteryDevices();
    expect(last().zigbee.nodes.map((n) => n.friendly_name)).toEqual(["r101_lights", "r101_proj_plug"]);
    expect(last().zigbee.mesh).toMatchObject({ paired: 2, routers: 2, end_devices: 0 });
  });

  it("coordinator starting ↔ online (S2.E3)", () => {
    const { room, last } = connected();
    room.toggleCoordinatorStarting();
    expect(last().zigbee.coordinator.status).toBe("starting");
    room.toggleCoordinatorStarting();
    expect(last().zigbee.coordinator.status).toBe("online");
  });

  it("joining opens for 4:12 and closes by itself (S2.E21)", () => {
    const { room, last } = connected();
    room.openJoining();
    expect(last().zigbee.mesh.joining).toEqual({ state: "open", until: new Date(Date.now() + MOCK_JOIN_WINDOW_MS).toISOString() });
    vi.advanceTimersByTime(MOCK_JOIN_WINDOW_MS);
    expect(last().zigbee.mesh.joining).toEqual({ state: "closed" });
  });

  it("interlock holding at 112 W while cooling; again → running, armed (H15)", () => {
    const { room, last } = connected();
    room.toggleInterlockHolding();
    expect(last().interlock.status).toBe("holding");
    expect(last().display.projector.power.value?.watts).toBe(112);
    expect(last().display.projector.state.value).toBe("cooling_down");
    room.toggleInterlockHolding();
    expect(last().interlock.status).toBe("armed");
    expect(last().display.projector.power.value?.watts).toBe(287);
  });

  it("interlock bypassed ↔ armed (S2.E23)", () => {
    const { room, last } = connected();
    room.toggleInterlockBypassed();
    expect(last().interlock.status).toBe("bypassed");
    room.toggleInterlockBypassed();
    expect(last().interlock.status).toBe("armed");
  });
});
