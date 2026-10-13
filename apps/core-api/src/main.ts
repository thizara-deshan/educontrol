import { buildApp, hwTimeouts } from "./app.ts";
import { systemClock } from "./clock.ts";
import { loadConfig } from "./config.ts";
import { createHwClient } from "./hw/client.ts";
import { startHwStream } from "./hw/stream.ts";

// ARCHITECTURE §6.1 boot: config → db migrate/seed (inside buildApp) → store → listen → hw stream.

const config = loadConfig();
const app = await buildApp({
  db: config.DB_PATH,
  hw: createHwClient({ baseUrl: config.HW_URL, timeouts: hwTimeouts(config) }),
  clock: systemClock,
  config,
  logger: { level: "info" },
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

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stream.stop();
    void app.close().then(() => process.exit(0));
  });
}
