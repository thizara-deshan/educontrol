import { createStore, type Store } from "@/lib/store";
import type { RequiredAccess } from "./decide-access";

// The one open S4 request (ARCHITECTURE §4.7). `ensure()` asks here; PinOverlay renders the
// current request and finishes it. The tapped action is never replayed: callers only learn
// whether access was granted.

export interface PinRequest {
  /** Changes for every new request, so the overlay starts empty each time. */
  id: number;
  level: RequiredAccess;
}

export interface PinRequests {
  current: Store<PinRequest | null>;
  /** Opens S4 for `level`. Resolves `true` after a successful PIN, `false` on cancel. */
  request(level: RequiredAccess): Promise<boolean>;
  /** Closes S4 and resolves the open request. No-op when none is open. */
  finish(granted: boolean): void;
}

export function createPinRequests(): PinRequests {
  const current = createStore<PinRequest | null>(null);
  let open: { promise: Promise<boolean>; resolve: (granted: boolean) => void } | null = null;
  let seq = 0;

  const finish = (granted: boolean): void => {
    const pending = open;
    open = null;
    current.set(null);
    pending?.resolve(granted);
  };

  return {
    current,
    request(level) {
      const shown = current.get();
      // A second tap while S4 is open for the same level joins the open request.
      if (open !== null && shown !== null && shown.level === level) return open.promise;
      if (open !== null) finish(false);
      let resolve: (granted: boolean) => void = () => undefined;
      const promise = new Promise<boolean>((r) => {
        resolve = r;
      });
      open = { promise, resolve };
      current.set({ id: ++seq, level });
      return promise;
    },
    finish,
  };
}

/** The page's PIN requests. */
export const pinRequests = createPinRequests();
