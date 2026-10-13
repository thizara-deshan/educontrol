import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS, MOCK_STALE_AGE_MS } from "./fake-room";

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
  return { room, events, last };
}

describe("FakeRoom panel actions (S1 hidden states)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coordinator offline: fault, every Zigbee device and the blaster offline, no sensors reporting (H9)", () => {
    const { room, last } = connected();
    room.toggleCoordinatorOffline();
    const state = last();
    expect(state.room.status).toEqual({ level: "fault", text: "Coordinator offline" });
    expect(state.zigbee.coordinator.status).toBe("offline");
    expect(state.devices.find((d) => d.id === "lights")?.online.value).toBe(false);
    expect(state.devices.find((d) => d.id === "audio")?.online.value).toBe(true); // local, not Zigbee
    expect(state.ir_blaster.online.value).toBe(false);
    expect(state.environment.sensors.reporting).toEqual({ count: 0, of: 3 });
    room.toggleCoordinatorOffline();
    expect(last().room.status.level).toBe("normal");
  });

  it("blaster offline mirrors ir_blaster.online (H25)", () => {
    const { room, last } = connected();
    room.toggleDeviceOffline("ir_blaster");
    expect(last().ir_blaster.online.value).toBe(false);
    expect(last().room.status).toEqual({ level: "degraded", text: "ZS06 offline" });
  });

  it("climate stale backdates temperature + humidity by 14 min; 2 of 3 reporting (H10)", () => {
    const { room, last } = connected();
    room.toggleClimateStale();
    const { sensors } = last().environment;
    expect(sensors.temperature.stale).toBe(true);
    expect(sensors.humidity.stale).toBe(true);
    expect(Date.now() - new Date(sensors.temperature.at ?? 0).getTime()).toBe(MOCK_STALE_AGE_MS);
    expect(sensors.reporting).toEqual({ count: 2, of: 3 });
    room.toggleClimateStale();
    expect(last().environment.sensors.reporting).toEqual({ count: 3, of: 3 });
  });

  it("door toggles open/closed; no reading clears it (H11)", () => {
    const { room, last } = connected();
    room.toggleDoor();
    expect(last().environment.sensors.contact).toMatchObject({ kind: "contact", value: "open" });
    room.toggleDoor();
    expect(last().environment.sensors.contact).toMatchObject({ kind: "contact", value: "closed" });
    room.doorNoReading();
    expect(last().environment.sensors.contact).toMatchObject({ value: null, at: null });
  });

  it("source assumed, PC audio from phone, screen unknown, controller restart (AC unknown)", () => {
    const { room, events, last } = connected();
    room.sourceAssumed();
    expect(last().display.source.confidence).toBe("assumed");
    room.changePcAudioFromPhone();
    expect(last().audio.channels.pc).toMatchObject({ value: 80, changed_by: "phone" });
    expect(events.at(-1)).toEqual({ type: "activity", text: "PC audio set to 80", by: "phone", public_id: "mock-phone" });
    room.screenPositionUnknown();
    expect(last().display.screen).toMatchObject({ value: "unknown", confidence: "unknown" });
    room.restartController();
    expect(last().environment.ac.power).toMatchObject({ value: null, confidence: "unknown" });
    expect(last().environment.ac.setpoint_c.value).toBeNull();
  });
});
