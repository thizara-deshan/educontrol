import { CommandRequest } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { SessionService } from "../auth/sessions.ts";
import type { Dispatcher } from "../commands/dispatcher.ts";
import { ensureSession } from "../plugins/auth.ts";

/** POST /api/commands (control; projector.mains needs technician, checked per kind) → 202 Command. */
export async function commandRoutes(app: FastifyInstance, options: { dispatcher: Dispatcher; sessions: SessionService }) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.post("/commands", { config: { access: "control" }, schema: { body: CommandRequest } }, async (request, reply) => {
    const client = ensureSession(options.sessions, request, reply);
    const command = options.dispatcher.dispatch(request.body, { public_id: client.row.public_id, label: client.label, access: client.access });
    options.sessions.touch(client);
    return reply.status(202).send(command);
  });
}
