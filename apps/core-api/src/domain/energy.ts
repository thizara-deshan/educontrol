import type { KwhBaseline } from "./model.ts";

// S2.E12 "TODAY": kWh since local midnight = meter total − the first total seen that local day.

/** Local calendar date "YYYY-MM-DD" in the process time zone (the Pi's). */
export function localDate(at: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** A new day (or no baseline yet) starts a new baseline at this total. Never negative (meter reset). */
export function kwhToday(baseline: KwhBaseline | null, totalKwh: number, date: string): { baseline: KwhBaseline; kwhToday: number } {
  const current = baseline !== null && baseline.date === date && baseline.kwh_total <= totalKwh ? baseline : { date, kwh_total: totalKwh };
  return { baseline: current, kwhToday: Math.round((totalKwh - current.kwh_total) * 1000) / 1000 };
}
