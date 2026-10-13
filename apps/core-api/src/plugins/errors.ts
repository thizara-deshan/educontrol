import type { ApiError } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ApiFailure } from "../errors.ts";

// Every 4xx answers an ApiError body (ARCHITECTURE §3.3 api/errors.ts). 5xx are logged; their body
// is not an ApiError, which the kiosk reports as a bad response.

/** Fastify's own errors (bad JSON, unsupported media type, body too large) carry a 4xx `statusCode`. */
function statusOf(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  return 500;
}

export const errorsPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiFailure) {
      const body: ApiError = { code: error.code, message: error.message };
      return reply.status(error.status).send(body);
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const first = error.validation[0];
      const where = first?.instancePath ? `${first.instancePath.slice(1)}: ` : "";
      const body: ApiError = { code: "validation", message: `${where}${first?.message ?? "Invalid request"}` };
      return reply.status(400).send(body);
    }
    const status = statusOf(error);
    if (status >= 400 && status < 500) {
      const body: ApiError = { code: status === 404 ? "not_found" : "validation", message: error instanceof Error ? error.message : "Invalid request" };
      return reply.status(status).send(body);
    }
    request.log.error(error);
    return reply.status(500).send({ message: "Internal error" });
  });
});
