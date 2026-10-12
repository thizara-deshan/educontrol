import type { AccessLevel } from "@eduscope/contracts";
import type { ConnectionStatus } from "./realtime/connection";

// useControlGate (ARCHITECTURE §4.5): ONE place decides whether a control is usable.
// UX only — core-api enforces every permission (CLAUDE.md).

export type GateReason = "disconnected" | "offline" | "locked";
export interface ControlGate {
  enabled: boolean;
  reason: GateReason | null;
}

export interface GateInput {
  connection: ConnectionStatus;
  /** `undefined` while the session is loading. */
  access: AccessLevel | undefined;
  /** `device.online.value` of the device behind the control; `undefined` = no device check. */
  deviceOnline?: boolean | null | undefined;
}

/** Priority: disconnected (H1–H3) > offline (H8) > locked (H12, view). */
export function computeControlGate(input: GateInput): ControlGate {
  if (input.connection !== "live" && input.connection !== "back_online") {
    return { enabled: false, reason: "disconnected" };
  }
  if (input.deviceOnline === false) return { enabled: false, reason: "offline" };
  if (input.access === undefined || input.access === "view") return { enabled: false, reason: "locked" };
  return { enabled: true, reason: null };
}

/**
 * `disabled` for a control: only while disconnected or offline. A `locked` (H12) control stays
 * tappable at full colour so the tap can open S4.
 */
export function gateDisablesControl(gate: ControlGate): boolean {
  return gate.reason === "disconnected" || gate.reason === "offline";
}
