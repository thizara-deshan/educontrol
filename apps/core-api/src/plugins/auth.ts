import type { AccessLevel, ApiError } from "@eduscope/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import "@fastify/cookie"; // request.cookies / reply.setCookie typings
import type { ResolvedClient, SessionRow, SessionService } from "../auth/sessions.ts";
import { hasAccess, isKioskRequest } from "../domain/session-rules.ts";

// ARCHITECTURE §5 guard. Resolves `request.client` from the signed `ec_sid` cookie and the socket
// address (never a header, trustProxy is false), enforces `config.access`, refuses to start when a
// mutating route forgets to declare it, and counts every successful guarded mutation as activity.

export const SESSION_COOKIE = "ec_sid";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Required level for this route. Mandatory on every non-GET route unless `public`. */
    access?: "control" | "technician";
    /** Mutating route open to everyone (login, lock). */
    public?: boolean;
  }
  interface FastifyRequest {
    client: ResolvedClient;
  }
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Throws for a non-GET route without `config.access` (or `config.public`). Exported for tests. */
export function assertRouteAccess(route: { method: string | string[]; url: string; config?: { access?: string; public?: boolean } }): void {
  const methods = Array.isArray(route.method) ? route.method : [route.method];
  const mutating = methods.some((method) => !READ_METHODS.has(method));
  if (mutating && route.config?.access === undefined && route.config?.public !== true) {
    throw new Error(`Route ${methods.join(",")} ${route.url} must declare config.access`);
  }
}

/** Sets the session cookie when `ensure` created a row. */
export function ensureSession(sessions: SessionService, request: FastifyRequest, reply: FastifyReply): ResolvedClient & { row: SessionRow } {
  const { client, newCookieId } = sessions.ensure(request.client);
  if (newCookieId !== null) {
    reply.setCookie(SESSION_COOKIE, newCookieId, { path: "/", httpOnly: true, sameSite: "strict", signed: true });
  }
  request.client = client;
  return client;
}

export function readSessionCookie(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (raw === undefined) return null;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export const authPlugin = fp(async (app: FastifyInstance, options: { sessions: SessionService; localhostIsKiosk: boolean }) => {
  app.decorateRequest("client");

  app.addHook("onRoute", (route) => assertRouteAccess({ method: route.method, url: route.url, config: route.config ?? {} }));

  app.addHook("onRequest", async (request) => {
    // trustProxy is false, so request.ip IS the socket peer address (never X-Forwarded-For).
    const kiosk = isKioskRequest(request.ip, options.localhostIsKiosk);
    request.client = options.sessions.resolve(readSessionCookie(request), request.ip ?? "", kiosk);
  });

  app.addHook("preHandler", async (request, reply) => {
    const need: AccessLevel | undefined = request.routeOptions.config.access;
    if (need === undefined || hasAccess(request.client.access, need)) return;
    const body: ApiError =
      request.client.access === "view"
        ? { code: "unauthorized", message: "Enter the room PIN" }
        : { code: "forbidden", message: "Technician PIN required" };
    return reply.status(body.code === "unauthorized" ? 401 : 403).send(body);
  });

  // §5 "Activity = any authorised mutation": a 2xx on a guarded non-GET route resets the idle timer.
  app.addHook("onResponse", async (request, reply) => {
    if (READ_METHODS.has(request.method) || request.routeOptions.config.access === undefined) return;
    if (reply.statusCode < 300) options.sessions.touch(request.client);
  });
});
