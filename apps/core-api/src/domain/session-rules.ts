import type { AccessLevel, ClientType } from "@eduscope/contracts";

// SPEC §2.3 session ends (R14) and the kiosk exemption (ARCHITECTURE §5, D-09). Pure.
// The class-block end (§2.3) is added by the M09 scheduler.

export const CONTROL_IDLE_MS = 2 * 60 * 60_000;
export const TECHNICIAN_IDLE_MS = 15 * 60_000;
export const KIOSK_TECHNICIAN_IDLE_MS = 2 * 60_000;
/** Rows of browsers that never unlocked are dropped after this (they get a new row on return). */
export const VIEW_ROW_TTL_MS = 7 * 24 * 60 * 60_000;

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** The request comes from the kiosk: the flag is on AND the socket peer is loopback (never a header). */
export function isKioskRequest(remoteAddress: string | undefined, localhostIsKiosk: boolean): boolean {
  return localhostIsKiosk && remoteAddress !== undefined && LOOPBACK.has(remoteAddress);
}

/** What a client has with no PIN: the kiosk is always control (R14), a remote browser is view. */
export function baselineAccess(clientType: ClientType): AccessLevel {
  return clientType === "kiosk" ? "control" : "view";
}

/** When an unlocked session ends if nothing happens (null = never). */
export function expiresAt(access: AccessLevel, clientType: ClientType, lastActivity: Date): Date | null {
  if (access === "technician") {
    return new Date(lastActivity.getTime() + (clientType === "kiosk" ? KIOSK_TECHNICIAN_IDLE_MS : TECHNICIAN_IDLE_MS));
  }
  if (access === "control" && clientType === "remote") return new Date(lastActivity.getTime() + CONTROL_IDLE_MS);
  return null;
}

/** A stored row is honoured only by the same kind of client: a kiosk row only from the kiosk. */
export function rowMatches(rowClientType: ClientType, kioskRequest: boolean): boolean {
  return rowClientType === (kioskRequest ? "kiosk" : "remote");
}

export function hasAccess(have: AccessLevel, need: AccessLevel): boolean {
  const rank: Record<AccessLevel, number> = { view: 0, control: 1, technician: 2 };
  return rank[have] >= rank[need];
}
