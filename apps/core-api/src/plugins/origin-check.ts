import type { ApiError } from "@eduscope/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

// ARCHITECTURE §5 CSRF (D-12): every mutation and the WS upgrade must come from our own origin
// (Origin host == Host); bodies must be JSON.

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** The `Origin` header names the same host the request was sent to. */
export function sameOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin === undefined || host === undefined) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const originCheckPlugin = fp(async (app: FastifyInstance) => {
  app.addHook("onRequest", async (request, reply) => {
    const upgrade = request.headers.upgrade?.toLowerCase() === "websocket";
    if (SAFE.has(request.method) && !upgrade) return;
    if (!sameOrigin(request)) {
      const body: ApiError = { code: "forbidden", message: "Cross-origin request refused" };
      return reply.status(403).send(body);
    }
    if (upgrade || request.method === "DELETE") return;
    if (!(request.headers["content-type"] ?? "").startsWith("application/json")) {
      const body: ApiError = { code: "validation", message: "Content-Type must be application/json" };
      return reply.status(415).send(body);
    }
  });
});
