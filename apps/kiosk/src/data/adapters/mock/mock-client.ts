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
    ir: {
      listDevices: () => room.ir.listDevices(),
      createDevice: (input) => room.ir.createDevice(input),
      createCommand: (deviceId, input) => room.ir.createCommand(deviceId, input),
      learn: (commandId) => room.ir.learn(commandId),
      cancelLearn: (commandId) => room.ir.cancelLearn(commandId),
      test: (commandId) => room.ir.test(commandId),
      recordTest: (commandId, reacted) => room.ir.recordTest(commandId, reacted),
    },
    schedule: {
      get: () => room.schedule.get(),
      createBlock: (input) => room.schedule.createBlock(input),
      deleteBlock: (id) => room.schedule.deleteBlock(id),
      createAction: (input) => room.schedule.createAction(input),
      updateAction: (id, input) => room.schedule.updateAction(id, input),
      deleteAction: (id) => room.schedule.deleteAction(id),
    },
    devices: {
      list: () => room.listDevices(),
      update: (id, patch) => room.updateDevice(id, patch),
      remove: (id) => room.removeDevice(id),
      permitJoin: () => room.permitJoin(),
    },
    settings: {
      setRoomPin: (pin) => room.setRoomPin(pin),
      setTechnicianPin: (pin) => room.setTechnicianPin(pin),
    },
    system: {
      network: () => room.network(),
      about: () => room.about(),
      restart: () => room.restart(),
      shutdown: () => room.shutdown(),
      reboot: () => room.restart(),
    },
  };
}
