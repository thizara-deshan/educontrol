import type { RoomState, ServerEvent } from "@eduscope/contracts";

/** What the FakeRoom gives its settings stores (fake-ir, fake-schedule): one state, one event stream. */
export interface MockHost {
  state(): RoomState;
  /** Derive, bump rev and push `state` (FakeRoom.commit). */
  commit(next: RoomState): void;
  emit(event: ServerEvent): void;
  /** One mock round trip (200–600 ms). */
  delay(): Promise<void>;
  now(): number;
}
