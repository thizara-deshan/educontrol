import { createStore, type Store } from "@/lib/store";
import type { ControlKey } from "./pending-store";

// H6a / H6b: a red inline line on the card for 6 s.
export const INLINE_ERROR_MS = 6000;
export const MESSAGE_FAILED = "Command failed";
export const MESSAGE_TIMED_OUT = "No response · tap to retry";

export interface InlineErrorStore {
  errors: Store<ReadonlyMap<ControlKey, string>>;
  show(key: ControlKey, message: string): void;
  dismiss(key: ControlKey): void;
}

export function createInlineErrorStore(durationMs: number = INLINE_ERROR_MS): InlineErrorStore {
  const errors = createStore<ReadonlyMap<ControlKey, string>>(new Map());
  const timers = new Map<ControlKey, ReturnType<typeof setTimeout>>();

  const dismiss = (key: ControlKey): void => {
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);
    if (!errors.get().has(key)) return;
    const next = new Map(errors.get());
    next.delete(key);
    errors.set(next);
  };

  return {
    errors,
    show(key, message) {
      dismiss(key);
      const next = new Map(errors.get());
      next.set(key, message);
      errors.set(next);
      timers.set(key, setTimeout(() => dismiss(key), durationMs));
    },
    dismiss,
  };
}

export const inlineErrorStore = createInlineErrorStore();
