import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { z } from "zod";
import { createPinThrottle } from "./auth/pin-throttle.ts";
import { createSessionService, type SessionService } from "./auth/sessions.ts";
import type { Clock } from "./clock.ts";
import { createDispatcher, type Dispatcher } from "./commands/dispatcher.ts";
import { capturedSetpoints, createIrCodeLookup } from "./commands/ir-codes.ts";
import type { Config } from "./config.ts";
import { openDb, type Db } from "./db/client.ts";
import { loadRegistry } from "./db/devices.ts";
import { createEventLogger } from "./db/event-log.ts";
import { seed } from "./db/seed.ts";
import { readSetting, writeSetting } from "./db/settings.ts";
import { initialModel } from "./domain/initial.ts";
import type { KwhBaseline } from "./domain/model.ts";
import { createStateStore, type StateStore } from "./domain/state-store.ts";
import type { HwClient, HwTimeouts } from "./hw/client.ts";
import { createIngest, type Ingest } from "./hw/ingest.ts";
import { createIrService, type IrService } from "./ir/service.ts";
import { authPlugin } from "./plugins/auth.ts";
import { errorsPlugin } from "./plugins/errors.ts";
import { originCheckPlugin } from "./plugins/origin-check.ts";
import { createHub, PING_MS, realtimePlugin, type Hub } from "./plugins/realtime.ts";
import { staticPlugin } from "./plugins/static.ts";
import { createRegistrySync } from "./registry-sync.ts";
import { createScheduler, SCHEDULER_TICK_MS, type Scheduler } from "./scheduler/scheduler.ts";
import { systemProbe, type SystemProbe } from "./system/info.ts";
import { commandRoutes } from "./routes/commands.ts";
import { deviceRoutes } from "./routes/devices.ts";
import { healthRoutes } from "./routes/health.ts";
import { irRoutes } from "./routes/ir.ts";
import { scheduleRoutes } from "./routes/schedule.ts";
import { sessionRoutes } from "./routes/session.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { systemRoutes } from "./routes/system.ts";
import { stateRoutes } from "./routes/state.ts";

// ARCHITECTURE §6.1: buildApp(deps) is used by main.ts and by tests (fastify.inject / injectWS).
// Tests pass db ":memory:", a fake hw client and a fixed clock; nothing here opens a port or
// connects to hw-service (main.ts starts the stream).

export interface AppDeps {
  /** SQLite path or ":memory:". */
  db: string;
  hw: HwClient;
  clock: Clock;
  config: Config;
  logger?: FastifyServerOptions["logger"];
  /** S3e "Restart controller" (main.ts: system/restart.ts). Default: nothing happens (tests). */
  restart?: () => void;
  /** D-32 "Shut down" (main.ts: system/power.ts). Default: nothing happens (tests). */
  shutdown?: () => void;
  /** D-35 "Restart" = Pi reboot (main.ts: system/power.ts). Default: nothing happens (tests). */
  reboot?: () => void;
  /** S3b/S3e OS facts. Default: the real probe. */
  system?: SystemProbe;
}

/** What tests and main.ts reach into. */
export interface Room {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  ingest: Ingest;
  sessions: SessionService;
  hub: Hub;
  ir: IrService;
  scheduler: Scheduler;
}

declare module "fastify" {
  interface FastifyInstance {
    room: Room;
  }
}

/** §6.4 "a 10 s timer re-evaluates staleness" (also H7b and the hw grace). */
export const TICK_MS = 10_000;
/** §5 "a 15 s sweep" of expired sessions. */
export const SESSION_SWEEP_MS = 15_000;

export function hwTimeouts(config: Config): HwTimeouts {
  return {
    zigbeeMs: config.TIMEOUT_ZIGBEE_MS,
    irSendMs: config.TIMEOUT_IR_SEND_MS,
    irLearnMs: config.TIMEOUT_IR_LEARN_MS,
    hdmiMs: config.TIMEOUT_HDMI_MS,
    mixerMs: config.TIMEOUT_MIXER_MS,
    screenMs: config.TIMEOUT_SCREEN_MS,
    projectorOffConfirmMs: config.PROJECTOR_OFF_CONFIRM_MS,
  };
}

