import type { AccessLevel } from "@eduscope/contracts";

// useRequireAccess's decision table (ARCHITECTURE §4.7, SPEC §2.3/R14). UX only: core-api
// enforces every permission (CLAUDE.md). M08 swaps the mock session for /api/session, not this.

/** The levels a PIN can grant; `view` needs no PIN. */
export type RequiredAccess = Exclude<AccessLevel, "view">;
/** `granted` = go on; `prompt` = open S4 for this level; `wait` = the session is still loading. */
export type AccessDecision = "granted" | "prompt" | "wait";

const RANK: Record<AccessLevel, number> = { view: 0, control: 1, technician: 2 };

export function decideAccess(required: RequiredAccess, access: AccessLevel | undefined): AccessDecision {
  if (access === undefined) return "wait";
  return RANK[access] >= RANK[required] ? "granted" : "prompt";
}
