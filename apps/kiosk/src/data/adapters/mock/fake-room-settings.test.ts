import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeRoom, MOCK_ADDRESS, MOCK_LATENCY_MAX_MS, MOCK_PERMIT_JOIN_MS, MOCK_RESTART_MS, MOCK_UPTIME_AT_START_S,
} from "./fake-room";

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

describe("FakeRoom PINs and system (S3d, S3b, S3e)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("PIN change: the new room and technician PINs are the ones login accepts", async () => {
    const { room, settle } = connected();
    await settle(room.setRoomPin("4321"));
    await settle(room.setTechnicianPin("654321"));
    expect(await settle(room.login({ level: "control", pin: "1234", label: "laptop" }))).toMatchObject({ reason: "wrong" });
    expect(await settle(room.login({ level: "control", pin: "4321", label: "laptop" }))).toMatchObject({ access: "control" });
    expect(await settle(room.login({ level: "technician", pin: "654321", label: "laptop" }))).toMatchObject({ access: "technician" });
  });

  it("PIN change refuses the wrong number of digits", async () => {
    const { room } = connected();
    await expect(room.setRoomPin("12345")).rejects.toThrow();
    await expect(room.setTechnicianPin("1234")).rejects.toThrow();
  });

  it("network lists this client among the connected clients (S3b)", async () => {
    const { room, settle } = connected();
    const network = await settle(room.network());
    expect(network).toMatchObject({ hostname: "r-101.local", address: MOCK_ADDRESS, connection: { kind: "ethernet" }, controller: { hw: "up" } });
    expect(network.clients.map((c) => c.label)).toEqual(["room screen", "phone", "phone", "laptop"]);
  });

  it("about: URL from the hostname, uptime counts (S3e)", async () => {
    const { room, settle } = connected();
    const about = await settle(room.about());
    expect(about).toMatchObject({ room: "R-101", url: "http://r-101.local" });
    expect(about.uptime_s).toBe(MOCK_UPTIME_AT_START_S + 1); // connect + one round trip = 1.2 s
  });

  it("restart answers, drops every socket, forgets the AC and accepts connections again (S3e, H3/H4, R3)", async () => {
    const { room, onClose, settle } = connected();
    await settle(room.restart());
    await vi.advanceTimersByTimeAsync(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(room.peek().environment.ac.power.confidence).toBe("unknown");

    const reconnect: ServerEvent[] = [];
    const refused = vi.fn();
    room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => reconnect.push(e), onClose: refused });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(refused).toHaveBeenCalledTimes(1); // still restarting

    await vi.advanceTimersByTimeAsync(MOCK_RESTART_MS);
    room.connect("laptop", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => reconnect.push(e), onClose: vi.fn() });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(reconnect.at(-1)?.type).toBe("snapshot");
    expect((await settle(room.about())).uptime_s).toBeLessThan(5);
  });
});
