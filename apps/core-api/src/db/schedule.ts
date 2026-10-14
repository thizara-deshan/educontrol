import { ClassBlock, TimedAction, type ClassBlockInput, type Schedule, type TimedActionInput } from "@eduscope/contracts";
import { asc, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { classBlocks, timedActions } from "./schema.ts";

// S3c Schedule (ARCHITECTURE §6.2): class blocks end control sessions (§2.3), timed actions run
// as "schedule" (scheduler/). JSON columns are parsed with the contracts on the way out.

type BlockRow = typeof classBlocks.$inferSelect;
type ActionRow = typeof timedActions.$inferSelect;

function toBlock(row: BlockRow): ClassBlock {
  const days: unknown = JSON.parse(row.days);
  return ClassBlock.parse({ id: row.id, days, start: row.start, end: row.end });
}

function toAction(row: ActionRow): TimedAction {
  const days: unknown = JSON.parse(row.days);
  const steps: unknown = JSON.parse(row.steps);
  return TimedAction.parse({ id: row.id, name: row.name, time: row.time, days, enabled: row.enabled, steps });
}

/** GET /api/schedule: blocks by start time, actions by time. */
export function loadSchedule(db: Db): Schedule {
  return {
    class_blocks: db.select().from(classBlocks).orderBy(asc(classBlocks.start)).all().map(toBlock),
    actions: db.select().from(timedActions).orderBy(asc(timedActions.time)).all().map(toAction),
  };
}

function findBlock(db: Db, id: string): ClassBlock | null {
  const row = db.select().from(classBlocks).where(eq(classBlocks.id, id)).get();
  return row === undefined ? null : toBlock(row);
}

function findAction(db: Db, id: string): TimedAction | null {
  const row = db.select().from(timedActions).where(eq(timedActions.id, id)).get();
  return row === undefined ? null : toAction(row);
}

const blockColumns = (input: ClassBlockInput) => ({ days: JSON.stringify(input.days), start: input.start, end: input.end });
const actionColumns = (input: TimedActionInput) => ({
  name: input.name, time: input.time, days: JSON.stringify(input.days), enabled: input.enabled, steps: JSON.stringify(input.steps),
});

export function createBlock(db: Db, id: string, input: ClassBlockInput): ClassBlock {
  db.insert(classBlocks).values({ id, ...blockColumns(input) }).run();
  const block = findBlock(db, id);
  if (block === null) throw new Error("class block vanished");
  return block;
}

/** Null when the id is unknown. */
export function updateBlock(db: Db, id: string, input: ClassBlockInput): ClassBlock | null {
  db.update(classBlocks).set(blockColumns(input)).where(eq(classBlocks.id, id)).run();
  return findBlock(db, id);
}

export function deleteBlock(db: Db, id: string): boolean {
  return db.delete(classBlocks).where(eq(classBlocks.id, id)).run().changes > 0;
}

export function createAction(db: Db, id: string, input: TimedActionInput): TimedAction {
  db.insert(timedActions).values({ id, ...actionColumns(input) }).run();
  const action = findAction(db, id);
  if (action === null) throw new Error("timed action vanished");
  return action;
}

/** Null when the id is unknown (also how the S3c enable toggle saves). */
export function updateAction(db: Db, id: string, input: TimedActionInput): TimedAction | null {
  db.update(timedActions).set(actionColumns(input)).where(eq(timedActions.id, id)).run();
  return findAction(db, id);
}

export function deleteAction(db: Db, id: string): boolean {
  return db.delete(timedActions).where(eq(timedActions.id, id)).run().changes > 0;
}
