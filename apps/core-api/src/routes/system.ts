import type { FastifyInstance } from "fastify";
import type { Clock } from "../clock.ts";
import type { Config } from "../config.ts";
import type { EventLogger } from "../db/event-log.ts";
import type { StateStore } from "../domain/state-store.ts";
import type { Hub } from "../plugins/realtime.ts";
import { aboutInfo, networkInfo, type SystemProbe } from "../system/info.ts";

// ARCHITECTURE §3.3 api/system.ts — S3b Network, S3e About and Restart: technician only.
// D-32/D-35 S1 power menu (Shut down, Restart = Pi reboot): control, like every other S1 control.

const TECHNICIAN = { access: "technician" } as const;
const CONTROL = { access: "control" } as const;
/** The 202 reaches the browser before the controller goes away (H3 → H4 on the clients). */
export const RESTART_DELAY_MS = 250;

export async function systemRoutes(
  app: FastifyInstance,
  options: { store: StateStore; hub: Hub; probe: SystemProbe; config: Config; clock: Clock; bootedAt: Date; restart: () => void; shutdown: () => void; reboot: () => void; log: EventLogger },
) {
  const { store, hub, probe, config, clock } = options;

  app.get("/system/network", { config: TECHNICIAN }, async () => networkInfo(probe, store.get().connection.hw, hub.clients()));

  app.get("/system/about", { config: TECHNICIAN }, async () =>
    aboutInfo(probe, { id: config.ROOM_ID, hostname: config.ROOM_HOSTNAME, uptimeS: (clock.now().getTime() - options.bootedAt.getTime()) / 1000 }),
  );

  app.post("/system/restart", { config: TECHNICIAN }, async (request, reply) => {
    options.log({ type: "system", actor: request.client.label, public_id: request.client.row?.public_id ?? null, subject: "restart" });
    setTimeout(options.restart, RESTART_DELAY_MS);
    return reply.status(202).send();
  });

  app.post("/system/shutdown", { config: CONTROL }, async (request, reply) => {
    options.log({ type: "system", actor: request.client.label, public_id: request.client.row?.public_id ?? null, subject: "shutdown" });
    setTimeout(options.shutdown, RESTART_DELAY_MS);
    return reply.status(202).send();
  });

  app.post("/system/reboot", { config: CONTROL }, async (request, reply) => {
    options.log({ type: "system", actor: request.client.label, public_id: request.client.row?.public_id ?? null, subject: "reboot" });
    setTimeout(options.reboot, RESTART_DELAY_MS);
    return reply.status(202).send();
  });
}
