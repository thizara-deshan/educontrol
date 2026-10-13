import { resolve } from "node:path";
import type { ApiError } from "@eduscope/contracts";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

// ARCHITECTURE §4.3/§6.1: the built SPA on the same origin, with history fallback — any GET that is
// not /api or /ws answers index.html so deep links (/devices) load directly. Unknown /api → 404 ApiError.

export const staticPlugin = fp(async (app: FastifyInstance, options: { kioskDist: string | undefined }) => {
  const root = options.kioskDist === undefined ? undefined : resolve(options.kioskDist);
  if (root !== undefined) await app.register(fastifyStatic, { root, wildcard: false });

  app.setNotFoundHandler((request, reply) => {
    const api = request.url.startsWith("/api/") || request.url === "/api" || request.url.startsWith("/ws");
    if (!api && root !== undefined && (request.method === "GET" || request.method === "HEAD")) {
      return reply.sendFile("index.html");
    }
    const body: ApiError = { code: "not_found", message: "Not found" };
    return reply.status(404).send(body);
  });
});
