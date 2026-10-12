import type { ApiClient } from "@/data/api-client";
import { FakeRoom } from "./fake-room";

/** The one FakeRoom of this page; the mock panel drives it directly. */
export const fakeRoom = new FakeRoom();

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
