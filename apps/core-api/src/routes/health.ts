import type { HealthResponse } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { StateStore } from "../domain/state-store.ts";

/** GET /api/health → {ok, hw, rev}: core-api answers, and whether hw-service is connected. */
export async function healthRoutes(app: FastifyInstance, options: { store: StateStore }) {
  app.get("/health", async (): Promise<HealthResponse> => {
    const state = options.store.get();
    return { ok: true, hw: state.connection.hw, rev: state.rev };
  });
}
