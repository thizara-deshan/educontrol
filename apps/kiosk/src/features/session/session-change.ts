import type { AccessLevel, ClientType } from "@eduscope/contracts";

// What a change of `session.access` does on this client (SPEC §2.3, H24). Pure; the watcher
// hook applies the effects.

export interface SessionChange {
  /** `undefined` before the first session arrived. */
  prev: AccessLevel | undefined;
  next: AccessLevel;
  clientType: ClientType;
  /** The drop came from this client's own Lock tap (no toast for that). */
  ownLock: boolean;
}

export interface SessionChangeEffects {
  /** H24 toast "Locked · enter PIN to control". */
  toast: boolean;
  /** Technician was lost: leave `/settings/*` for `/` (SPEC §2.3, AC4). */
  leaveSettings: boolean;
}

export const SESSION_EXPIRED_TOAST = "Locked · enter PIN to control";

const NONE: SessionChangeEffects = { toast: false, leaveSettings: false };

export function sessionChangeEffects(change: SessionChange): SessionChangeEffects {
  if (change.prev === undefined || change.prev === change.next) return NONE;
  return {
    toast: !change.ownLock && change.clientType === "remote" && change.next === "view",
    leaveSettings: change.prev === "technician",
  };
}
