import { randomUUID } from "node:crypto";
import type { TimedAction } from "@eduscope/contracts";
import type { SessionService } from "../auth/sessions.ts";
import type { Clock } from "../clock.ts";
import { SCHEDULE_ISSUER, type Dispatcher } from "../commands/dispatcher.ts";
import type { Db } from "../db/client.ts";
import { pruneEventLog, type EventLogger } from "../db/event-log.ts";
import { loadSchedule } from "../db/schedule.ts";
import { localDate, rollKwhBaseline } from "../domain/energy.ts";
import type { KwhBaseline } from "../domain/model.ts";
import { dueActions, endedBlocks, tickWindow } from "../domain/schedule.ts";
import type { StateStore } from "../domain/state-store.ts";
import { ApiFailure } from "../errors.ts";

// ARCHITECTURE §6.8: one tick every 30 s. Runs the timed actions due since the last tick (each step
// a command issued by "schedule"), ends remote control sessions when a class block ends (§2.3),
// resets the kWh baseline at local midnight and prunes the event log once a day. The expired-session
// sweep stays on its own 15 s timer (app.ts, ARCHITECTURE §5). Tests call tick() after moving the clock.

export const SCHEDULER_TICK_MS = 30_000;

export interface Scheduler {
  tick(): void;
}

export function createScheduler(deps: {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  sessions: SessionService;
  clock: Clock;
  log: EventLogger;
  persistBaseline: (baseline: KwhBaseline) => void;
  newId?: () => string;
}): Scheduler {
  const { db, store, dispatcher, sessions, clock, log } = deps;
  const newId = deps.newId ?? randomUUID;
  let lastTick = clock.now();
  let prunedOn: string | null = null;

  /** Every step is dispatched even when an earlier one is refused (a refusal is logged, never thrown). */
  function run(action: TimedAction): void {
    log({ type: "system", actor: "schedule", subject: action.name, result: "run" });
    for (const step of action.steps) {
      try {
        dispatcher.dispatch({ client_cmd_id: newId(), body: step }, SCHEDULE_ISSUER);
      } catch (error) {
        if (!(error instanceof ApiFailure)) throw error;
        log({ type: "command", actor: "schedule", subject: step.kind, payload: step, result: `refused: ${error.message}` });
      }
    }
  }

  function rollBaseline(now: Date): void {
    const before = store.model().facts.kwh_baseline;
    store.update((model) => rollKwhBaseline(model, now));
    const after = store.model().facts.kwh_baseline;
    if (after !== null && JSON.stringify(after) !== JSON.stringify(before)) deps.persistBaseline(after);
  }

  return {
    tick() {
      const now = clock.now();
      const { from, to } = tickWindow(lastTick, now);
      lastTick = now;
      const schedule = loadSchedule(db);
      for (const action of dueActions(schedule.actions, from, to)) run(action);
      if (endedBlocks(schedule.class_blocks, from, to).length > 0) sessions.endAccess("control", null, "class block ended");
      rollBaseline(now);
      const today = localDate(now);
      if (prunedOn !== today) {
        prunedOn = today;
        pruneEventLog(db, now);
      }
    },
  };
}