const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, clock } = deps;
  const bootedAt = clock.now();
  const { db, close: closeDb } = openDb(deps.db);
  await seed(db, config, clock.now().toISOString());

  const log = createEventLogger(db, clock);
  const hub = createHub();
  const store = createStateStore({
    clock,
    rules: {
      climateIntervalS: config.CLIMATE_REPORT_INTERVAL_S,
      powerIntervalS: config.POWER_REPORT_INTERVAL_S,
      hwDownGraceMs: config.HW_DOWN_GRACE_MS,
    },
    initial: initialModel({
      room: { id: config.ROOM_ID, hostname: config.ROOM_HOSTNAME },
      registry: loadRegistry(db),
      acSetpoints: capturedSetpoints(db, "ac"),
      interlockBypassed: readSetting(db, "interlock_bypass", z.boolean()) ?? false,
      kwhBaseline: readSetting(db, "kwh_baseline", KwhBaselineSchema),
      now: clock.now().toISOString(),
    }),
  });
  const dispatcher = createDispatcher({
    store, hw: deps.hw, ir: createIrCodeLookup(db), timeouts: hwTimeouts(config), clock, emit: (event) => hub.broadcast(event), log,
  });
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const persistBaseline = (baseline: KwhBaseline): void => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString());
  const ingest = createIngest({
    store, dispatcher, log,
    emit: (event) => hub.broadcast(event),
    persistBaseline,
    scheduleTick: (delayMs) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        store.tick();
      }, delayMs);
      timers.add(timer);
    },
    hwDownGraceMs: config.HW_DOWN_GRACE_MS,
  });
  const sessions = createSessionService({
    db, clock, log,
    onChange: (session) => {
      hub.updateSession(session);
      hub.sendToSession(session.public_id, { type: "session", session });
    },
  });
  store.subscribe((state) => hub.broadcast({ type: "state", state }));
  const sync = createRegistrySync(db, store);
  const ir = createIrService({ db, store, hw: deps.hw, clock, emit: (event) => hub.broadcast(event), log, sync });
  const scheduler = createScheduler({ db, store, dispatcher, sessions, clock, log, persistBaseline });

  const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("room", { db, store, dispatcher, ingest, sessions, hub, ir, scheduler });

  await app.register(errorsPlugin);
  await app.register(cookie, { secret: config.COOKIE_SECRET });
  await app.register(authPlugin, { sessions, localhostIsKiosk: config.LOCALHOST_IS_KIOSK });
  await app.register(originCheckPlugin);
  await app.register(realtimePlugin, { hub, store, sessions });
  await app.register(
    async (api) => {
      await api.register(sessionRoutes, { db, sessions, throttle: createPinThrottle(clock), log });
      await api.register(stateRoutes, { store });
      await api.register(commandRoutes, { dispatcher, sessions });
      await api.register(healthRoutes, { store });
      await api.register(irRoutes, { ir });
      await api.register(scheduleRoutes, { db, emit: (event) => hub.broadcast(event) });
      await api.register(deviceRoutes, { db, store, hw: deps.hw, sync, emit: (event) => hub.broadcast(event) });
      await api.register(settingsRoutes, { db, sessions, clock, log });
      await api.register(systemRoutes, {
        store, hub, probe: deps.system ?? systemProbe, config, clock, bootedAt, restart: deps.restart ?? (() => undefined),
        shutdown: deps.shutdown ?? (() => undefined), reboot: deps.reboot ?? (() => undefined), log,
      });
    },
    { prefix: "/api" },
  );
  await app.register(staticPlugin, { kioskDist: config.KIOSK_DIST });

  app.addHook("onReady", async () => {
    timers.add(setInterval(() => store.tick(), TICK_MS));
    timers.add(setInterval(() => sessions.sweep(), SESSION_SWEEP_MS));
    timers.add(setInterval(() => hub.ping(), PING_MS));
    timers.add(setInterval(() => scheduler.tick(), SCHEDULER_TICK_MS));
  });
  app.addHook("onClose", async () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    store.close();
    dispatcher.close();
    closeDb();
  });
  return app;
}
