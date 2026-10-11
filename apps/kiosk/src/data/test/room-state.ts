import { RoomState } from "@eduscope/contracts";
import roomNormal from "@eduscope/contracts/fixtures/state/room-normal.json";

/** A fresh, parsed copy of the golden fixture (screenshot 01) for tests. */
export function roomState(overrides: Partial<RoomState> = {}): RoomState {
  return { ...RoomState.parse(roomNormal), ...overrides };
}
