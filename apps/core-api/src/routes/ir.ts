import { IrCommandCreate, IrDeviceCreate, IrDeviceUpdate, IrTestResultRequest } from "@eduscope/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { IrActor, IrService } from "../ir/service.ts";

// ARCHITECTURE §3.3 api/ir.ts — S3 Remote configuration. Every route, GETs included, is technician.

const TECHNICIAN = { access: "technician" } as const;
const IdParams = z.object({ id: z.string().min(1) });

const actor = (request: FastifyRequest): IrActor => ({ public_id: request.client.row?.public_id ?? null, label: request.client.label });

export async function irRoutes(app: FastifyInstance, options: { ir: IrService }) {
  const { ir } = options;
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/ir/devices", { config: TECHNICIAN }, async () => ir.list());

  api.post("/ir/devices", { config: TECHNICIAN, schema: { body: IrDeviceCreate } }, async (request, reply) =>
    reply.status(201).send(ir.createDevice(request.body)),
  );

  api.patch("/ir/devices/:id", { config: TECHNICIAN, schema: { params: IdParams, body: IrDeviceUpdate } }, async (request) =>
    ir.updateDevice(request.params.id, request.body),
  );

  api.post("/ir/devices/:id/commands", { config: TECHNICIAN, schema: { params: IdParams, body: IrCommandCreate } }, async (request, reply) =>
    reply.status(201).send(ir.createCommand(request.params.id, request.body)),
  );

  api.delete("/ir/commands/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    ir.deleteCommand(request.params.id);
    return reply.status(204).send();
  });

  /** 202 at once; `ir_capture` events report listening → captured | timeout | cancelled | failed (H21). */
  api.post("/ir/commands/:id/learn", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    ir.learn(request.params.id, actor(request));
    return reply.status(202).send();
  });

  api.post("/ir/commands/:id/learn/cancel", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    await ir.cancelLearn(request.params.id);
    return reply.status(202).send();
  });

  api.post("/ir/commands/:id/test", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    await ir.test(request.params.id, actor(request));
    return reply.status(202).send();
  });

  api.post("/ir/commands/:id/test-result", { config: TECHNICIAN, schema: { params: IdParams, body: IrTestResultRequest } }, async (request) =>
    ir.recordTest(request.params.id, request.body.reacted),
  );
}
