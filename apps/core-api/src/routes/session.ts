import { LoginRequest } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { verifyPin } from "../auth/pin-hash.ts";
import type { PinThrottle } from "../auth/pin-throttle.ts";
import type { SessionService } from "../auth/sessions.ts";
import type { Db } from "../db/client.ts";
import type { EventLogger } from "../db/event-log.ts";
import { readSetting } from "../db/settings.ts";
import { ensureSession } from "../plugins/auth.ts";

// ARCHITECTURE §3.3 api/session.ts: GET /api/session, POST /api/session/login, POST /api/session/lock.
// login and lock are the two public mutations (§5); both still pass the origin check.

export async function sessionRoutes(app: FastifyInstance, options: { db: Db; sessions: SessionService; throttle: PinThrottle; log: EventLogger }) {
  const { db, sessions, throttle } = options;
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/session", async (request, reply) => sessions.toClientSession(ensureSession(sessions, request, reply)));

  api.post("/session/login", { config: { public: true }, schema: { body: LoginRequest } }, async (request, reply) => {
    const client = ensureSession(sessions, request, reply);
    const { level, pin, label } = request.body;
    const ip = request.client.ip;
    const blocked = throttle.check(ip, level);
    if (blocked !== null) return reply.status(429).send(blocked);
    const hash = readSetting(db, level === "control" ? "room_pin_hash" : "technician_pin_hash", z.string());
    if (hash === null || !(await verifyPin(pin, hash))) {
      const error = throttle.fail(ip, level);
      options.log({ type: "pin_failure", actor: client.label, public_id: client.row.public_id, subject: level, result: error.reason });
      return reply.status(error.reason === "locked" ? 429 : 401).send(error);
    }
    throttle.succeed(ip, level);
    return sessions.login(client, level, label);
  });

  api.post("/session/lock", { config: { public: true } }, async (request, reply) => sessions.lock(ensureSession(sessions, request, reply)));
}
