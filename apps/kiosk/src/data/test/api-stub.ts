import { vi } from "vitest";
import type { ApiClient } from "@/data/api-client";

/** An ApiClient whose every method is a `vi.fn()` (tests only). */
export function stubApi(): ApiClient {
  return {
    getSession: vi.fn(),
    login: vi.fn(),
    lock: vi.fn(),
    getState: vi.fn(),
    sendCommand: vi.fn(),
    connect: vi.fn(),
    ir: {
      listDevices: vi.fn(), createDevice: vi.fn(), createCommand: vi.fn(), learn: vi.fn(), cancelLearn: vi.fn(),
      test: vi.fn(), recordTest: vi.fn(),
    },
    schedule: {
      get: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(),
      deleteAction: vi.fn(),
    },
    devices: { list: vi.fn(), update: vi.fn(), remove: vi.fn(), permitJoin: vi.fn() },
    settings: { setRoomPin: vi.fn(), setTechnicianPin: vi.fn() },
    system: { network: vi.fn(), about: vi.fn(), restart: vi.fn(), shutdown: vi.fn(), reboot: vi.fn() },
  };
}
