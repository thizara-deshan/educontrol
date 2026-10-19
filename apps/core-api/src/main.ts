import { buildApp, hwTimeouts } from "./app.ts";
import { systemClock } from "./clock.ts";
import { loadConfig } from "./config.ts";
import { createHwClient } from "./hw/client.ts";
import { startHwStream } from "./hw/stream.ts";
import { createRestart } from "./system/restart.ts";
import { createShutdown } from "./system/shutdown.ts";

// ARCHITECTURE §6.1 boot: config → db migrate/seed (inside buildApp) → store → listen → hw stream.

const config = loadConfig();
/** Closes everything and exits; replaced once the stream runs. */
let shutdown = (): void => process.exit(0);
const app = await buildApp({
  db: config.DB_PATH,
  hw: createHwClient({ baseUrl: config.HW_URL, timeouts: hwTimeouts(config) }),
  clock: systemClock,
  config,
  logger: { level: "info" },
  // S3e: RESTART_COMMAND when set (systemd on the Pi, `touch src/main.ts` under `tsx watch` in dev), else exit.
  restart: createRestart({
    command: config.RESTART_COMMAND,
    exit: () => shutdown(),
    onError: (error) => app.log.error({ err: error }, "RESTART_COMMAND failed"),
  }),
  // D-32: SHUTDOWN_COMMAND when set (systemd on the Pi), else only logged.
  shutdown: createShutdown({
    command: config.SHUTDOWN_COMMAND,
    onUnset: () => app.log.warn("SHUTDOWN_COMMAND is not set; not powering off"),
    onError: (error) => app.log.error({ err: error }, "SHUTDOWN_COMMAND failed"),
  }),
});
await app.listen({ port: config.PORT, host: config.HOST });

const { ingest } = app.room;
const stream = startHwStream({
  url: `${config.HW_URL}/v1/events`,
  deadMs: config.HW_STREAM_DEAD_MS,
  onEvent: (event) => ingest.handle(event),
  onDown: () => ingest.down(),
  onInvalid: (reason) => app.log.warn({ reason }, "hw event dropped"),
});

shutdown = () => {
  stream.stop();
  void app.close().then(() => process.exit(0));
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => shutdown());
