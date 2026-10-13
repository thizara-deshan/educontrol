import type { FastifyInstance } from "fastify";
import type { StateStore } from "../domain/state-store.ts";

/** GET /api/state → RoomState (view level; the UI itself takes state from the WS snapshot). */
export async function stateRoutes(app: FastifyInstance, options: { store: StateStore }) {
  app.get("/state", async () => options.store.get());
}
