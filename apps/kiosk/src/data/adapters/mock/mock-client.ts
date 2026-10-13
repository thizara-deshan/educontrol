import type { ApiClient } from "@/data/api-client";
import { FakeRoom } from "./fake-room";
import { readTimeScale } from "./time-scale";

/** The one FakeRoom of this page; the mock panel drives it directly. */
export const fakeRoom = new FakeRoom({ timeScale: readTimeScale(window.location.search, import.meta.env.DEV) });

export function createMockApiClient(room: FakeRoom = fakeRoom): ApiClient {
  return {
    getSession: () => room.getSession(),
    login: (request) => room.login(request),
    lock: () => room.lock(),
    getState: () => room.getState(),
    sendCommand: (request) => room.sendCommand(request),
    connect: (label, handlers) => room.connect(label, handlers),
  };
}
