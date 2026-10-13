import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS, MOCK_PERMIT_JOIN_MS } from "./fake-room";

function connected() {
  const room = new FakeRoom({ random: () => 1 });
  const events: ServerEvent[] = [];
  const onClose = vi.fn();
  room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const last = (): RoomState => {
    const found = events.findLast((e) => e.type === "state" || e.type === "snapshot");
    if (found === undefined || (found.type !== "state" && found.type !== "snapshot")) throw new Error("no state");
    return found.state;
  };
  const settle = async <T>(promise: Promise<T>): Promise<T> => {
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    return promise;
  };
  return { room, events, last, settle, onClose };
}

describe("FakeRoom registry (S3d)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devices: rename and transport change reach the registry, the IR list and the state (S3d, R8)", async () => {
    const { room, last, events, settle } = connected();
    await settle(room.updateDevice("projector", { name: "Main projector", transport: "ir_mcu" }));
    expect(last().devices.find((d) => d.id === "projector")).toMatchObject({ name: "Main projector", transport: "ir_mcu" });
    expect((await settle(room.listDevices())).find((d) => d.id === "projector")?.name).toBe("Main projector");
    expect((await settle(room.ir.listDevices()))[1]).toMatchObject({ name: "Main projector", transport: "ir_mcu" });
    expect(events).toContainEqual({ type: "invalidate", keys: [["devices"], ["ir", "devices"]] });
  });

  it("devices: remove drops the device and its IR commands", async () => {
    const { room, last, settle } = connected();
    await settle(room.removeDevice("ac"));
    expect(last().devices.some((d) => d.id === "ac")).toBe(false);
    expect((await settle(room.ir.listDevices())).map((d) => d.device_id)).toEqual(["projector"]);
  });

  it("permit joining opens the mesh for 4 min, then closes it (S3d → S2.E21)", async () => {
    const { room, last, settle } = connected();
    await settle(room.permitJoin());
    expect(last().zigbee.mesh.joining).toEqual({ state: "open", until: new Date(Date.now() + MOCK_PERMIT_JOIN_MS).toISOString() });
    await vi.advanceTimersByTimeAsync(MOCK_PERMIT_JOIN_MS);
    expect(last().zigbee.mesh.joining).toEqual({ state: "closed" });
  });
});
