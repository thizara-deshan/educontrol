import type { IrCaptureStatus, ServerEvent } from "@eduscope/contracts";
import { createStore, type Store } from "@/lib/store";

// H21: the latest `ir_capture` push per command (ARCHITECTURE §4.5). Server state, never set
// from a tap; the row only dismisses an outcome it has shown ("Captured · now test it" once the
// technician presses Test).

export type IrCaptureEvent = Extract<ServerEvent, { type: "ir_capture" }>;

export interface CaptureEntry {
  status: IrCaptureStatus;
  /** Server time when listening ends (`listening` only). */
  deadline: string | null;
}

export interface IrCaptureStore {
  entries: Store<ReadonlyMap<string, CaptureEntry>>;
  apply(event: IrCaptureEvent): void;
  dismiss(commandId: string): void;
  /** H4: a snapshot clears every local overlay. */
  clear(): void;
}

export function createIrCaptureStore(): IrCaptureStore {
  const entries = createStore<ReadonlyMap<string, CaptureEntry>>(new Map());
  const without = (commandId: string): Map<string, CaptureEntry> => {
    const next = new Map(entries.get());
    next.delete(commandId);
    return next;
  };
  return {
    entries,
    apply(event) {
      if (event.status === "cancelled") {
        entries.set(without(event.command_id)); // back to the stored code's status
        return;
      }
      // Only one capture runs at a time (one blaster): a new `listening` replaces any other.
      const next = event.status === "listening" ? new Map<string, CaptureEntry>() : without(event.command_id);
      next.set(event.command_id, { status: event.status, deadline: event.deadline });
      entries.set(next);
    },
    dismiss(commandId) {
      if (entries.get().has(commandId)) entries.set(without(commandId));
    },
    clear() {
      if (entries.get().size > 0) entries.set(new Map());
    },
  };
}

export const irCaptureStore = createIrCaptureStore();
