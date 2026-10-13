import { formatAgo } from "@/lib/format";

// S2.E14–E19: battery end devices (H8, H10, H11, H16, R13).

export type BatterySeverity = "ok" | "low" | "critical" | "unknown";

/** H16: ≤20% low (amber), ≤10% critical (red). */
export function batterySeverity(pct: number | null): BatterySeverity {
  if (pct === null) return "unknown";
  if (pct <= 10) return "critical";
  if (pct <= 20) return "low";
  return "ok";
}

/** S2.E16 LAST SEEN: `12s ago` (server time), `Offline · 5 min ago`, `Offline`, `—`. */
export function lastSeenText(lastSeen: string | null, online: boolean, now: Date): string {
  if (!online) return lastSeen === null ? "Offline" : `Offline · ${formatAgo(lastSeen, now)}`;
  return lastSeen === null ? "—" : formatAgo(lastSeen, now);
}
