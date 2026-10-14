import { randomUUID } from "node:crypto";
import { ClassBlockInput, TimedActionInput, type ServerEvent } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { createAction, createBlock, deleteAction, deleteBlock, loadSchedule, updateAction, updateBlock } from "../db/schedule.ts";
import { ApiFailure } from "../errors.ts";

// ARCHITECTURE §3.3 api/schedule.ts — S3c. Technician only; every write invalidates ["schedule"].
// The scheduler reads the table on each tick, so changes apply from the next tick on.

const TECHNICIAN = { access: "technician" } as const;
const IdParams = z.object({ id: z.string().min(1) });
const notFound = (): ApiFailure => new ApiFailure(404, "not_found", "Not found");

export async function scheduleRoutes(app: FastifyInstance, options: { db: Db; emit: (event: ServerEvent) => void; newId?: () => string }) {
  const { db } = options;
  const newId = options.newId ?? randomUUID;
  const changed = (): void => options.emit({ type: "invalidate", keys: [["schedule"]] });
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/schedule", { config: TECHNICIAN }, async () => loadSchedule(db));

  api.post("/schedule/blocks", { config: TECHNICIAN, schema: { body: ClassBlockInput } }, async (request, reply) => {
    const block = createBlock(db, newId(), request.body);
    changed();
    return reply.status(201).send(block);
  });

  api.put("/schedule/blocks/:id", { config: TECHNICIAN, schema: { params: IdParams, body: ClassBlockInput } }, async (request) => {
    const block = updateBlock(db, request.params.id, request.body);
    if (block === null) throw notFound();
    changed();
    return block;
  });

  api.delete("/schedule/blocks/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    if (!deleteBlock(db, request.params.id)) throw notFound();
    changed();
    return reply.status(204).send();
  });

  api.post("/schedule/actions", { config: TECHNICIAN, schema: { body: TimedActionInput } }, async (request, reply) => {
    const action = createAction(db, newId(), request.body);
    changed();
    return reply.status(201).send(action);
  });

  api.put("/schedule/actions/:id", { config: TECHNICIAN, schema: { params: IdParams, body: TimedActionInput } }, async (request) => {
    const action = updateAction(db, request.params.id, request.body);
    if (action === null) throw notFound();
    changed();
    return action;
  });

  api.delete("/schedule/actions/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    if (!deleteAction(db, request.params.id)) throw notFound();
    changed();
    return reply.status(204).send();
  });
}
