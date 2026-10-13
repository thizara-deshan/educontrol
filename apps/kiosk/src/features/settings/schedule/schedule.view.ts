import { Weekday, type ClassBlock, type TimedAction, type TimedActionInput } from "@eduscope/contracts";

// S3c: day formatting and the list rows.

const ORDER = Weekday.options;
const SHORT: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

const sameDays = (days: readonly Weekday[], set: readonly Weekday[]): boolean =>
  days.length === set.length && set.every((day) => days.includes(day));

/** "every day", "weekdays", "weekends", "Mon–Thu" (3+ in a row), else "Mon, Wed". */
export function formatDays(days: readonly Weekday[]): string {
  const sorted = ORDER.filter((day) => days.includes(day));
  if (sorted.length === 7) return "every day";
  if (sameDays(sorted, WEEKDAYS)) return "weekdays";
  if (sameDays(sorted, ["sat", "sun"])) return "weekends";
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first !== undefined && last !== undefined && sorted.length >= 3 && ORDER.indexOf(last) - ORDER.indexOf(first) === sorted.length - 1) {
    return `${SHORT[first]}–${SHORT[last]}`;
  }
  return sorted.map((day) => SHORT[day]).join(", ");
}

export interface BlockRow {
  id: string;
  time: string;
  days: string;
}

/** Class blocks by first day, then start time. */
export function blockRows(blocks: readonly ClassBlock[]): BlockRow[] {
  const firstDay = (block: ClassBlock): number => Math.min(...block.days.map((day) => ORDER.indexOf(day)));
  return [...blocks]
    .sort((a, b) => firstDay(a) - firstDay(b) || a.start.localeCompare(b.start))
    .map((block) => ({ id: block.id, time: `${block.start}–${block.end}`, days: formatDays(block.days) }));
}

export interface ActionRow {
  id: string;
  /** SPEC S3c: "All off · 18:00 weekdays". */
  label: string;
  enabled: boolean;
  action: TimedAction;
}

export function actionRows(actions: readonly TimedAction[]): ActionRow[] {
  return [...actions]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((action) => ({ id: action.id, label: `${action.name} · ${action.time} ${formatDays(action.days)}`, enabled: action.enabled, action }));
}

/** The PUT body that flips one action's enable toggle. */
export function withEnabled(action: TimedAction, enabled: boolean): TimedActionInput {
  return { name: action.name, time: action.time, days: action.days, enabled, steps: action.steps };
}
