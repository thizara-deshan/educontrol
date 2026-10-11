import type { ChangedBy } from "@eduscope/contracts";

// SPEC §3.2 formats. Local getters: the browser and the Pi are in the same room (same zone).
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** S1.E2: 24 h `HH:mm`, e.g. `10:42`. */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** S1.E3: `ddd d MMM`, e.g. `Mon 5 Oct`. */
export function formatDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()] ?? ""} ${date.getDate()} ${MONTHS[date.getMonth()] ?? ""}`;
}

/** `287 W`; unknown → `— W` (S1.E13). */
export function formatWatts(watts: number | null): string {
  return watts === null ? "— W" : `${Math.round(watts)} W`;
}

/** `26.4°` (1 dp, sensors) or `24°` (0 dp, setpoint); unknown → `—`. */
export function formatCelsius(celsius: number | null, decimals: 0 | 1 = 1): string {
  return celsius === null ? "—" : `${celsius.toFixed(decimals)}°`;
}

/** `61%`; unknown → `—`. */
export function formatPercent(percent: number | null): string {
  return percent === null ? "—" : `${Math.round(percent)}%`;
}

/** Stale suffix value (SPEC §3.4, H10): `12s ago`, `14 min ago`, `3 h ago`, `2 d ago`. */
export function formatAgo(fromIso: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** H13 attribution suffix: `from phone`, `by hand`, `by schedule`. */
export function formatAttribution(by: ChangedBy): string {
  if (by === "by hand") return "by hand";
  if (by === "schedule") return "by schedule";
  return `from ${by}`;
}

/** H13 toast copy: "Rear of room turned on · from phone". */
export function formatActivity(text: string, by: ChangedBy): string {
  return `${text} · ${formatAttribution(by)}`;
}
