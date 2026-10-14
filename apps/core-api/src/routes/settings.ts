import { RoomPinRequest, TechnicianPinRequest } from "@eduscope/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { hashPin } from "../auth/pin-hash.ts";
import type { SessionService } from "../auth/sessions.ts";
import type { Clock } from "../clock.ts";
import type { Db } from "../db/client.ts";
import type { EventLogger } from "../db/event-log.ts";
import { writeSetting } from "../db/settings.ts";

// ARCHITECTURE §3.3 api/settings.ts — S3d PIN changes (technician). The new PIN is re-hashed
// (scrypt, §5); every OTHER session unlocked with the old PIN ends (pushes `session`). The PIN
// itself is never logged.

const TECHNICIAN = { access: "technician" } as const;

export async function settingsRoutes(app: FastifyInstance, options: { db: Db; sessions: SessionService; clock: Clock; log: EventLogger }) {
  const { db, sessions, clock, log } = options;
  const api = app.withTypeProvider<ZodTypeProvider>();

  async function change(request: FastifyRequest, reply: FastifyReply, level: "control" | "technician", pin: string) {
    const key = level === "control" ? "room_pin_hash" : "technician_pin_hash";
    const reason = level === "control" ? "room PIN changed" : "technician PIN changed";
    writeSetting(db, key, await hashPin(pin), clock.now().toISOString());
    const own = request.client.row?.public_id ?? null;
    const ended = sessions.endAccess(level, own, reason);
    log({ type: "system", actor: request.client.label, public_id: own, subject: reason, result: `${ended} sessions ended` });
    return reply.status(204).send();
  }

  api.put("/settings/pins/room", { config: TECHNICIAN, schema: { body: RoomPinRequest } }, async (request, reply) =>
    change(request, reply, "control", request.body.pin),
  );

  api.put("/settings/pins/technician", { config: TECHNICIAN, schema: { body: TechnicianPinRequest } }, async (request, reply) =>
    change(request, reply, "technician", request.body.pin),
  );
}
