import type { ClassBlock, TimedAction, Weekday } from "@eduscope/contracts";

// S3c / ARCHITECTURE §6.8: which timed actions are due and which class blocks ended between two
// scheduler ticks. Times are local wall-clock "HH:MM" in the process time zone (the Pi's). Pure.

/** A tick never replays more than this (a suspended laptop, a clock jump): older moments are skipped. */
export const MAX_CATCH_UP_MS = 5 * 60_000;

const WEEKDAYS: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayOf(at: Date): Weekday {
  return WEEKDAYS[at.getDay()] ?? "sun";
}

/** Local midnight of the day `at` falls on. */
function startOfDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

/** Every local moment "HH:MM:00" on one of `days` with from < moment ≤ to. */
export function occurrences(days: readonly Weekday[], time: string, from: Date, to: Date): Date[] {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const found: Date[] = [];
  for (let day = startOfDay(from); day.getTime() <= to.getTime(); day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const moment = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    if (days.includes(weekdayOf(moment)) && moment.getTime() > from.getTime() && moment.getTime() <= to.getTime()) found.push(moment);
  }
  return found;
}

/** The window a tick covers: since the last tick, at most MAX_CATCH_UP_MS back. */
export function tickWindow(lastTick: Date, now: Date): { from: Date; to: Date } {
  return { from: new Date(Math.max(lastTick.getTime(), now.getTime() - MAX_CATCH_UP_MS)), to: now };
}

/** Enabled actions whose time passed in (from, to] on one of their days. */
export function dueActions(actions: readonly TimedAction[], from: Date, to: Date): TimedAction[] {
  return actions.filter((action) => action.enabled && occurrences(action.days, action.time, from, to).length > 0);
}

/** Blocks whose end passed in (from, to] on one of their days (§2.3: control sessions end then). */
export function endedBlocks(blocks: readonly ClassBlock[], from: Date, to: Date): ClassBlock[] {
  return blocks.filter((block) => occurrences(block.days, block.end, from, to).length > 0);
}
