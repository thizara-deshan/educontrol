import type { ClientLabel, ClientSession, LoginResult } from "@eduscope/contracts";
import type { ApiClient } from "@/data/api-client";
import { createStore, type Store } from "@/lib/store";
import type { RequiredAccess } from "./decide-access";

// Login (S4) and Lock (S1.E8). The returned session is server state, so writing it into
// `["session"]` is not optimistic. Every check happens in core-api (M08).

/** Toast when Lock gets no answer. */
export const LOCK_FAILED_MESSAGE = "Couldn't lock · try again";

/** H17 fallback when a locked answer carries no `retry_after_s`. */
export const DEFAULT_LOCKOUT_S = 60;

export type LoginOutcome =
  | { kind: "ok"; session: ClientSession }
  | { kind: "wrong"; attemptsLeft: number | null }
  | { kind: "locked"; retryAfterS: number }
  | { kind: "error" };

export interface SessionActionDeps {
  api: Pick<ApiClient, "login" | "lock">;
  setSession(session: ClientSession): void;
  /** Set while this client's own Lock is in flight, so the drop it causes shows no H24 toast. */
  localLock: Store<boolean>;
}

export async function login(deps: SessionActionDeps, level: RequiredAccess, pin: string, label: ClientLabel): Promise<LoginOutcome> {
  let result: LoginResult;
  try {
    result = await deps.api.login({ level, pin, label });
  } catch {
    return { kind: "error" };
  }
  if ("reason" in result) {
    return result.reason === "locked"
      ? { kind: "locked", retryAfterS: result.retry_after_s ?? DEFAULT_LOCKOUT_S }
      : { kind: "wrong", attemptsLeft: result.attempts_left };
  }
  deps.setSession(result);
  return { kind: "ok", session: result };
}

/** `true` when the server confirmed the lock. */
export async function lock(deps: SessionActionDeps): Promise<boolean> {
  deps.localLock.set(true);
  try {
    deps.setSession(await deps.api.lock());
    return true;
  } catch {
    deps.localLock.set(false);
    return false;
  }
}

/** The page's "own Lock in flight" flag (read and cleared by the session watcher). */
export const localLockStore = createStore(false);

/** `true` once after this client's own Lock; clears the flag. */
export function consumeLocalLock(store: Store<boolean> = localLockStore): boolean {
  const was = store.get();
  store.set(false);
  return was;
}
