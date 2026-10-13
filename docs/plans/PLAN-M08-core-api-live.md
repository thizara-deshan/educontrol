# PLAN-M08 — core-api: live state & control
Milestone: `docs/milestones/M08-core-api-live.md` · Start tag: `m08-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M08; SPEC §2.3–2.5, §3 (tokens — no UI work here), S1.E2–E4, S1.E9–E45, S2 (data), S4,
H1–H19, H24, H25, §6, §7 (R1–R14), Q1–Q12; ARCHITECTURE §1–§3, §4.4–4.7 (kiosk data layer), §5, §6.1–6.7, §8, §10;
CLAUDE.md; M07 plan + review (hw fake behaviour, `HW_FAKE_TIME_SCALE`, `/v1/_fake/*`), M09 (to keep its scope out);
`packages/contracts` (all of it), `packages/contracts/fixtures/{hw,state}`, the kiosk data layer
(`apps/kiosk/src/data/**`, especially the http adapter, `apply-event.ts`, `mock-rules.ts` for the texts the UI
expects) and `services/hw/app/config.py`. No new screen: the kiosk already renders every state; this milestone makes
the data real. `reference/screens/01–02` were used only to check that the live data renders like the mock
(headless Chromium, 1280×800 and 390×844).

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. "Run `cmd`" = run it from the repo root.
- Before T1: `git tag m08-start` (on the commit that adds this plan).
- Tooling verified with: Node 26.4, pnpm 11.28.3, fastify 5.12.5, @fastify/websocket 11.3.4, @fastify/static 10.1.6,
  @fastify/cookie 11.1.3, fastify-type-provider-zod 7.0.0, drizzle-orm 0.45.4, drizzle-kit 0.31.11,
  better-sqlite3 13.0.3, eventsource-parser 4.1.2, esbuild 0.28.2, tsx 4.23.15, Vitest 5.0.3, uv 0.12.23.
- **Every code block in this plan was compiled, linted and tested, and the plan was replayed task by task by a
  script that applies the blocks exactly as written** in a fresh worktree from `main` (9fbc8a9), with `pnpm verify`
  green after every task. The finished stack (`pnpm dev`, hw fake at scale 60) was driven with curl, a WS client and
  headless Chromium; the outputs quoted in T29, T31 and T32 come from those runs. Apply blocks **verbatim**:
  - "Create `X`" / "Replace the whole file `X`" = the block is the full file content (end it with one newline);
    create missing folders;
  - "In `X` replace: … with: …" = an exact, unique text replacement;
  - "In `X` replace everything from the line `A` up to (not including) the line `B` with:" = keep line `B`, replace
    line `A` and everything after it until `B`;
  - "Delete `X`" = `git rm X`;
  - "Run:" = run the shell block from the repo root.
- core-api imports with explicit `.ts` extensions (like `packages/contracts`; `allowImportingTsExtensions` is on);
  tests live in `apps/core-api/test/**` mirroring `src/` (D17). No `as` casts (only `as const`), no `!`, no `any`.
- Tests never open a port: `buildApp({db: ":memory:", hw: fakeHw(), clock: fixedClock(T0), config})` +
  `fastify.inject` / `app.injectWS`. Timeout tests use 60 ms deadlines on real timers (`expect.poll`).
- If `pnpm verify` fails after a block: diff your file against the plan; do not "fix" by editing tests.

### Decisions this plan makes (do not re-open them)

- **D1/D2 — session rows (decision record D-21, T23).** `GET /api/session` gives every browser a `sessions` row and
  the signed `ec_sid` cookie; Lock and expiry downgrade the row in place (remote → view, kiosk → control) and push
  `session`; the cookie and `public_id` stay. This supersedes ARCHITECTURE §5's "Lock deletes the row, clears the
  cookie". View-only remote rows are deleted 7 days after creation by the 15 s sweep.
- **D3 — hw client failures are acks.** Unreachable / timeout / bad answer → `HwAck {ok:false, error.code:
  transport|timeout}` (no exception). `timeout` → command `timed_out`; anything else → `failed`.
- **D4 — refused vs failed.** Preconditions answer HTTP errors and create no Command: 403 `forbidden` (technician
  kind), 409 `precondition` (device offline, IR blaster offline, interlock, AC rules, missing IR code), 503
  `hw_unavailable` (hw link down). After the 202, hw refusals end the Command `failed` with the H6a text per
  transport: IR "Couldn't reach the blaster", zigbee "Switch didn't respond", others "Command failed".
- **D5 — last write wins.** A newer command on the same output ends the older one `assumed` (no toast, no error);
  only the newest is correlated.
- **D6 — hw down.** The stream dropping marks `connection.hw = "down"` at once (status fault "Hardware service
  offline"); after `HW_DOWN_GRACE_MS` (10 s) every device is offline and every reported value stale (greyed). The
  first snapshot after reconnecting rebuilds everything.
- **D7 — mesh counts (M05-L2).** `mesh.routers` / `end_devices` count paired nodes, online or not, like `paired`.
- **D8 — kWh today.** Baseline = the first meter total seen each local day (persisted in `settings.kwh_baseline`);
  no scheduler needed. M09's midnight reset stays harmless.
- **D9 — runtime.** `dev` = `tsx watch src/main.ts`; `build` = esbuild bundle `dist/main.js` (contracts inlined,
  npm packages external, `node dist/main.js` from any cwd: migrations resolve via `src/paths.ts`).
- **D10 — dependencies.** `fastify ^5.12.5` (5.12.7 was too new for pnpm's minimum release age on 2026-10-14);
  `better-sqlite3` ships prebuilt binaries: `allowBuilds: better-sqlite3: false` (nothing compiles, no
  `ERR_PNPM_IGNORED_BUILDS`).
- **D11 — WS cookie binding.** The kiosk http adapter fetches `/api/session` before opening the socket (D-21).
- **D12 — a resync snapshot is never "by hand".** Only a report outside a snapshot with no matching command is.
- **D13 — env names.** hw-service reads `HW_FAKE_TIME_SCALE` (M07 D5); M08 AC3's `FAKE_TIME_SCALE` means that.
- **D14 — toasts.** IR commands toast at the ack (`assumed`), read-back commands at `confirmed`, by-hand light
  changes at the report; slider drags (`final:false`) never toast or log.
- **D15 — S1.E4 order.** hw down > coordinator offline > device(s) offline > sensors not reporting > battery ≤ 20 %
  > "All systems normal".
- **D16 — `HealthResponse`** joins the contracts (T1): `GET /api/health → {ok:true, hw, rev}`.
- **D17 — tests** live in `apps/core-api/test/**`; `vitest.config.ts` sets `TZ=UTC` so local dates are stable.
- **D18 — interlock.** `holding` = projector cooling down (as the mock); `projector.mains off` is refused while
  draw ≥ 5 W or unknown, unless bypassed (`settings.interlock_bypass`, seeded false; no route sets it in M08).
- **D19 — dev IR codes.** `SEED_FAKE_IR_CODES=true` fills missing codes: projector = hw fake's on/off codes,
  AC = base64 placeholders the fake blaster accepts. Default false (production never has fake codes).
- **D20 — loopback check** uses `request.ip`, which is `socket.remoteAddress` because `trustProxy` is false.

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `packages/contracts/src/api/health.ts`, `src/index.ts`, `test/health.test.ts` | Create / Modify | `HealthResponse` (T1) |
| `pnpm-workspace.yaml` | Modify | `allowBuilds: better-sqlite3: false` |
| `apps/core-api/package.json` | Modify | deps; scripts `dev`, `build`, `start`, `typecheck`, `test`, `db:generate` |
| `apps/core-api/{tsconfig.json,vitest.config.ts,drizzle.config.ts}` | Create | TS, tests (TZ=UTC), drizzle-kit |
| `apps/core-api/drizzle/0000_init.sql`, `drizzle/meta/*` | Create (generated) | first migration, all 7 tables |
| `apps/core-api/scripts/build.ts` | Create | esbuild bundle → `dist/main.js` |
| `apps/core-api/src/config.ts` | Create | zod env |
| `apps/core-api/src/{paths,clock,errors}.ts` | Create | migrations dir, injectable clock, `ApiFailure` |
| `apps/core-api/src/db/{schema,client,settings,seed,event-log}.ts` | Create | tables, open+migrate, settings JSON, R-101 seed, audit log |
| `apps/core-api/src/domain/{model,observed,initial,energy}.ts` | Create | model types, Observed helpers, boot model, kWh today |
| `apps/core-api/src/domain/{projector,ac,audio,lights,sensors,zigbee,interlock,devices,status,attribution}.ts` | Create | R1/R2/H7b, R3/R4, R9, R6, R13, mesh, R11, H8/H9, S1.E4, H13 |
| `apps/core-api/src/domain/{hw-events,derive,state-store,session-rules}.ts` | Create | HwEvent → model, derived fields, the store, session expiry + kiosk |
| `apps/core-api/src/hw/{client,stream,ingest}.ts` | Create | hw HTTP, SSE consumer, event → store + correlation + by hand |
| `apps/core-api/src/commands/{ir-codes,policies,dispatcher}.ts` | Create | IR codes, preconditions + plans, dispatcher |
| `apps/core-api/src/auth/{pin-hash,pin-throttle,sessions}.ts` | Create | scrypt, H17 throttle, session rows |
| `apps/core-api/src/plugins/{errors,auth,origin-check,realtime,static}.ts` | Create | ApiError, guard, CSRF, WS hub, SPA |
| `apps/core-api/src/routes/{session,state,commands,health}.ts` | Create | REST |
| `apps/core-api/src/{app,main}.ts` | Create | `buildApp(deps)`, boot |
| `apps/core-api/test/**` | Create | Vitest (helpers, domain, hw, commands, auth, db, routes) |
| `apps/kiosk/src/data/adapters/http/http-client.ts` + `.test.ts` | Modify | session fetch before the WS (D11) |
| `apps/kiosk/.env.development`, `apps/kiosk/vite.config.ts` | Modify | http mode, `/api` + `/ws` proxy |
| `docs/decisions/D-21-session-rows.md` | Create | decision record (T23) |
| `apps/core-api/src/.gitkeep`, `apps/core-api/drizzle/.gitkeep` | Delete | placeholders |

## Tasks

### T1 — Contract: `GET /api/health` response
- [x] done

**Files:** `packages/contracts/src/api/health.ts`, `packages/contracts/src/index.ts`, `packages/contracts/test/health.test.ts`

**Context:** CLAUDE.md: any schema crossing a boundary goes into `packages/contracts` first. M08 scope lists a `health` route; ARCHITECTURE §3.3 has no schema for it yet. This is the only contract change in M08 (D16).

**Do:**
1. Create `packages/contracts/src/api/health.ts`:
```ts
import { z } from "zod";

/** GET /api/health — liveness for scripts and systemd checks (no session needed). */
export const HealthResponse = z.object({
  ok: z.literal(true),
  hw: z.enum(["up", "down"]),
  rev: z.number().int().nonnegative(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
```
2. In `packages/contracts/src/index.ts` replace:
```ts
export * from "./api/system.ts";
```
with:
```ts
export * from "./api/system.ts";
export * from "./api/health.ts";
```
3. Create `packages/contracts/test/health.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { HealthResponse } from "../src/api/health.ts";

describe("HealthResponse", () => {
  it("accepts ok with the hw link state and rev", () => {
    expect(HealthResponse.safeParse({ ok: true, hw: "down", rev: 0 }).success).toBe(true);
  });
  it("rejects ok:false, an unknown hw state and a negative rev", () => {
    expect(HealthResponse.safeParse({ ok: false, hw: "up", rev: 1 }).success).toBe(false);
    expect(HealthResponse.safeParse({ ok: true, hw: "maybe", rev: 1 }).success).toBe(false);
    expect(HealthResponse.safeParse({ ok: true, hw: "up", rev: -1 }).success).toBe(false);
  });
});
```

**Test:** `packages/contracts/test/health.test.ts` (above): accepts `{ok:true, hw, rev}`, rejects `ok:false`, an unknown `hw` and a negative `rev`.

**Verify:** `pnpm --filter @eduscope/contracts test` → 136 passed (2 new). Then `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(contracts): GET /api/health response"` (includes this plan file with the box ticked)

### T2 — core-api scaffold: dependencies, tsconfig, Vitest, zod-parsed config
- [x] done

**Files:** `apps/core-api/package.json`, `pnpm-workspace.yaml`, `apps/core-api/tsconfig.json`, `apps/core-api/vitest.config.ts`, `apps/core-api/src/config.ts`, `apps/core-api/test/helpers.ts`, `apps/core-api/test/config.test.ts`, `apps/core-api/src/.gitkeep` (delete), `apps/core-api/drizzle/.gitkeep` (delete)

**Context:** M08 scope: `config.ts` (zod env: `PORT`, `HOST`, `DB_PATH`, `HW_URL`, `COOKIE_SECRET`, `ROOM_ID`, `ROOM_HOSTNAME`, `LOCALHOST_IS_KIOSK`, `INITIAL_ROOM_PIN`, `INITIAL_TECH_PIN`, `KIOSK_DIST`, timeouts); milestone notes list the libraries. ARCHITECTURE §6.3 timeouts (zigbee 5 s, IR send 3 s, hdmi 5 s, mixer 2 s, screen 5 s, Q12 `[ASSUMED]`), §6.7 (10 s hw grace), §6.3 (15 s dead stream), R13 (2× report interval). D9 (tsx for dev, esbuild for the build), D10 (dependency pins). `dev`/`build` stay placeholders until T29 so `pnpm dev` and `pnpm build` keep working in between. `IR learn` timeout is M09 (out of scope).

**Do:**
1. Delete `apps/core-api/src/.gitkeep`.
2. Delete `apps/core-api/drizzle/.gitkeep`.
3. Replace the whole file `apps/core-api/package.json`:
```json
{
  "name": "@eduscope/core-api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node -e \"console.log('@eduscope/core-api: dev arrives in M08 T29')\"",
    "build": "node -e \"console.log('@eduscope/core-api: build arrives in M08 T29')\"",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@eduscope/contracts": "workspace:*",
    "@fastify/cookie": "^11.1.3",
    "@fastify/static": "^10.1.6",
    "@fastify/websocket": "^11.3.4",
    "better-sqlite3": "^13.0.3",
    "drizzle-orm": "^0.45.4",
    "eventsource-parser": "^4.1.2",
    "fastify": "^5.12.5",
    "fastify-plugin": "^6.0.1",
    "fastify-type-provider-zod": "^7.0.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^9.6.0",
    "@types/node": "^22.20.5",
    "@types/ws": "^8.18.2",
    "drizzle-kit": "^0.31.11",
    "esbuild": "^0.28.2",
    "tsx": "^4.23.15",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3"
  }
}
```
4. Replace the whole file `pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
allowBuilds:
  # prebuilt N-API binaries ship in the package (prebuilds/); no compile on install
  better-sqlite3: false
  esbuild: true
```
5. Run (must end without `ERR_PNPM_IGNORED_BUILDS` (the `better-sqlite3: false` line silences it; the package ships prebuilt binaries, nothing compiles)):
```sh
pnpm install
```
6. Create `apps/core-api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "scripts", "drizzle.config.ts", "vitest.config.ts"]
}
```
7. Create `apps/core-api/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Local dates (kWh baseline) are computed in UTC in tests so results never depend on the host zone.
  test: { include: ["test/**/*.test.ts"], environment: "node", env: { TZ: "UTC" } },
});
```
8. Create `apps/core-api/src/config.ts`:
```ts
import { z } from "zod";

// zod at the env boundary (CLAUDE.md, ARCHITECTURE §6.1). Every knob core-api reads lives here.

const Bool = z.enum(["true", "false"]).transform((value) => value === "true");
const Ms = z.coerce.number().int().positive();

export const Config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DB_PATH: z.string().min(1),
  HW_URL: z.url().default("http://127.0.0.1:8081"),
  /** Signs the `ec_sid` cookie. */
  COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 characters"),
  ROOM_ID: z.string().min(1).default("R-101"),
  ROOM_HOSTNAME: z.string().min(1).default("r-101.local"),
  /** D-09: a loopback socket address is the kiosk. Off unless set (dev's Vite proxy makes everyone local). */
  LOCALHOST_IS_KIOSK: Bool.default(false),
  /** Seeded into `settings` on first boot only (ARCHITECTURE §5). */
  INITIAL_ROOM_PIN: z.string().regex(/^\d{4}$/, "INITIAL_ROOM_PIN must be 4 digits").optional(),
  INITIAL_TECH_PIN: z.string().regex(/^\d{6}$/, "INITIAL_TECH_PIN must be 6 digits").optional(),
  /** Built SPA (apps/kiosk/dist). Unset in dev: Vite serves the SPA. */
  KIOSK_DIST: z.string().min(1).optional(),
  /** Dev only: give the seeded IR commands the codes the fake hw-service reacts to. */
  SEED_FAKE_IR_CODES: Bool.default(false),
  // Per-transport command timeouts (ARCHITECTURE §6.3, Q12 [ASSUMED]).
  TIMEOUT_ZIGBEE_MS: Ms.default(5000),
  TIMEOUT_IR_SEND_MS: Ms.default(3000),
  TIMEOUT_HDMI_MS: Ms.default(5000),
  TIMEOUT_MIXER_MS: Ms.default(2000),
  TIMEOUT_SCREEN_MS: Ms.default(5000),
  /** §6.7: hw down this long ⇒ every hw-backed device offline. */
  HW_DOWN_GRACE_MS: Ms.default(10_000),
  /** §6.3: no SSE frame this long ⇒ the stream is dead and reconnects. */
  HW_STREAM_DEAD_MS: Ms.default(15_000),
  // R13 expected report intervals [ASSUMED] (Q12); stale after 2×.
  CLIMATE_REPORT_INTERVAL_S: z.coerce.number().int().positive().default(300),
  POWER_REPORT_INTERVAL_S: z.coerce.number().int().positive().default(60),
});

export type Config = z.infer<typeof Config>;

/** Parses `process.env`; prints every problem and exits on a bad environment. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Config.safeParse(env);
  if (parsed.success) return parsed.data;
  const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid core-api environment:\n${lines.join("\n")}`);
}
```
9. Create `apps/core-api/test/helpers.ts`:
```ts
import { Config } from "../src/config.ts";

/** Screenshot clock (Mon 5 Oct 10:42 UTC); every test that needs "now" starts here. */
export const T0 = "2026-10-05T10:42:00.000Z";

/** A complete, valid config for tests; override any key. */
export function testConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  return Config.parse({
    DB_PATH: ":memory:",
    COOKIE_SECRET: "test-cookie-secret-test-cookie-secret",
    INITIAL_ROOM_PIN: "1234",
    INITIAL_TECH_PIN: "123456",
    ...overrides,
  });
}

/** Unwraps a value a test knows is there (no `!` allowed by lint). */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
```
10. Create `apps/core-api/test/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const BASE = { DB_PATH: "/tmp/x.db", COOKIE_SECRET: "x".repeat(32) };

describe("config", () => {
  it("applies defaults", () => {
    const config = loadConfig(BASE);
    expect(config).toMatchObject({ PORT: 3000, HOST: "0.0.0.0", HW_URL: "http://127.0.0.1:8081", ROOM_ID: "R-101", ROOM_HOSTNAME: "r-101.local" });
    expect(config).toMatchObject({ LOCALHOST_IS_KIOSK: false, SEED_FAKE_IR_CODES: false, TIMEOUT_IR_SEND_MS: 3000, HW_DOWN_GRACE_MS: 10_000 });
  });
  it("parses booleans and numbers from strings", () => {
    expect(loadConfig({ ...BASE, LOCALHOST_IS_KIOSK: "true", PORT: "80" })).toMatchObject({ LOCALHOST_IS_KIOSK: true, PORT: 80 });
  });
  it("lists every problem", () => {
    expect(() => loadConfig({ DB_PATH: "", COOKIE_SECRET: "short", INITIAL_ROOM_PIN: "12345", LOCALHOST_IS_KIOSK: "yes" })).toThrow(
      /DB_PATH[\s\S]*COOKIE_SECRET must be at least 32 characters[\s\S]*LOCALHOST_IS_KIOSK[\s\S]*INITIAL_ROOM_PIN must be 4 digits/,
    );
  });
});
```

**Test:** `apps/core-api/test/config.test.ts` (above): defaults, string → boolean/number parsing, every problem listed.

**Verify:** `pnpm --filter @eduscope/core-api test` → 3 passed. `pnpm verify` → exit 0 (typecheck now includes core-api). `git status` shows `pnpm-lock.yaml` changed — commit it.

**Commit:** `git add -A && git commit -m "chore(core-api): scaffold, dependencies and zod-parsed config"` (includes this plan file with the box ticked)

### T3 — Drizzle schema, first generated migration, `openDb()`
- [x] done

**Files:** `apps/core-api/src/db/schema.ts`, `apps/core-api/drizzle.config.ts`, `apps/core-api/drizzle/0000_init.sql` + drizzle/meta/* (generated), `apps/core-api/src/paths.ts`, `apps/core-api/src/db/client.ts`, `apps/core-api/test/db/client.test.ts`

**Context:** ARCHITECTURE §6.2: all seven tables now (M09 adds none): `settings`, `devices`, `ir_commands`, `sessions`, `class_blocks`, `timed_actions`, `event_log`; SQLite WAL + `foreign_keys=ON`; migrations are generated by drizzle-kit, committed, never hand-edited; `migrate()` before listening. `sessions` gets an `unlocked_at` column (ClientSession has it) and both `devices`/`ir_commands` a `sort` column. `src/paths.ts` sits directly in `src/` so `../drizzle/` resolves from `src/*.ts` (tsx, Vitest) and from `dist/main.js` (D9).

**Do:**
1. Create `apps/core-api/src/db/schema.ts`:
```ts
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ARCHITECTURE §6.2 — every table core-api will ever need (M09 adds none). Timestamps are ISO
// strings (server time); json columns hold JSON text. Edit → `pnpm --filter @eduscope/core-api db:generate`.

/** room id/hostname overrides, PIN hashes, kWh midnight baseline, interlock bypass. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updated_at: text("updated_at").notNull(),
});

/** Device/Output registry (S3d) and IrDevice rows (transport ir_*). */
export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  transport: text("transport").notNull(),
  brand: text("brand"),
  model: text("model"),
  hw_ref: text("hw_ref"),
  sort: integer("sort").notNull(),
});

/** IrCommand (R4, R5). `code` is technician-only and never leaves core-api over WS. */
export const irCommands = sqliteTable(
  "ir_commands",
  {
    id: text("id").primaryKey(),
    device_id: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    setpoint_temp_c: integer("setpoint_temp_c"),
    setpoint_mode: text("setpoint_mode"),
    setpoint_fan: text("setpoint_fan"),
    code_format: text("code_format").notNull(),
    code: text("code"),
    captured_at: text("captured_at"),
    test: text("test").notNull(),
    tested_at: text("tested_at"),
    sort: integer("sort").notNull(),
  },
  (table) => [index("ir_commands_device_idx").on(table.device_id)],
);

/** ClientSession rows; `id` is the cookie value, `public_id` is safe to broadcast. */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  public_id: text("public_id").notNull().unique(),
  access: text("access").notNull(),
  client_type: text("client_type").notNull(),
  label: text("label").notNull(),
  ip: text("ip").notNull(),
  created_at: text("created_at").notNull(),
  unlocked_at: text("unlocked_at"),
  last_activity: text("last_activity"),
  expires_at: text("expires_at"),
});

/** Schedule.class_blocks (§2.3); used from M09. */
export const classBlocks = sqliteTable("class_blocks", {
  id: text("id").primaryKey(),
  days: text("days").notNull(), // JSON Weekday[]
  start: text("start").notNull(), // "HH:MM"
  end: text("end").notNull(),
});

/** Schedule.actions; used from M09. */
export const timedActions = sqliteTable("timed_actions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  time: text("time").notNull(),
  days: text("days").notNull(), // JSON Weekday[]
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  steps: text("steps").notNull(), // JSON CommandBody[]
});

/** Command history and audit (30-day retention from M09). */
export const eventLog = sqliteTable(
  "event_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at").notNull(),
    type: text("type").notNull(), // command | state | session | pin_failure | hw | system
    actor: text("actor"),
    public_id: text("public_id"),
    subject: text("subject"),
    payload: text("payload"), // JSON
    result: text("result"),
  },
  (table) => [index("event_log_at_idx").on(table.at)],
);
```
2. Create `apps/core-api/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

// Only used by `db:generate`; the app runs the generated SQL with drizzle's migrator (src/db/client.ts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
```
3. Run (creates `apps/core-api/drizzle/0000_init.sql` and `apps/core-api/drizzle/meta/{_journal,0000_snapshot}.json`. The output must say `7 tables`. Never edit these files):
```sh
pnpm --filter @eduscope/core-api db:generate --name init
```
4. Create `apps/core-api/src/paths.ts`:
```ts
import { fileURLToPath } from "node:url";

// Lives directly in src/ so the same relative URL works from src/*.ts (tsx, vitest) and from the
// bundled dist/main.js: both sit one level below apps/core-api/.
export const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle/", import.meta.url));
```
5. Create `apps/core-api/src/db/client.ts`:
```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { MIGRATIONS_DIR } from "../paths.ts";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

/** Opens (creating the folder and file if needed) and migrates the database. `:memory:` for tests. */
export function openDb(path: string): { db: Db; sqlite: Database.Database; close: () => void } {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, sqlite, close: () => sqlite.close() };
}
```
6. Create `apps/core-api/test/db/client.test.ts`:
```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/client.ts";
import { devices } from "../../src/db/schema.ts";

describe("openDb", () => {
  it("creates every §6.2 table through the generated migration", () => {
    const { sqlite, close } = openDb(":memory:");
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name != 'sqlite_sequence' order by name")
      .all();
    expect(tables).toEqual(
      ["class_blocks", "devices", "event_log", "ir_commands", "sessions", "settings", "timed_actions"].map((name) => ({ name })),
    );
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    close();
  });

  it("creates the folder and file, and re-opening runs no migration twice", () => {
    const path = join(mkdtempSync(join(tmpdir(), "core-db-")), "nested", "eduscope.db");
    const first = openDb(path);
    first.db.insert(devices).values({ id: "x", name: "X", kind: "other", transport: "local", sort: 1 }).run();
    first.close();
    const second = openDb(path);
    expect(second.db.select().from(devices).all()).toHaveLength(1);
    expect(second.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    second.close();
  });
});
```

**Test:** `apps/core-api/test/db/client.test.ts` (above): the seven tables exist, `foreign_keys` is on, the folder is created, WAL is on, re-opening an existing file keeps its rows.

**Verify:** `pnpm --filter @eduscope/core-api test` → 5 passed. `pnpm verify` → exit 0. `git status` lists `apps/core-api/drizzle/` (commit it).

**Commit:** `git add -A && git commit -m "feat(core-api): drizzle schema, first migration, openDb"` (includes this plan file with the box ticked)

### T4 — PIN hashing (scrypt)
- [x] done

**Files:** `apps/core-api/src/auth/pin-hash.ts`, `apps/core-api/test/auth/pin-hash.test.ts`

**Context:** ARCHITECTURE §5 / D-08: `scrypt$N$r$p$salt$hash` with `node:crypto`, compared with `timingSafeEqual`. No native bcrypt/argon2.

**Do:**
1. Create `apps/core-api/src/auth/pin-hash.ts`:
```ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// ARCHITECTURE §5 / D-08: `scrypt$N$r$p$salt$hash` (base64), node:crypto only.

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function derive(pin: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pin, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Constant-time compare; a malformed stored hash never matches. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || n === undefined || r === undefined || p === undefined || salt === undefined || hash === undefined) {
    return false;
  }
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(pin, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```
2. Create `apps/core-api/test/auth/pin-hash.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "../../src/auth/pin-hash.ts";

describe("PIN hash (D-08)", () => {
  it("scrypt round trip; a wrong PIN or a malformed hash never matches", async () => {
    const hash = await hashPin("1234");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    expect(await verifyPin("1234", hash)).toBe(true);
    expect(await verifyPin("1235", hash)).toBe(false);
    expect(await verifyPin("1234", "plain-1234")).toBe(false);
    expect(await hashPin("1234")).not.toBe(hash); // salted
  });
});
```

**Test:** `apps/core-api/test/auth/pin-hash.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 6 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): scrypt PIN hashing"` (includes this plan file with the box ticked)

### T5 — Settings table access and the idempotent R-101 seed
- [x] done

**Files:** `apps/core-api/src/db/settings.ts`, `apps/core-api/src/db/seed.ts`, `apps/core-api/test/db/seed.test.ts`

**Context:** M08 scope: idempotent `seed.ts` — R-101 devices, AC 13 setpoint commands + projector 2 commands as `code: null`, PIN hashes from env on first boot. Q23 `[ASSUMED]`: 13 setpoints 18–30 °C, cool, auto fan, plus AC "Power off" = 14 AC commands (S3.E7 shows `14`). Device ids/names/models/hw_refs equal `packages/contracts/fixtures/state/room-normal.json` because the kiosk finds devices by id (`lights`, `projector_socket`, `ir_blaster`, …). Milestone note: `SEED_FAKE_IR_CODES=true` (dev only) fills missing codes; the projector codes equal hw-service's `HW_FAKE_PROJECTOR_ON/OFF_CODE` so the fake projector ramps (AC3) (D19). Every insert is insert-if-missing (AC10).

**Do:**
1. Create `apps/core-api/src/db/settings.ts`:
```ts
import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "./client.ts";
import { settings } from "./schema.ts";

/** Keys of the `settings` table (ARCHITECTURE §6.2). */
export type SettingKey = "room_pin_hash" | "technician_pin_hash" | "kwh_baseline" | "interlock_bypass";

/** The stored JSON value parsed with `schema`; null when missing or not matching. */
export function readSetting<S extends z.ZodType>(db: Db, key: SettingKey, schema: S): z.infer<S> | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (row === undefined) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(row.value);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function writeSetting(db: Db, key: SettingKey, value: unknown, at: string): void {
  const json = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: json, updated_at: at })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updated_at: at } })
    .run();
}
```
2. Create `apps/core-api/src/db/seed.ts`:
```ts
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPin } from "../auth/pin-hash.ts";
import type { Config } from "../config.ts";
import type { Db } from "./client.ts";
import { readSetting, writeSetting } from "./settings.ts";
import { devices, irCommands } from "./schema.ts";

// Idempotent first-boot data for R-101 (ARCHITECTURE §6.2). Every insert is "insert if missing",
// so a restart never duplicates rows and never overwrites a PIN, a rename or a captured code.

type DeviceRow = typeof devices.$inferInsert;
type IrCommandRow = typeof irCommands.$inferInsert;

/** Ids equal fixtures/state/room-normal.json: the kiosk looks devices up by these ids. */
export const SEED_DEVICES: readonly DeviceRow[] = [
  { id: "projector", name: "Projector", kind: "projector", transport: "ir_zs06", brand: "Epson", model: null, hw_ref: null, sort: 1 },
  { id: "hdmi_switch", name: "HDMI switch", kind: "hdmi_switch", transport: "local", brand: null, model: null, hw_ref: null, sort: 2 },
  { id: "projection_screen", name: "Projection screen", kind: "projection_screen", transport: "local", brand: null, model: null, hw_ref: null, sort: 3 },
  { id: "lights", name: "Lighting switch", kind: "lights", transport: "zigbee", brand: null, model: "ZBM5-2C-86W", hw_ref: "r101_lights", sort: 4 },
  { id: "ac", name: "Air conditioning", kind: "ac", transport: "ir_zs06", brand: "Panasonic", model: null, hw_ref: null, sort: 5 },
  { id: "audio", name: "Audio mixer", kind: "audio", transport: "local", brand: null, model: null, hw_ref: null, sort: 6 },
  { id: "projector_socket", name: "Projector socket", kind: "power_socket", transport: "zigbee", brand: null, model: "S60ZBTPG", hw_ref: "r101_proj_plug", sort: 7 },
  { id: "room_climate", name: "Room climate", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-02P", hw_ref: "r101_temp", sort: 8 },
  { id: "motion", name: "Motion", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-03P", hw_ref: "r101_motion", sort: 9 },
  { id: "door", name: "Door", kind: "sensor", transport: "zigbee", brand: null, model: "SNZB-04PR2", hw_ref: "r101_door", sort: 10 },
  { id: "ir_blaster", name: "ZS06", kind: "ir_blaster", transport: "zigbee", brand: null, model: "ZS06", hw_ref: "r101_ir", sort: 11 },
  { id: "coordinator", name: "Coordinator", kind: "coordinator", transport: "local", brand: null, model: "ZG-808Z", hw_ref: "zigbee-coord", sort: 12 },
];

/** AC setpoint frames 18–30 °C, cool, auto fan (Q23 [ASSUMED]). */
export const SEED_AC_SETPOINTS = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;

function irCommand(id: string, deviceId: string, name: string, role: string, sort: number, tempC: number | null = null): IrCommandRow {
  return {
    id, device_id: deviceId, name, role, sort, code_format: "tuya", code: null, captured_at: null, test: "untested", tested_at: null,
    setpoint_temp_c: tempC, setpoint_mode: tempC === null ? null : "cool", setpoint_fan: tempC === null ? null : "auto",
  };
}

/** Projector 2 + AC 14 (power off + 13 setpoints), all without a code until M09 learns them. */
export const SEED_IR_COMMANDS: readonly IrCommandRow[] = [
  irCommand("projector.power_on", "projector", "Power on", "power_on", 1),
  irCommand("projector.power_off", "projector", "Power off", "power_off", 2),
  irCommand("ac.power_off", "ac", "Power off", "power_off", 1),
  ...SEED_AC_SETPOINTS.map((temp, i) => irCommand(`ac.setpoint_${temp}`, "ac", `${temp}°`, "setpoint", i + 2, temp)),
];

/** Equal to hw-service's HW_FAKE_PROJECTOR_ON/OFF_CODE defaults (services/hw/app/config.py). */
export const FAKE_PROJECTOR_CODES: Readonly<Record<string, string>> = {
  "projector.power_on": "C/8hRgHrBkYBgAMH",
  "projector.power_off": "C/8hRgHrBkYBgAMP",
};

const fakeCode = (id: string): string => FAKE_PROJECTOR_CODES[id] ?? Buffer.from(`fake:${id}`).toString("base64");

export async function seed(db: Db, config: Pick<Config, "INITIAL_ROOM_PIN" | "INITIAL_TECH_PIN" | "SEED_FAKE_IR_CODES">, now: string): Promise<void> {
  db.insert(devices).values([...SEED_DEVICES]).onConflictDoNothing().run();
  db.insert(irCommands).values([...SEED_IR_COMMANDS]).onConflictDoNothing().run();

  if (config.SEED_FAKE_IR_CODES) {
    for (const command of SEED_IR_COMMANDS) {
      db.update(irCommands)
        .set({ code: fakeCode(command.id), captured_at: now })
        .where(and(eq(irCommands.id, command.id), isNull(irCommands.code)))
        .run();
    }
  }

  if (readSetting(db, "room_pin_hash", z.string()) === null) {
    if (config.INITIAL_ROOM_PIN === undefined) throw new Error("INITIAL_ROOM_PIN is required on first boot");
    writeSetting(db, "room_pin_hash", await hashPin(config.INITIAL_ROOM_PIN), now);
  }
  if (readSetting(db, "technician_pin_hash", z.string()) === null) {
    if (config.INITIAL_TECH_PIN === undefined) throw new Error("INITIAL_TECH_PIN is required on first boot");
    writeSetting(db, "technician_pin_hash", await hashPin(config.INITIAL_TECH_PIN), now);
  }
  if (readSetting(db, "interlock_bypass", z.boolean()) === null) writeSetting(db, "interlock_bypass", false, now);
}
```
3. Create `apps/core-api/test/db/seed.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { verifyPin } from "../../src/auth/pin-hash.ts";
import { openDb } from "../../src/db/client.ts";
import { devices, irCommands } from "../../src/db/schema.ts";
import { FAKE_PROJECTOR_CODES, seed } from "../../src/db/seed.ts";
import { readSetting } from "../../src/db/settings.ts";
import { testConfig } from "../helpers.ts";

const NOW = "2026-10-05T10:42:00.000Z";

describe("seed", () => {
  it("creates the R-101 devices, 16 IR commands without codes and both PIN hashes", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    expect(db.select().from(devices).all().map((d) => d.id)).toHaveLength(12);
    const commands = db.select().from(irCommands).all();
    expect(commands.filter((c) => c.device_id === "projector")).toHaveLength(2);
    expect(commands.filter((c) => c.device_id === "ac")).toHaveLength(14);
    expect(commands.every((c) => c.code === null)).toBe(true);
    const roomHash = readSetting(db, "room_pin_hash", z.string());
    expect(roomHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPin("1234", roomHash ?? "")).toBe(true);
    expect(await verifyPin("123456", readSetting(db, "technician_pin_hash", z.string()) ?? "")).toBe(true);
    expect(readSetting(db, "interlock_bypass", z.boolean())).toBe(false);
  });

  it("is idempotent and never overwrites a PIN hash", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    const hash = readSetting(db, "room_pin_hash", z.string());
    await seed(db, testConfig({ INITIAL_ROOM_PIN: "9999" }), NOW);
    expect(db.select().from(devices).all()).toHaveLength(12);
    expect(db.select().from(irCommands).all()).toHaveLength(16);
    expect(readSetting(db, "room_pin_hash", z.string())).toBe(hash);
  });

  it("SEED_FAKE_IR_CODES fills only missing codes, with the fake projector codes", async () => {
    const { db } = openDb(":memory:");
    await seed(db, testConfig(), NOW);
    db.update(irCommands).set({ code: "learned" }).where(eq(irCommands.id, "ac.setpoint_24")).run();
    await seed(db, testConfig({ SEED_FAKE_IR_CODES: "true" }), NOW);
    const byId = new Map(db.select().from(irCommands).all().map((c) => [c.id, c]));
    expect(byId.get("projector.power_on")?.code).toBe(FAKE_PROJECTOR_CODES["projector.power_on"]);
    expect(byId.get("ac.setpoint_24")?.code).toBe("learned");
    expect(byId.get("ac.setpoint_18")?.captured_at).toBe(NOW);
  });

  it("fails on first boot without the initial PINs", async () => {
    const { db } = openDb(":memory:");
    const config = { ...testConfig(), INITIAL_ROOM_PIN: undefined };
    await expect(seed(db, config, NOW)).rejects.toThrow("INITIAL_ROOM_PIN is required on first boot");
  });
});
```

**Test:** `apps/core-api/test/db/seed.test.ts` (above): 12 devices, 16 IR commands without codes, both PIN hashes verify; a second run duplicates nothing and keeps the PIN hash; fake codes fill only missing ones; first boot without `INITIAL_ROOM_PIN` fails with `INITIAL_ROOM_PIN is required on first boot`.

**Verify:** `pnpm --filter @eduscope/core-api test` → 10 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): idempotent R-101 seed"` (includes this plan file with the box ticked)

### T6 — `event_log` writer
- [x] done

**Files:** `apps/core-api/src/clock.ts`, `apps/core-api/src/db/event-log.ts`, `apps/core-api/test/db/event-log.test.ts`

**Context:** ARCHITECTURE §6.2 `event_log` (`type` command | state | session | pin_failure | hw | system) and §9 Logs: commands, PIN failures, hw up/down are written to SQLite. Pruning is M09. `clock.ts` is the injectable clock of ARCHITECTURE §6.1 (`deps.clock`); every later module and test uses it.

**Do:**
1. Create `apps/core-api/src/clock.ts`:
```ts
/** Injectable time source (ARCHITECTURE §6.1 `deps.clock`). Timers stay real; tests fake them with vi. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** A clock that only moves when told to (tests). */
export interface FixedClock extends Clock {
  set(iso: string): void;
  advance(ms: number): void;
}

export function fixedClock(iso: string): FixedClock {
  let current = new Date(iso).getTime();
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next).getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };
}
```
2. Create `apps/core-api/src/db/event-log.ts`:
```ts
import type { Clock } from "../clock.ts";
import type { Db } from "./client.ts";
import { eventLog } from "./schema.ts";

// ARCHITECTURE §6.2 `event_log`: commands, by-hand changes, sessions, PIN failures, hw up/down.

export interface LogEntry {
  type: "command" | "state" | "session" | "pin_failure" | "hw" | "system";
  actor?: string | null;
  public_id?: string | null;
  subject?: string | null;
  payload?: unknown;
  result?: string | null;
}

export type EventLogger = (entry: LogEntry) => void;

export function createEventLogger(db: Db, clock: Clock): EventLogger {
  return (entry) => {
    db.insert(eventLog)
      .values({
        at: clock.now().toISOString(),
        type: entry.type,
        actor: entry.actor ?? null,
        public_id: entry.public_id ?? null,
        subject: entry.subject ?? null,
        payload: entry.payload === undefined ? null : JSON.stringify(entry.payload),
        result: entry.result ?? null,
      })
      .run();
  };
}
```
3. Create `apps/core-api/test/db/event-log.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import { createEventLogger } from "../../src/db/event-log.ts";
import { eventLog } from "../../src/db/schema.ts";
import { T0 } from "../helpers.ts";

describe("event log", () => {
  it("writes one row per entry, stamped with the clock, payload as JSON", () => {
    const { db } = openDb(":memory:");
    const log = createEventLogger(db, fixedClock(T0));
    log({ type: "command", actor: "phone", public_id: "p1", subject: "lights.set", payload: { gang: "rear" }, result: "confirmed" });
    log({ type: "hw", subject: "link", result: "down" });
    expect(db.select().from(eventLog).all()).toEqual([
      { id: 1, at: T0, type: "command", actor: "phone", public_id: "p1", subject: "lights.set", payload: '{"gang":"rear"}', result: "confirmed" },
      { id: 2, at: T0, type: "hw", actor: null, public_id: null, subject: "link", payload: null, result: "down" },
    ]);
  });
});
```

**Test:** `apps/core-api/test/db/event-log.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 11 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): event_log writer"` (includes this plan file with the box ticked)

### T7 — Domain base: Observed helpers, model types, kWh today
- [x] done

**Files:** `apps/core-api/src/domain/observed.ts`, `apps/core-api/src/domain/model.ts`, `apps/core-api/src/domain/energy.ts`, `apps/core-api/test/domain/energy.test.ts`

**Context:** ARCHITECTURE §6.4 store model; SPEC §6 Observed<T>. `RoomModel` = the `RoomState` clients see + raw hw facts the rules need (per-channel mute flags, meter total, kWh baseline, hw-down time, joining deadline, interlock bypass) + the device registry. `OUTPUTS` equals the fixture's outputs per device id. kWh today (S2.E12, §6.4): meter total − the first total seen that local day (D8: no scheduler needed; a meter reset restarts the baseline).

**Do:**
1. Create `apps/core-api/src/domain/observed.ts`:
```ts
import type { ChangedBy, Confidence, Observed, Source } from "@eduscope/contracts";

// Small helpers every rule module uses to build Observed<T> values (SPEC §6 Observed).

/** Never reported (H11): value null, confidence unknown. */
export function unknown<T>(source: Source): Observed<T> {
  return { value: null, confidence: "unknown", source, updated_at: null, stale: false, changed_by: null };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * A fresh hardware report. `changed_by` survives only when the value did not change; who changed a
 * value is decided afterwards by attribution (H13).
 */
export function reported<T>(prev: Observed<T>, value: T | null, at: string, confidence: Confidence = "confirmed"): Observed<T> {
  return {
    value,
    confidence: value === null ? "unknown" : confidence,
    source: prev.source,
    updated_at: at,
    stale: false,
    changed_by: same(prev.value, value) ? prev.changed_by : null,
  };
}

/** A value core-api set itself (IR: assumed, R3), attributed to whoever caused it. */
export function assumed<T>(value: T, at: string, by: ChangedBy | null): Observed<T> {
  return { value, confidence: "assumed", source: "ir", updated_at: at, stale: false, changed_by: by };
}

export function withChangedBy<T>(observed: Observed<T>, by: ChangedBy | null): Observed<T> {
  return { ...observed, changed_by: by };
}

export function withStale<T>(observed: Observed<T>, stale: boolean): Observed<T> {
  return observed.stale === stale ? observed : { ...observed, stale };
}

export function sameValue(a: unknown, b: unknown): boolean {
  return same(a, b);
}
```
2. Create `apps/core-api/src/domain/model.ts`:
```ts
import type { DeviceKind, Output, RoomState, Transport } from "@eduscope/contracts";

// The store's whole world: the RoomState every client sees plus the raw hardware facts the rules
// need but RoomState does not carry (ARCHITECTURE §6.4).

export interface KwhBaseline {
  /** Local date "YYYY-MM-DD" the baseline belongs to. */
  date: string;
  kwh_total: number;
}

export interface HwFacts {
  /** Per-channel mute flags from the mixer; `muted_all` is derived from both (R9). */
  audio_muted: { mic: boolean | null; pc: boolean | null };
  /** Last `energy_kwh_total` from the power meter. */
  energy_kwh_total: number | null;
  /** kWh-today baseline (persisted in `settings`). */
  kwh_baseline: KwhBaseline | null;
  /** When the hw link went down; null while up (§6.7). */
  hw_down_since: string | null;
  /** Permit-join deadline from hw (`zigbee.mesh`). */
  joining_until: string | null;
  /** Shutdown interlock bypass (`settings.interlock_bypass`, R11). */
  interlock_bypassed: boolean;
}

export interface RoomModel {
  state: RoomState;
  facts: HwFacts;
  /** Device registry rows (DB `devices`), in sort order. */
  registry: readonly DeviceInfo[];
}

/** Registry data of one device (a `devices` row without the sort column). */
export interface DeviceInfo {
  id: string;
  name: string;
  kind: DeviceKind;
  transport: Transport;
  brand: string | null;
  model: string | null;
  hw_ref: string | null;
}

/** Rule parameters that come from config (R13, §6.7). */
export interface RuleConfig {
  climateIntervalS: number;
  powerIntervalS: number;
  hwDownGraceMs: number;
}

/** Controllable endpoints per seeded device id (equal to fixtures/state/room-normal.json). */
export const OUTPUTS: Readonly<Record<string, readonly Output[]>> = {
  projector: [{ id: "projector.ir", name: "Projector power", kind: "momentary" }],
  hdmi_switch: [{ id: "display.source", name: "Source", kind: "select" }],
  projection_screen: [{ id: "screen", name: "Projection screen", kind: "position" }],
  lights: [
    { id: "lights.front", name: "Front of room", kind: "switch" },
    { id: "lights.rear", name: "Rear of room", kind: "switch" },
  ],
  ac: [{ id: "ac", name: "Air conditioning", kind: "momentary" }],
  audio: [
    { id: "audio.mic", name: "Lecturer microphone", kind: "level" },
    { id: "audio.pc", name: "PC audio", kind: "level" },
  ],
  projector_socket: [{ id: "projector.mains", name: "Mains to projector", kind: "switch" }],
};
```
3. Create `apps/core-api/src/domain/energy.ts`:
```ts
import type { KwhBaseline } from "./model.ts";

// S2.E12 "TODAY": kWh since local midnight = meter total − the first total seen that local day.

/** Local calendar date "YYYY-MM-DD" in the process time zone (the Pi's). */
export function localDate(at: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** A new day (or no baseline yet) starts a new baseline at this total. Never negative (meter reset). */
export function kwhToday(baseline: KwhBaseline | null, totalKwh: number, date: string): { baseline: KwhBaseline; kwhToday: number } {
  const current = baseline !== null && baseline.date === date && baseline.kwh_total <= totalKwh ? baseline : { date, kwh_total: totalKwh };
  return { baseline: current, kwhToday: Math.round((totalKwh - current.kwh_total) * 1000) / 1000 };
}
```
4. Create `apps/core-api/test/domain/energy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { kwhToday, localDate } from "../../src/domain/energy.ts";

describe("kWh today", () => {
  it("localDate is the process-local calendar date (TZ=UTC in tests)", () => {
    expect(localDate(new Date("2026-10-05T23:59:59Z"))).toBe("2026-10-05");
    expect(localDate(new Date("2026-10-06T00:00:00Z"))).toBe("2026-10-06");
  });
  it.each([
    [null, 412.67, "2026-10-05", { date: "2026-10-05", kwh_total: 412.67 }, 0],
    [{ date: "2026-10-05", kwh_total: 412.67 }, 414.51, "2026-10-05", { date: "2026-10-05", kwh_total: 412.67 }, 1.84],
    [{ date: "2026-10-04", kwh_total: 400 }, 414.51, "2026-10-05", { date: "2026-10-05", kwh_total: 414.51 }, 0],
    [{ date: "2026-10-05", kwh_total: 412.67 }, 2, "2026-10-05", { date: "2026-10-05", kwh_total: 2 }, 0], // meter reset
  ])("baseline %j, total %d on %s", (baseline, total, date, expectedBaseline, expected) => {
    expect(kwhToday(baseline, total, date)).toEqual({ baseline: expectedBaseline, kwhToday: expected });
  });
});
```

**Test:** `apps/core-api/test/domain/energy.test.ts` (above, table-driven). `TZ=UTC` comes from `vitest.config.ts`.

**Verify:** `pnpm --filter @eduscope/core-api test` → 16 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): domain model, Observed helpers, kWh today"` (includes this plan file with the box ticked)

### T8 — Projector rules: R1 state from draw, R2, H7b feedback
- [x] done

**Files:** `apps/core-api/src/domain/projector.ts`, `apps/core-api/test/domain/projector.test.ts`

**Context:** SPEC R1 (>50 W running, <5 W standby, between = warming up / cooling down by the last command or the direction), R2 (IR alone never confirms), H7b ("Power on sent · waiting for draw", after 90 s "no change in draw"), S1.E13, S2.E12 (RATING 13 A static). The kiosk's `features/control/display/projector.view.ts` reads `state` (confirmed by the meter) and `feedback.phase`; this module produces exactly those.

**Do:**
1. Create `apps/core-api/src/domain/projector.ts`:
```ts
import type { ProjectorFeedback, ProjectorState } from "@eduscope/contracts";
import { kwhToday, localDate } from "./energy.ts";
import type { RoomModel } from "./model.ts";
import { reported } from "./observed.ts";

// R1 (state from draw), R2 (IR alone never confirms), H7b (waiting for draw / no change).

export const RUNNING_ABOVE_W = 50;
export const STANDBY_BELOW_W = 5;
export const NO_CHANGE_AFTER_MS = 90_000;
/** S2.E12 RATING, static (SPEC §6 PowerReading). */
export const RATING_A = 13;

type LastIr = ProjectorFeedback["last_ir"];

/** R1: >50 W running, <5 W standby; in between the commanded or ongoing direction decides. */
export function stateFromDraw(watts: number, prev: ProjectorState | null, feedback: ProjectorFeedback): ProjectorState {
  if (watts > RUNNING_ABOVE_W) return "running";
  if (watts < STANDBY_BELOW_W) return "standby";
  if (feedback.phase === "waiting_for_draw" && feedback.last_ir !== null) {
    return feedback.last_ir === "power_on" ? "warming_up" : "cooling_down";
  }
  if (prev === "running" || prev === "cooling_down") return "cooling_down";
  if (prev === "standby" || prev === "warming_up") return "warming_up";
  if (feedback.last_ir !== null) return feedback.last_ir === "power_on" ? "warming_up" : "cooling_down";
  return "unknown";
}

/** The draw already shows the effect of the last IR command. */
export function drawAgrees(lastIr: LastIr, state: ProjectorState | null): boolean {
  if (lastIr === "power_on") return state === "warming_up" || state === "running";
  if (lastIr === "power_off") return state === "cooling_down" || state === "standby";
  return false;
}

/** Feedback right after core-api sends a power IR command (before the ack). */
export function feedbackAfterIr(on: boolean, state: ProjectorState | null, at: string): ProjectorFeedback {
  const lastIr = on ? "power_on" : "power_off";
  return { last_ir: lastIr, sent_at: at, phase: drawAgrees(lastIr, state) ? "idle" : "waiting_for_draw" };
}

/** H7b: waiting → idle once the draw agrees; waiting → no_change after 90 s; a late change still clears it. */
export function nextPhase(feedback: ProjectorFeedback, state: ProjectorState | null, now: Date): ProjectorFeedback {
  if (feedback.phase === "idle") return feedback;
  if (drawAgrees(feedback.last_ir, state)) return { ...feedback, phase: "idle" };
  if (feedback.phase === "waiting_for_draw" && feedback.sent_at !== null) {
    if (now.getTime() - Date.parse(feedback.sent_at) >= NO_CHANGE_AFTER_MS) return { ...feedback, phase: "no_change" };
  }
  return feedback;
}

/** A `projector_power.reading`: live power, kWh today and the R1 state, all confirmed by the meter. */
export function applyPowerReading(
  model: RoomModel,
  reading: { watts: number; volts: number; energy_kwh_total: number },
  at: string,
): RoomModel {
  const { projector } = model.state.display;
  const energy = kwhToday(model.facts.kwh_baseline, reading.energy_kwh_total, localDate(new Date(at)));
  const state = stateFromDraw(reading.watts, projector.state.value, projector.feedback);
  const power = { watts: reading.watts, volts: reading.volts, kwh_today: energy.kwhToday, rating_a: RATING_A, at };
  return {
    ...model,
    state: {
      ...model.state,
      display: {
        ...model.state.display,
        projector: {
          ...projector,
          state: reported(projector.state, state, at),
          power: reported(projector.power, power, at),
          feedback: nextPhase(projector.feedback, state, new Date(at)),
        },
      },
    },
    facts: { ...model.facts, energy_kwh_total: reading.energy_kwh_total, kwh_baseline: energy.baseline },
  };
}
```
2. Create `apps/core-api/test/domain/projector.test.ts`:
```ts
import type { ProjectorFeedback, ProjectorState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { drawAgrees, feedbackAfterIr, nextPhase, stateFromDraw } from "../../src/domain/projector.ts";
import { T0 } from "../helpers.ts";

const IDLE: ProjectorFeedback = { last_ir: null, sent_at: null, phase: "idle" };
const WAIT_ON: ProjectorFeedback = { last_ir: "power_on", sent_at: T0, phase: "waiting_for_draw" };
const WAIT_OFF: ProjectorFeedback = { last_ir: "power_off", sent_at: T0, phase: "waiting_for_draw" };

describe("R1 stateFromDraw", () => {
  const cases: [number, ProjectorState | null, ProjectorFeedback, ProjectorState][] = [
    [287, null, IDLE, "running"],
    [51, "standby", IDLE, "running"],
    [50, "running", IDLE, "cooling_down"], // 50 W is "between"
    [3, null, IDLE, "standby"],
    [4.9, "running", IDLE, "standby"],
    [5, "standby", IDLE, "warming_up"],
    [24, null, WAIT_ON, "warming_up"],
    [24, "running", WAIT_ON, "warming_up"], // the command in flight decides
    [45, "standby", WAIT_OFF, "cooling_down"],
    [45, "running", IDLE, "cooling_down"],
    [12, "warming_up", IDLE, "warming_up"],
    [30, "cooling_down", IDLE, "cooling_down"],
    [30, null, { last_ir: "power_off", sent_at: T0, phase: "idle" }, "cooling_down"],
    [30, null, IDLE, "unknown"],
  ];
  it.each(cases)("%d W after %s (%j) → %s", (watts, prev, feedback, expected) => {
    expect(stateFromDraw(watts, prev, feedback)).toBe(expected);
  });
});

describe("H7b feedback", () => {
  it("drawAgrees per direction", () => {
    expect(drawAgrees("power_on", "warming_up")).toBe(true);
    expect(drawAgrees("power_on", "standby")).toBe(false);
    expect(drawAgrees("power_off", "cooling_down")).toBe(true);
    expect(drawAgrees(null, "running")).toBe(false);
  });
  it("IR sent while the draw already agrees is idle at once", () => {
    expect(feedbackAfterIr(true, "running", T0)).toEqual({ last_ir: "power_on", sent_at: T0, phase: "idle" });
    expect(feedbackAfterIr(true, "standby", T0).phase).toBe("waiting_for_draw");
  });
  const at = (ms: number): Date => new Date(Date.parse(T0) + ms);
  it.each([
    [WAIT_ON, "standby", 89_999, "waiting_for_draw"],
    [WAIT_ON, "standby", 90_000, "no_change"],
    [WAIT_ON, "warming_up", 1_000, "idle"],
    [{ ...WAIT_ON, phase: "no_change" }, "standby", 200_000, "no_change"],
    [{ ...WAIT_ON, phase: "no_change" }, "running", 200_000, "idle"],
  ] as const)("%j with %s after %d ms → %s", (feedback, state, ms, phase) => {
    expect(nextPhase(feedback, state, at(ms)).phase).toBe(phase);
  });
});
```

**Test:** `apps/core-api/test/domain/projector.test.ts` (above): 14-row R1 table, `drawAgrees`, `feedbackAfterIr`, 5-row H7b table at 89 999 / 90 000 ms.

**Verify:** `pnpm --filter @eduscope/core-api test` → 37 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): R1/R2/H7b projector rules"` (includes this plan file with the box ticked)

### T9 — AC rules: R3 assumed, R4 captured setpoints, Q5, H19
- [x] done

**Files:** `apps/core-api/src/domain/ac.ts`, `apps/core-api/test/domain/ac.test.ts`

**Context:** SPEC R3 (never confirmed; "Unknown" until the first command after start), R4 (−/+ step to the next *captured* setpoint, skipping uncaptured ones), S1.E35 (Power on sends the frame for the current setpoint), Q5 (−/+ disabled while off ⇒ core-api rejects), H19 (bounds). Default 24 °C `[ASSUMED]` like the mock.

**Do:**
1. Create `apps/core-api/src/domain/ac.ts`:
```ts
import type { AcState, ChangedBy } from "@eduscope/contracts";
import { assumed } from "./observed.ts";

// R3 (always assumed, Unknown after start), R4 (−/+ step through captured frames only), Q5, H19.

/** Power on with no setpoint sent since start sends this frame when captured [ASSUMED]. */
export const DEFAULT_SETPOINT_C = 24;

/** The frame AC Power on sends (S1.E35): the current setpoint, else 24°, else the middle captured one. */
export function powerOnSetpoint(ac: AcState): number | null {
  const current = ac.setpoint_c.value;
  if (current !== null && ac.available_setpoints.includes(current)) return current;
  if (ac.available_setpoints.includes(DEFAULT_SETPOINT_C)) return DEFAULT_SETPOINT_C;
  return ac.available_setpoints[Math.floor(ac.available_setpoints.length / 2)] ?? null;
}

export type StepResult = { ok: true; temp_c: number } | { ok: false; reason: string };

/** R4 next lower/higher captured setpoint; Q5 rejects −/+ unless the AC is assumed on; H19 at the ends. */
export function stepTarget(ac: AcState, direction: "down" | "up"): StepResult {
  if (ac.power.value !== "on") return { ok: false, reason: "Turn the air conditioning on first" };
  const current = ac.setpoint_c.value;
  if (current === null) return { ok: false, reason: "Air conditioning setpoint is unknown" };
  const candidates = ac.available_setpoints.filter((t) => (direction === "up" ? t > current : t < current));
  if (candidates.length === 0) {
    return { ok: false, reason: direction === "up" ? "Already at the highest setpoint" : "Already at the lowest setpoint" };
  }
  return { ok: true, temp_c: direction === "up" ? Math.min(...candidates) : Math.max(...candidates) };
}

/** After the blaster accepted a frame: power and/or setpoint become assumed values (R3). */
export function acSent(ac: AcState, change: { power?: "on" | "off"; setpoint_c?: number }, at: string, by: ChangedBy | null): AcState {
  return {
    ...ac,
    power: change.power === undefined ? ac.power : assumed(change.power, at, by),
    setpoint_c: change.setpoint_c === undefined ? ac.setpoint_c : assumed(change.setpoint_c, at, by),
  };
}
```
2. Create `apps/core-api/test/domain/ac.test.ts`:
```ts
import type { AcState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { acSent, powerOnSetpoint, stepTarget } from "../../src/domain/ac.ts";
import { unknown } from "../../src/domain/observed.ts";
import { T0 } from "../helpers.ts";

function ac(power: "on" | "off" | null, setpoint: number | null, available: number[]): AcState {
  const obs = <T>(value: T | null) => ({ ...unknown<T>("ir"), value, confidence: value === null ? ("unknown" as const) : ("assumed" as const) });
  return { power: obs(power), setpoint_c: obs(setpoint), available_setpoints: available };
}

describe("R4 AC setpoints", () => {
  it.each([
    [ac(null, null, [18, 24, 30]), 24],
    [ac("off", 20, [18, 20, 24]), 20],
    [ac(null, null, [18, 19, 20]), 19], // no 24 captured: the middle one
    [ac(null, 22, [18, 30]), 30], // 22 not captured any more: the middle of [18, 30] (index 1)
    [ac(null, null, []), null],
  ])("power on frame for %j → %s", (state, expected) => {
    expect(powerOnSetpoint(state)).toBe(expected);
  });

  it.each([
    [ac("on", 24, [18, 22, 24, 26]), "up", { ok: true, temp_c: 26 }],
    [ac("on", 24, [18, 22, 24, 26]), "down", { ok: true, temp_c: 22 }], // 23 never captured: skipped
    [ac("on", 26, [18, 22, 24, 26]), "up", { ok: false, reason: "Already at the highest setpoint" }], // H19
    [ac("on", 18, [18, 22]), "down", { ok: false, reason: "Already at the lowest setpoint" }],
    [ac("off", 24, [18, 24, 30]), "up", { ok: false, reason: "Turn the air conditioning on first" }], // Q5
    [ac(null, null, [18, 24]), "up", { ok: false, reason: "Turn the air conditioning on first" }], // R3 Unknown
    [ac("on", null, [18, 24]), "up", { ok: false, reason: "Air conditioning setpoint is unknown" }],
  ] as const)("step %j %s → %j", (state, direction, expected) => {
    expect(stepTarget(state, direction)).toEqual(expected);
  });

  it("R3: a sent frame is assumed, from IR, attributed", () => {
    const next = acSent(ac(null, null, [24]), { power: "on", setpoint_c: 24 }, T0, "phone");
    expect(next.power).toEqual({ value: "on", confidence: "assumed", source: "ir", updated_at: T0, stale: false, changed_by: "phone" });
    expect(next.setpoint_c.value).toBe(24);
    expect(acSent(next, { power: "off" }, T0, "laptop").setpoint_c).toBe(next.setpoint_c);
  });
});
```

**Test:** `apps/core-api/test/domain/ac.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 50 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): R3/R4 AC rules"` (includes this plan file with the box ticked)

### T10 — Attribution texts (H13)
- [x] done

**Files:** `apps/core-api/src/domain/attribution.ts`, `apps/core-api/test/domain/attribution.test.ts`

**Context:** SPEC §2.4 / H13: toast "Rear of room turned on · from phone". The kiosk's `formatActivity(text, by)` appends " · from …" / " · by hand", so `activity.text` is only "Rear of room turned on". The texts equal the mock's `describeCommand` (`apps/kiosk/src/data/adapters/mock/mock-rules.ts`; never import it). R6: a light change with no matching command is "by hand"; other uncommanded changes are not attributed.

**Do:**
1. Create `apps/core-api/src/domain/attribution.ts`:
```ts
import type { ChangedBy, CommandBody } from "@eduscope/contracts";

// H13 activity texts ("Rear of room turned on"); the kiosk appends " · from phone" / " · by hand".

export function describeCommand(body: CommandBody): string {
  switch (body.kind) {
    case "source.select":
      return body.input === "podium_pc" ? "Podium PC selected" : "Smart board selected";
    case "projector.power":
      return body.on ? "Projector power on sent" : "Projector power off sent";
    case "projector.mains":
      return body.on ? "Projector mains turned on" : "Projector mains turned off";
    case "screen.move":
      return body.to === "raise" ? "Projection screen raised" : "Projection screen lowered";
    case "audio.level":
      return `${body.channel === "mic" ? "Lecturer microphone" : "PC audio"} set to ${body.level}`;
    case "audio.mute_all":
      return body.muted ? "All audio muted" : "All audio unmuted";
    case "lights.set":
      return `${body.gang === "front" ? "Front" : "Rear"} of room turned ${body.on ? "on" : "off"}`;
    case "ac.power":
      return body.on ? "Air conditioning turned on" : "Air conditioning turned off";
    case "ac.step":
      return body.direction === "up" ? "Air conditioning setpoint raised" : "Air conditioning setpoint lowered";
  }
}

/**
 * Who changed a reported output: the issuer of a matching in-flight command, else "by hand" for a
 * light that changed (R6), else nobody. `undefined` = the value did not change: keep what it had.
 */
export function attributionFor(output: string, changed: boolean, claimedBy: ChangedBy | null): ChangedBy | null | undefined {
  if (claimedBy !== null) return claimedBy;
  if (!changed) return undefined;
  return output.startsWith("lights.") ? "by hand" : null;
}
```
2. Create `apps/core-api/test/domain/attribution.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { attributionFor, describeCommand } from "../../src/domain/attribution.ts";

describe("H13 attribution", () => {
  it.each([
    ["lights.rear", true, "phone", "phone"],
    ["lights.rear", false, "phone", "phone"], // echo of a command that changed nothing still names the issuer
    ["lights.rear", true, null, "by hand"], // R6
    ["display.source", true, null, null],
    ["lights.front", false, null, undefined], // unchanged: keep the old changed_by
  ] as const)("%s changed=%s claimed=%s → %s", (key, changed, claimed, expected) => {
    expect(attributionFor(key, changed, claimed)).toBe(expected);
  });

  it.each([
    [{ kind: "lights.set", gang: "rear", on: true }, "Rear of room turned on"],
    [{ kind: "source.select", input: "smart_board" }, "Smart board selected"],
    [{ kind: "audio.level", channel: "mic", level: 40, final: true }, "Lecturer microphone set to 40"],
    [{ kind: "ac.step", direction: "up" }, "Air conditioning setpoint raised"],
    [{ kind: "projector.power", on: true }, "Projector power on sent"],
  ] as const)("describes %j", (body, text) => {
    expect(describeCommand(body)).toBe(text);
  });
});
```

**Test:** `apps/core-api/test/domain/attribution.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 60 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): H13 attribution texts"` (includes this plan file with the box ticked)

### T11 — Boot model, mesh counts, R11 interlock
- [x] done

**Files:** `apps/core-api/src/domain/zigbee.ts`, `apps/core-api/src/domain/interlock.ts`, `apps/core-api/src/domain/initial.ts`, `apps/core-api/test/helpers.ts`, `apps/core-api/test/domain/zigbee.test.ts`, `apps/core-api/test/domain/interlock.test.ts`, `apps/core-api/test/domain/initial.test.ts`

**Context:** D-15: live state is never persisted — at boot every value is unknown and the hw link is down. S2.E21 mesh (counts derived from the node list, ARCHITECTURE §3.4; D7 = M05-L2: counts are *paired* nodes), S2.E23/R11/Q7 interlock (`[INFERRED]`: holding while cooling down; mains-off refused while draw ≥ 5 W or unknown, D18), S3.E10 blaster card (`coverage` "360°, 12 m" is `[ASSUMED]`, not reported by hw). `test/helpers.ts` grows the shared fixtures every later domain test uses (`bootModel`, `snapshotEvent`, `hwEvent`, the hw fixture readers).

**Do:**
1. Create `apps/core-api/src/domain/zigbee.ts`:
```ts
import type { Coordinator, Mesh, ZigbeeNode } from "@eduscope/contracts";

// S2 side column: mesh counts derived from the node list (hw sends no counts, ARCHITECTURE §3.4).
// Decision (M05-L2): `routers` / `end_devices` count PAIRED nodes, online or not, like `paired`.

export function deriveMesh(nodes: readonly ZigbeeNode[], joiningUntil: string | null, now: Date): Mesh {
  const open = joiningUntil !== null && Date.parse(joiningUntil) > now.getTime();
  return {
    paired: nodes.length,
    routers: nodes.filter((node) => node.role === "router").length,
    end_devices: nodes.filter((node) => node.role === "end_device").length,
    joining: open && joiningUntil !== null ? { state: "open", until: joiningUntil } : { state: "closed" },
  };
}

/** A `zigbee.node` report replaces the node with the same IEEE address, or adds it. */
export function upsertNode(nodes: readonly ZigbeeNode[], node: ZigbeeNode): ZigbeeNode[] {
  const index = nodes.findIndex((existing) => existing.ieee === node.ieee);
  if (index === -1) return [...nodes, node];
  return nodes.map((existing, i) => (i === index ? node : existing));
}

/** Before hw reports a coordinator: the registry's model, everything else blank, status offline. */
export function placeholderCoordinator(model: string | null, port: string | null): Coordinator {
  return { model: model ?? "", chipset: "", firmware: "", channel: 0, tx_power_dbm: 0, port: port ?? "", antenna: "", status: "offline" };
}
```
2. Create `apps/core-api/src/domain/interlock.ts`:
```ts
import type { Interlock, RoomState } from "@eduscope/contracts";
import { STANDBY_BELOW_W } from "./projector.ts";

// R11 shutdown interlock [INFERRED] (Q7): projector mains is not cut while the lamp still draws ≥ 5 W.

export const INTERLOCK_RULE_TEXT = "Projector mains stays on until draw is below 5 W.";

/** S2.E23: bypassed (technician setting) > holding (lamp cooling) > armed. */
export function deriveInterlock(state: RoomState, bypassed: boolean): Interlock {
  const status = bypassed ? "bypassed" : state.display.projector.state.value === "cooling_down" ? "holding" : "armed";
  return { status, rule_text: INTERLOCK_RULE_TEXT };
}

/** Why `projector.mains off` must be refused right now, or null when it may go ahead. */
export function mainsOffBlocked(state: RoomState, bypassed: boolean): string | null {
  if (bypassed) return null;
  const power = state.display.projector.power.value;
  if (power === null) return "Projector draw unknown · mains stays on";
  if (power.watts >= STANDBY_BELOW_W) return `Projector still draws ${Math.round(power.watts)} W · mains stays on until it cools`;
  return null;
}
```
3. Create `apps/core-api/src/domain/initial.ts`:
```ts
import type { RoomState, SensorReading } from "@eduscope/contracts";
import { INTERLOCK_RULE_TEXT } from "./interlock.ts";
import type { DeviceInfo, KwhBaseline, RoomModel } from "./model.ts";
import { unknown } from "./observed.ts";
import { placeholderCoordinator } from "./zigbee.ts";

// The model at boot, before hw-service reports anything (D-15: live state is never persisted).
// The link starts down; the store's first derive fills devices, mesh, status.

/** S3.E10 "Coverage" [ASSUMED]: not reported by hw, not in the registry. */
export const BLASTER_COVERAGE = "360°, 12 m";

/** Which registry device owns each sensor tile (its hw_ref is the reading's node). */
export const SENSOR_DEVICE_IDS = { temperature: "room_climate", humidity: "room_climate", occupancy: "motion", contact: "door" } as const;

export interface InitialModelInput {
  room: { id: string; hostname: string };
  registry: readonly DeviceInfo[];
  /** Captured AC setpoint frames, ascending (R4). */
  acSetpoints: readonly number[];
  interlockBypassed: boolean;
  kwhBaseline: KwhBaseline | null;
  now: string;
}

export function initialModel(input: InitialModelInput): RoomModel {
  const device = (id: string): DeviceInfo | undefined => input.registry.find((info) => info.id === id);
  const node = (slot: keyof typeof SENSOR_DEVICE_IDS): string => device(SENSOR_DEVICE_IDS[slot])?.hw_ref ?? "";
  const reading = <K extends SensorReading["kind"]>(kind: K) => ({ kind, value: null, node: node(kind), at: null, stale: false });
  const blaster = device("ir_blaster");
  const coordinator = device("coordinator");

  const state: RoomState = {
    rev: 0,
    server_time: input.now,
    room: { id: input.room.id, hostname: input.room.hostname, status: { level: "fault", text: "Hardware service offline" } },
    connection: { hw: "down" },
    display: {
      source: unknown("hdmi_switch"),
      projector: {
        state: unknown("power_meter"),
        power: unknown("power_meter"),
        feedback: { last_ir: null, sent_at: null, phase: "idle" },
        mains: unknown("switch"),
      },
      screen: unknown("switch"),
    },
    audio: { channels: { mic: unknown("mixer"), pc: unknown("mixer") }, muted_all: unknown("mixer"), saved_levels: { mic: null, pc: null } },
    environment: {
      lights: { front: unknown("switch"), rear: unknown("switch") },
      ac: { power: unknown("ir"), setpoint_c: unknown("ir"), available_setpoints: [...input.acSetpoints] }, // R3 "Unknown"
      sensors: {
        temperature: reading("temperature"),
        humidity: reading("humidity"),
        occupancy: reading("occupancy"),
        contact: reading("contact"),
        reporting: { count: 0, of: 0 },
      },
    },
    zigbee: {
      coordinator: placeholderCoordinator(coordinator?.model ?? null, coordinator?.hw_ref ?? null),
      mesh: { paired: 0, routers: 0, end_devices: 0, joining: { state: "closed" } },
      nodes: [],
    },
    ir_blaster: {
      id: blaster?.name ?? "ZS06",
      topic: blaster?.hw_ref ?? "",
      lqi: null,
      coverage: BLASTER_COVERAGE,
      power: "mains",
      online: unknown("ir"),
    },
    interlock: { status: "armed", rule_text: INTERLOCK_RULE_TEXT },
    devices: [],
  };
  return {
    state,
    facts: {
      audio_muted: { mic: null, pc: null },
      energy_kwh_total: null,
      kwh_baseline: input.kwhBaseline,
      hw_down_since: input.now,
      joining_until: null,
      interlock_bypassed: input.interlockBypassed,
    },
    registry: input.registry,
  };
}
```
4. Replace the whole file `apps/core-api/test/helpers.ts`:
```ts
import { readdirSync, readFileSync } from "node:fs";
import { DeviceKind, HwEvent, Transport } from "@eduscope/contracts";
import { Config } from "../src/config.ts";
import { initialModel } from "../src/domain/initial.ts";
import type { DeviceInfo, RoomModel, RuleConfig } from "../src/domain/model.ts";
import { SEED_DEVICES } from "../src/db/seed.ts";

/** Screenshot clock (Mon 5 Oct 10:42 UTC); every test that needs "now" starts here. */
export const T0 = "2026-10-05T10:42:00.000Z";

/** A complete, valid config for tests; override any key. */
export function testConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  return Config.parse({
    DB_PATH: ":memory:",
    COOKIE_SECRET: "test-cookie-secret-test-cookie-secret",
    INITIAL_ROOM_PIN: "1234",
    INITIAL_TECH_PIN: "123456",
    ...overrides,
  });
}

export const RULES: RuleConfig = { climateIntervalS: 300, powerIntervalS: 60, hwDownGraceMs: 10_000 };

/** The seeded R-101 registry as domain DeviceInfo. */
export const REGISTRY: DeviceInfo[] = SEED_DEVICES.map((row) => ({
  id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
  brand: row.brand ?? null, model: row.model ?? null, hw_ref: row.hw_ref ?? null,
}));

export function bootModel(overrides: Partial<Parameters<typeof initialModel>[0]> = {}): RoomModel {
  return initialModel({
    room: { id: "R-101", hostname: "r-101.local" },
    registry: REGISTRY,
    acSetpoints: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    interlockBypassed: false,
    kwhBaseline: null,
    now: T0,
    ...overrides,
  });
}

const FIXTURES = new URL("../../../packages/contracts/fixtures/hw/", import.meta.url);

/** A parsed fixtures/hw file. */
export function hwFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8"));
}

/** Every `event.*.json` in fixtures/hw, parsed as HwEvent. */
export function hwEventFixtures(): { name: string; event: HwEvent }[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.startsWith("event.") && name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, event: HwEvent.parse(hwFixture(name)) }));
}

/** The fixture snapshot event (screenshot 01 state), with its time moved to `at`. */
export function snapshotEvent(at: string = T0): HwEvent {
  const event = HwEvent.parse(hwFixture("event.snapshot.json"));
  return { ...event, at };
}

export function hwEvent<T extends HwEvent["type"]>(type: T, data: Extract<HwEvent, { type: T }>["data"], at: string = T0): HwEvent {
  return HwEvent.parse({ type, at, data });
}

/** Unwraps a value a test knows is there (no `!` allowed by lint). */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
```
5. Create `apps/core-api/test/domain/zigbee.test.ts`:
```ts
import { HwSnapshot } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { deriveMesh, placeholderCoordinator, upsertNode } from "../../src/domain/zigbee.ts";
import { hwFixture, must, T0 } from "../helpers.ts";

const nodes = HwSnapshot.parse(hwFixture("response.snapshot.json")).zigbee.nodes; // R-101: 2 routers, 3 end devices

describe("S2 mesh", () => {
  it("counts paired nodes by role, online or not (M05-L2)", () => {
    const offline = nodes.map((node) => (node.friendly_name === "r101_lights" ? { ...node, online: false } : node));
    expect(deriveMesh(offline, null, new Date(T0))).toEqual({ paired: 5, routers: 2, end_devices: 3, joining: { state: "closed" } });
  });
  it("joining is open until the deadline, closed after", () => {
    const until = "2026-10-05T10:46:00.000Z";
    expect(deriveMesh(nodes, until, new Date(T0)).joining).toEqual({ state: "open", until });
    expect(deriveMesh(nodes, until, new Date(until)).joining).toEqual({ state: "closed" });
  });
  it("upsertNode replaces by IEEE address or appends", () => {
    const first = must(nodes[0]);
    expect(upsertNode(nodes, { ...first, lqi: 99 })[0]?.lqi).toBe(99);
    expect(upsertNode(nodes, { ...first, ieee: "0xnew" })).toHaveLength(6);
  });
  it("before hw reports, the coordinator is the registry model, offline", () => {
    expect(placeholderCoordinator("ZG-808Z", "zigbee-coord")).toMatchObject({ model: "ZG-808Z", port: "zigbee-coord", status: "offline" });
  });
});
```
6. Create `apps/core-api/test/domain/interlock.test.ts`:
```ts
import type { ProjectorState, RoomState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { deriveInterlock, mainsOffBlocked } from "../../src/domain/interlock.ts";
import { bootModel, T0 } from "../helpers.ts";

/** The boot state with a meter reading and a projector state written in. */
function withDraw(watts: number, value: ProjectorState): RoomState {
  const { state } = bootModel();
  const { projector } = state.display;
  const reading = { watts, volts: 231, kwh_today: 0, rating_a: 13, at: T0 };
  return {
    ...state,
    display: {
      ...state.display,
      projector: {
        ...projector,
        power: { ...projector.power, value: reading, confidence: "confirmed", updated_at: T0 },
        state: { ...projector.state, value, confidence: "confirmed", updated_at: T0 },
      },
    },
  };
}

describe("R11 interlock", () => {
  it.each([
    [287, false, "Projector still draws 287 W · mains stays on until it cools"],
    [5, false, "Projector still draws 5 W · mains stays on until it cools"],
    [4, false, null],
    [287, true, null], // bypassed
  ])("mains off at %d W (bypassed %s) → %s", (watts, bypassed, expected) => {
    expect(mainsOffBlocked(withDraw(watts, "running"), bypassed)).toBe(expected);
  });
  it("draw unknown blocks mains off", () => {
    expect(mainsOffBlocked(bootModel().state, false)).toBe("Projector draw unknown · mains stays on");
  });
  it("holding while cooling down, bypassed wins, armed otherwise", () => {
    expect(deriveInterlock(withDraw(45, "cooling_down"), false).status).toBe("holding");
    expect(deriveInterlock(withDraw(45, "cooling_down"), true).status).toBe("bypassed");
    expect(deriveInterlock(withDraw(287, "running"), false)).toEqual({ status: "armed", rule_text: "Projector mains stays on until draw is below 5 W." });
  });
});
```
7. Create `apps/core-api/test/domain/initial.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BLASTER_COVERAGE } from "../../src/domain/initial.ts";
import { bootModel, T0 } from "../helpers.ts";

describe("boot model (D-15: nothing live is persisted)", () => {
  it("starts with the hw link down since boot, rev 0, every value unknown", () => {
    const { state, facts } = bootModel();
    expect(state.rev).toBe(0);
    expect(state.connection.hw).toBe("down");
    expect(facts.hw_down_since).toBe(T0);
    expect(state.display.source).toEqual({ value: null, confidence: "unknown", source: "hdmi_switch", updated_at: null, stale: false, changed_by: null });
    expect(state.environment.lights.front.value).toBeNull();
  });
  it("R3: the AC is Unknown after start; R4: only captured setpoints are offered", () => {
    const { state } = bootModel({ acSetpoints: [18, 24] });
    expect(state.environment.ac.power.confidence).toBe("unknown");
    expect(state.environment.ac.available_setpoints).toEqual([18, 24]);
  });
  it("sensor tiles point at the registry nodes; the blaster and coordinator come from the registry", () => {
    const { state } = bootModel();
    expect(state.environment.sensors.temperature).toEqual({ kind: "temperature", value: null, node: "r101_temp", at: null, stale: false });
    expect(state.environment.sensors.contact.node).toBe("r101_door");
    expect(state.ir_blaster).toMatchObject({ id: "ZS06", topic: "r101_ir", coverage: BLASTER_COVERAGE, power: "mains" });
    expect(state.zigbee.coordinator).toMatchObject({ model: "ZG-808Z", port: "zigbee-coord", status: "offline" });
    expect(state.interlock.status).toBe("armed");
  });
});
```

**Test:** The three test files above.

**Verify:** `pnpm --filter @eduscope/core-api test` → 73 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): boot model, mesh counts, R11 interlock"` (includes this plan file with the box ticked)

### T12 — hw events → model (lights R6, audio R9, sensors, snapshot)
- [x] done

**Files:** `apps/core-api/src/domain/lights.ts`, `apps/core-api/src/domain/audio.ts`, `apps/core-api/src/domain/sensors.ts`, `apps/core-api/src/domain/hw-events.ts`, `apps/core-api/test/domain/hw-events.test.ts`, `apps/core-api/test/domain/audio.test.ts`, `apps/core-api/test/domain/sensors.test.ts`

**Context:** ARCHITECTURE §3.4 (every `HwEvent` type; hw reports raw facts only), §6.4 (rules are pure functions; no rule logic in ingest). R6 (switch always confirmed), R9 (mute all = both channels muted; leaving "all muted" clears the saved levels), R13 (periodic sensors stale after 2× interval; event sensors when the node's last seen > 60 min; a reading counts as the node being seen), H11 (never reported ≠ stale). `OutputKey` is the LWW/correlation key used by the dispatcher (T18–T20). `applyHwDown` is §6.7.

**Do:**
1. Create `apps/core-api/src/domain/lights.ts`:
```ts
import type { LightGang, RoomState } from "@eduscope/contracts";
import { reported } from "./observed.ts";

// R6: the switch always reports the truth; a change nobody commanded is "by hand" (attribution.ts).

export function applyLightsReport(state: RoomState, gang: LightGang, on: boolean | null, at: string): RoomState {
  const { lights } = state.environment;
  return { ...state, environment: { ...state.environment, lights: { ...lights, [gang]: reported(lights[gang], on, at) } } };
}
```
2. Create `apps/core-api/src/domain/audio.ts`:
```ts
import type { AudioChannel, AudioState } from "@eduscope/contracts";
import type { HwFacts, RoomModel } from "./model.ts";
import { reported } from "./observed.ts";

// R9: mute all saves each channel's level; unmute restores them; levels are read back.

/** `muted_all` is true only when the mixer reports both channels muted. */
export function mutedAll(muted: HwFacts["audio_muted"]): boolean | null {
  if (muted.mic === null || muted.pc === null) return null;
  return muted.mic && muted.pc;
}

/** One `audio.state` report. Leaving "all muted" clears the saved levels (unmute restores them). */
export function applyAudioReport(model: RoomModel, data: { channel: AudioChannel; level: number; muted: boolean }, at: string): RoomModel {
  const { audio } = model.state;
  const audioMuted = { ...model.facts.audio_muted, [data.channel]: data.muted };
  const all = mutedAll(audioMuted);
  const nextAudio: AudioState = {
    channels: { ...audio.channels, [data.channel]: reported(audio.channels[data.channel], data.level, at) },
    muted_all: all === null ? audio.muted_all : reported(audio.muted_all, all, at),
    saved_levels: audio.muted_all.value === true && all === false ? { mic: null, pc: null } : audio.saved_levels,
  };
  return { ...model, state: { ...model.state, audio: nextAudio }, facts: { ...model.facts, audio_muted: audioMuted } };
}

/** Before "Mute all" is sent: remember the current levels (R9). Already muted ⇒ keep the saved ones. */
export function saveLevels(audio: AudioState): AudioState {
  if (audio.muted_all.value === true) return audio;
  return { ...audio, saved_levels: { mic: audio.channels.mic.value, pc: audio.channels.pc.value } };
}
```
3. Create `apps/core-api/src/domain/sensors.ts`:
```ts
import type { HwSensorReadingData, RoomState, SensorReading, ZigbeeNode } from "@eduscope/contracts";
import type { RuleConfig } from "./model.ts";
import { withStale } from "./observed.ts";

// R13 staleness and S1.E41 "n reporting". Periodic sensors: stale after 2× their report interval;
// event sensors (occupancy, door): stale when their node was last seen more than 60 min ago.

export const EVENT_SENSOR_STALE_MS = 60 * 60_000;

type Sensors = RoomState["environment"]["sensors"];
type SensorSlot = "temperature" | "humidity" | "occupancy" | "contact";

/** One `sensors.reading`: the tile for that kind takes value, node and time; the node counts as seen. */
export function applySensorReading(state: RoomState, data: HwSensorReadingData, at: string): RoomState {
  const reading: SensorReading = { ...data, at, stale: false };
  const sensors: Sensors = { ...state.environment.sensors, [data.kind]: reading };
  const seen = (node: ZigbeeNode): boolean => node.last_seen === null || Date.parse(node.last_seen) < Date.parse(at);
  const nodes = state.zigbee.nodes.map((node) => (node.friendly_name === data.node && seen(node) ? { ...node, last_seen: at } : node));
  return { ...state, environment: { ...state.environment, sensors }, zigbee: { ...state.zigbee, nodes } };
}

function lastSeen(reading: SensorReading, nodes: readonly ZigbeeNode[]): string | null {
  return nodes.find((node) => node.friendly_name === reading.node)?.last_seen ?? reading.at;
}

function isStale(reading: SensorReading, nodes: readonly ZigbeeNode[], now: Date, cfg: RuleConfig): boolean {
  const periodic = reading.kind === "temperature" || reading.kind === "humidity";
  const since = periodic ? reading.at : lastSeen(reading, nodes);
  if (since === null) return false; // never reported is H11 "No reading yet", not stale
  const limit = periodic ? 2 * cfg.climateIntervalS * 1000 : EVENT_SENSOR_STALE_MS;
  return now.getTime() - Date.parse(since) > limit;
}

/** Re-evaluates every staleness flag (sensor tiles + power meter). */
export function applyStaleness(state: RoomState, now: Date, cfg: RuleConfig): RoomState {
  const { sensors } = state.environment;
  const slots: SensorSlot[] = ["temperature", "humidity", "occupancy", "contact"];
  let nextSensors: Sensors = sensors;
  for (const slot of slots) {
    const reading = sensors[slot];
    const stale = isStale(reading, state.zigbee.nodes, now, cfg);
    if (reading.stale !== stale) nextSensors = { ...nextSensors, [slot]: { ...reading, stale } };
  }
  const { projector } = state.display;
  const powerAt = projector.power.updated_at;
  const powerStale = powerAt !== null && now.getTime() - Date.parse(powerAt) > 2 * cfg.powerIntervalS * 1000;
  return {
    ...state,
    environment: { ...state.environment, sensors: nextSensors },
    display: {
      ...state.display,
      projector: { ...projector, power: withStale(projector.power, powerStale), state: withStale(projector.state, powerStale) },
    },
  };
}

/** S1.E41: sensor devices online with a fresh, non-null reading on every tile they own. */
export function deriveReporting(state: RoomState): { count: number; of: number } {
  const { temperature, humidity, occupancy, contact } = state.environment.sensors;
  const readings = [temperature, humidity, occupancy, contact];
  const sensorDevices = state.devices.filter((device) => device.kind === "sensor");
  const count = sensorDevices.filter((device) => {
    if (device.online.value !== true) return false;
    const own = readings.filter((reading) => reading.node === device.hw_ref);
    return own.length > 0 && own.every((reading) => !reading.stale && reading.value !== null);
  }).length;
  return { count, of: sensorDevices.length };
}
```
4. Create `apps/core-api/src/domain/hw-events.ts`:
```ts
import type { ChangedBy, HwEvent, HwSnapshot, Observed, RoomState, ScreenPosition } from "@eduscope/contracts";
import { applyAudioReport } from "./audio.ts";
import { applyLightsReport } from "./lights.ts";
import type { RoomModel } from "./model.ts";
import { reported, sameValue, withChangedBy } from "./observed.ts";
import { applyPowerReading } from "./projector.ts";
import { applySensorReading } from "./sensors.ts";
import { upsertNode } from "./zigbee.ts";

// HwEvent → RoomModel (ARCHITECTURE §3.4, §6.4). Pure; the store derives the rest afterwards.

/** A controllable output as commands and reports name it (LWW and correlation key, §6.5). */
export type OutputKey =
  | "display.source" | "projector.ir" | "projector.mains" | "screen" | "audio.mic" | "audio.pc" | "audio.mute"
  | "lights.front" | "lights.rear" | "ac";

const REPORTED_BY_SNAPSHOT: readonly OutputKey[] = [
  "display.source", "projector.mains", "screen", "audio.mic", "audio.pc", "audio.mute", "lights.front", "lights.rear",
];

/** Outputs whose value an event reports (an echo of a command, or a change by hand). */
export function reportedKeys(event: HwEvent): readonly OutputKey[] {
  switch (event.type) {
    case "snapshot":
      return REPORTED_BY_SNAPSHOT;
    case "lights.state":
      return [event.data.gang === "front" ? "lights.front" : "lights.rear"];
    case "projector_power.relay":
      return ["projector.mains"];
    case "hdmi.state":
      return ["display.source"];
    case "projection_screen.state":
      return ["screen"];
    case "audio.state":
      return [event.data.channel === "mic" ? "audio.mic" : "audio.pc", "audio.mute"];
    default:
      return [];
  }
}

function observedAt(state: RoomState, key: OutputKey): Observed<unknown> | null {
  switch (key) {
    case "display.source":
      return state.display.source;
    case "projector.mains":
      return state.display.projector.mains;
    case "screen":
      return state.display.screen;
    case "audio.mic":
      return state.audio.channels.mic;
    case "audio.pc":
      return state.audio.channels.pc;
    case "audio.mute":
      return state.audio.muted_all;
    case "lights.front":
      return state.environment.lights.front;
    case "lights.rear":
      return state.environment.lights.rear;
    case "projector.ir":
    case "ac":
      return null; // IR outputs have no read-back (R2, R3)
  }
}

/** Did a report change this output's value? */
export function valueChanged(before: RoomState, after: RoomState, key: OutputKey): boolean {
  return !sameValue(observedAt(before, key)?.value, observedAt(after, key)?.value);
}

/** Sets `changed_by` on one reported output (H13). */
export function setChangedBy(state: RoomState, key: OutputKey, by: ChangedBy | null): RoomState {
  const { display, audio, environment } = state;
  switch (key) {
    case "display.source":
      return { ...state, display: { ...display, source: withChangedBy(display.source, by) } };
    case "projector.mains":
      return { ...state, display: { ...display, projector: { ...display.projector, mains: withChangedBy(display.projector.mains, by) } } };
    case "screen":
      return { ...state, display: { ...display, screen: withChangedBy(display.screen, by) } };
    case "audio.mic":
    case "audio.pc": {
      const channel = key === "audio.mic" ? "mic" : "pc";
      return { ...state, audio: { ...audio, channels: { ...audio.channels, [channel]: withChangedBy(audio.channels[channel], by) } } };
    }
    case "audio.mute":
      return { ...state, audio: { ...audio, muted_all: withChangedBy(audio.muted_all, by) } };
    case "lights.front":
    case "lights.rear": {
      const gang = key === "lights.front" ? "front" : "rear";
      const lights = { ...environment.lights, [gang]: withChangedBy(environment.lights[gang], by) };
      return { ...state, environment: { ...environment, lights } };
    }
    case "projector.ir":
    case "ac":
      return state;
  }
}

function applyScreen(state: RoomState, position: ScreenPosition, at: string): RoomState {
  const screen = reported(state.display.screen, position, at, position === "unknown" ? "unknown" : "confirmed");
  return { ...state, display: { ...state.display, screen } };
}

function applyBlaster(state: RoomState, data: { online: boolean; lqi: number | null }, at: string): RoomState {
  return { ...state, ir_blaster: { ...state.ir_blaster, lqi: data.lqi, online: reported(state.ir_blaster.online, data.online, at) } };
}

function withState(model: RoomModel, state: RoomState): RoomModel {
  return { ...model, state };
}

/** The first SSE event (and every reconnect): full truth from hw, link up (§6.7 recovery). */
export function applySnapshot(model: RoomModel, snap: HwSnapshot, at: string): RoomModel {
  let state: RoomState = { ...model.state, connection: { hw: "up" } };
  state = applyLightsReport(state, "front", snap.lights.front, at);
  state = applyLightsReport(state, "rear", snap.lights.rear, at);
  const { projector } = state.display;
  state = { ...state, display: { ...state.display, projector: { ...projector, mains: reported(projector.mains, snap.projector_power.relay, at) } } };
  state = { ...state, display: { ...state.display, source: reported(state.display.source, snap.hdmi.input, at) } };
  state = applyScreen(state, snap.projection_screen.position, at);
  state = {
    ...state,
    zigbee: {
      ...state.zigbee,
      nodes: snap.zigbee.nodes,
      coordinator: snap.zigbee.coordinator ?? { ...state.zigbee.coordinator, status: "offline" },
    },
  };
  if (snap.ir.blaster !== null) state = applyBlaster(state, snap.ir.blaster, at);
  for (const sample of snap.sensors) state = applySensorReading(state, sample.reading, sample.at);

  let next: RoomModel = { ...model, state, facts: { ...model.facts, hw_down_since: null, joining_until: snap.zigbee.joining_until } };
  const reading = snap.projector_power.reading;
  if (reading !== null) next = applyPowerReading(next, reading, reading.at);
  for (const channel of ["mic", "pc"] as const) {
    const level = snap.audio[channel];
    if (level !== null) next = applyAudioReport(next, { channel, ...level }, at);
  }
  return next;
}

/** One HwEvent applied to the model. Events with no state (heartbeat, errors, IR learn) change nothing. */
export function applyHwEvent(model: RoomModel, event: HwEvent): RoomModel {
  const { state } = model;
  const at = event.at;
  switch (event.type) {
    case "snapshot":
      return applySnapshot(model, event.data, at);
    case "lights.state":
      return withState(model, applyLightsReport(state, event.data.gang, event.data.on, at));
    case "projector_power.relay": {
      const { projector } = state.display;
      return withState(model, { ...state, display: { ...state.display, projector: { ...projector, mains: reported(projector.mains, event.data.on, at) } } });
    }
    case "projector_power.reading":
      return applyPowerReading(model, event.data, at);
    case "hdmi.state":
      return withState(model, { ...state, display: { ...state.display, source: reported(state.display.source, event.data.input, at) } });
    case "projection_screen.state":
      return withState(model, applyScreen(state, event.data.position, at));
    case "audio.state":
      return applyAudioReport(model, event.data, at);
    case "sensors.reading":
      return withState(model, applySensorReading(state, event.data, at));
    case "zigbee.node":
      return withState(model, { ...state, zigbee: { ...state.zigbee, nodes: upsertNode(state.zigbee.nodes, event.data) } });
    case "zigbee.coordinator":
      return withState(model, { ...state, zigbee: { ...state.zigbee, coordinator: event.data } });
    case "zigbee.mesh":
      return { ...model, facts: { ...model.facts, joining_until: event.data.joining_until } };
    case "ir.blaster":
      return withState(model, applyBlaster(state, event.data, at));
    case "ir.learn":
    case "hw.error":
    case "heartbeat":
      return model;
  }
}

/** The SSE stream dropped (§6.7): link down now; devices go offline after the grace (derive.ts). */
export function applyHwDown(model: RoomModel, at: string): RoomModel {
  if (model.state.connection.hw === "down" && model.facts.hw_down_since !== null) return model;
  return { ...model, state: { ...model.state, connection: { hw: "down" } }, facts: { ...model.facts, hw_down_since: at } };
}
```
5. Create `apps/core-api/test/domain/hw-events.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyHwDown, applyHwEvent, reportedKeys, setChangedBy, valueChanged } from "../../src/domain/hw-events.ts";
import { bootModel, hwEvent, hwEventFixtures, snapshotEvent, T0 } from "../helpers.ts";

describe("HwEvent → model", () => {
  it("the snapshot brings the link up with screenshot 01's values, all confirmed", () => {
    const { state, facts } = applyHwEvent(bootModel(), snapshotEvent());
    expect(state.connection.hw).toBe("up");
    expect(facts.hw_down_since).toBeNull();
    expect(state.display.source).toMatchObject({ value: "podium_pc", confidence: "confirmed", source: "hdmi_switch" });
    expect(state.display.projector.mains.value).toBe(true);
    expect(state.display.screen.value).toBe("lowered");
    expect(state.audio.channels.mic.value).toBe(62);
    expect(state.audio.muted_all.value).toBe(false);
    expect(state.environment.lights.front.value).toBe(true);
    expect(state.environment.sensors.temperature).toMatchObject({ value: 26.4, node: "r101_temp", at: "2026-10-05T10:41:48Z" });
    expect(state.zigbee.nodes).toHaveLength(5);
    expect(state.ir_blaster.lqi).toBe(196);
    expect(state.environment.ac.power.value).toBeNull(); // R3: hw never reports the AC
  });

  it("every fixture event applies without throwing; state-less events change nothing", () => {
    const up = applyHwEvent(bootModel(), snapshotEvent());
    for (const { event } of hwEventFixtures()) {
      const next = applyHwEvent(up, event);
      if (event.type === "heartbeat" || event.type === "hw.error" || event.type === "ir.learn") expect(next).toBe(up);
    }
  });

  it("unknown screen position is value unknown, confidence unknown", () => {
    const next = applyHwEvent(bootModel(), hwEvent("projection_screen.state", { position: "unknown" }));
    expect(next.state.display.screen).toMatchObject({ value: "unknown", confidence: "unknown" });
  });

  it("zigbee.mesh only moves the joining deadline", () => {
    expect(applyHwEvent(bootModel(), hwEvent("zigbee.mesh", { joining_until: "2026-10-05T10:46:00Z" })).facts.joining_until).toBe("2026-10-05T10:46:00Z");
  });

  it("reportedKeys names the outputs an event proves", () => {
    expect(reportedKeys(hwEvent("lights.state", { gang: "rear", on: true }))).toEqual(["lights.rear"]);
    expect(reportedKeys(hwEvent("audio.state", { channel: "pc", level: 40, muted: false }))).toEqual(["audio.pc", "audio.mute"]);
    expect(reportedKeys(hwEvent("sensors.reading", { node: "r101_temp", kind: "temperature", value: 20 }))).toEqual([]);
  });

  it("valueChanged / setChangedBy work on the reported output", () => {
    const up = applyHwEvent(bootModel(), snapshotEvent());
    const next = applyHwEvent(up, hwEvent("lights.state", { gang: "rear", on: true }));
    expect(valueChanged(up.state, next.state, "lights.rear")).toBe(true);
    expect(valueChanged(up.state, next.state, "lights.front")).toBe(false);
    expect(setChangedBy(next.state, "lights.rear", "phone").environment.lights.rear.changed_by).toBe("phone");
  });

  it("applyHwDown marks the link down once", () => {
    const up = applyHwEvent(bootModel(), snapshotEvent());
    const down = applyHwDown(up, T0);
    expect(down.state.connection.hw).toBe("down");
    expect(applyHwDown(down, "2026-10-05T11:00:00Z").facts.hw_down_since).toBe(T0);
  });
});

describe("power readings (R1 + kWh today)", () => {
  it("a reading sets power, kWh today from the first reading of the day and the R1 state", () => {
    let model = applyHwEvent(bootModel(), snapshotEvent()); // 287 W, 412.67 kWh
    expect(model.state.display.projector.state.value).toBe("running");
    expect(model.state.display.projector.power.value?.kwh_today).toBe(0);
    model = applyHwEvent(model, hwEvent("projector_power.reading", { watts: 45, volts: 230, energy_kwh_total: 413.92 }, "2026-10-05T11:00:00Z"));
    const { power, state } = model.state.display.projector;
    expect(power.value).toEqual({ watts: 45, volts: 230, kwh_today: 1.25, rating_a: 13, at: "2026-10-05T11:00:00Z" });
    expect(power.confidence).toBe("confirmed");
    expect(state.value).toBe("cooling_down");
    expect(model.facts.kwh_baseline).toEqual({ date: "2026-10-05", kwh_total: 412.67 });
  });
});
```
6. Create `apps/core-api/test/domain/audio.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyAudioReport, mutedAll, saveLevels } from "../../src/domain/audio.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { bootModel, snapshotEvent, T0 } from "../helpers.ts";

describe("R9 audio", () => {
  it.each([
    [{ mic: true, pc: true }, true],
    [{ mic: true, pc: false }, false],
    [{ mic: null, pc: true }, null],
  ])("muted_all of %j is %s", (muted, expected) => {
    expect(mutedAll(muted)).toBe(expected);
  });

  it("mute saves the levels; both channels muted ⇒ muted_all; unmute clears the saved levels", () => {
    let model = applyHwEvent(bootModel(), snapshotEvent()); // mic 62, pc 38, unmuted
    model = { ...model, state: { ...model.state, audio: saveLevels(model.state.audio) } };
    expect(model.state.audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    model = applyAudioReport(model, { channel: "mic", level: 62, muted: true }, T0);
    expect(model.state.audio.muted_all.value).toBe(false);
    model = applyAudioReport(model, { channel: "pc", level: 38, muted: true }, T0);
    expect(model.state.audio.muted_all.value).toBe(true);
    expect(saveLevels(model.state.audio).saved_levels).toEqual({ mic: 62, pc: 38 }); // muting twice keeps them
    model = applyAudioReport(model, { channel: "mic", level: 62, muted: false }, T0);
    expect(model.state.audio.muted_all.value).toBe(false);
    expect(model.state.audio.saved_levels).toEqual({ mic: null, pc: null });
  });
});
```
7. Create `apps/core-api/test/domain/sensors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { applyStaleness } from "../../src/domain/sensors.ts";
import { bootModel, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const MIN = 60_000;
const after = (ms: number): Date => new Date(Date.parse(T0) + ms);

/** Snapshot at T0, then every sensor reports at T0 (node last seen T0). */
function freshState() {
  let model = applyHwEvent(bootModel(), snapshotEvent());
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_temp", kind: "temperature", value: 26.4 }));
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_temp", kind: "humidity", value: 61 }));
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_motion", kind: "occupancy", value: "detected" }));
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_door", kind: "contact", value: "closed" }));
  return model;
}

describe("R13 staleness", () => {
  it.each([
    ["temperature", 10 * MIN, false], // 2 × 5 min climate interval
    ["temperature", 10 * MIN + 1, true],
    ["humidity", 11 * MIN, true],
    ["occupancy", 60 * MIN, false], // event sensors: node last seen > 60 min
    ["occupancy", 60 * MIN + 1, true],
    ["contact", 61 * MIN, true],
  ] as const)("%s after %d ms → stale %s", (kind, ms, stale) => {
    expect(applyStaleness(freshState().state, after(ms), RULES).environment.sensors[kind].stale).toBe(stale);
  });

  it("a node seen recently keeps its event sensor fresh even if the reading is old", () => {
    const model = freshState();
    const seen = applyHwEvent(model, hwEvent("zigbee.node", { ...must(model.state.zigbee.nodes[4]), last_seen: after(59 * MIN).toISOString() }));
    expect(applyStaleness(seen.state, after(90 * MIN), RULES).environment.sensors.contact.stale).toBe(false);
  });

  it("never reported (H11) is not stale; power is stale after 2 × 60 s", () => {
    const boot = bootModel().state;
    expect(applyStaleness(boot, after(999 * MIN), RULES).environment.sensors.temperature.stale).toBe(false);
    const state = freshState().state;
    const powerAt = Date.parse(state.display.projector.power.updated_at ?? T0);
    expect(applyStaleness(state, new Date(powerAt + 120_000), RULES).display.projector.power.stale).toBe(false);
    expect(applyStaleness(state, new Date(powerAt + 120_001), RULES).display.projector.power.stale).toBe(true);
  });

});
```

**Test:** The three test files above (every `fixtures/hw/event.*.json` applies; snapshot = screenshot 01; R1 + kWh from readings; R9 sequence; R13 table).

**Verify:** `pnpm --filter @eduscope/core-api test` → 93 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): apply hw events to the model"` (includes this plan file with the box ticked)

### T13 — Derived fields: device online (H8/H9), staleness, mesh, status (S1.E4)
- [x] done

**Files:** `apps/core-api/src/domain/devices.ts`, `apps/core-api/src/domain/status.ts`, `apps/core-api/src/domain/derive.ts`, `apps/core-api/test/domain/devices.test.ts`, `apps/core-api/test/domain/status.test.ts`

**Context:** §6.4: after every change the store recomputes status, `sensors.reporting`, mesh counts, interlock. Device online `[ASSUMED until intake]`: zigbee devices = their node; `ir_zs06` devices = the ZS06; the blaster and coordinator = their own reports; local devices = the hw link. §6.7: hw down ⇒ status fault "Hardware service offline" at once, and after `HW_DOWN_GRACE_MS` (10 s) every device offline with last values kept but stale (H8 greyed) (D6). S1.E4 priority: hw down > coordinator offline (H9) > devices offline (H8, R7: one router = degraded) > sensors not reporting (S1.E41) > battery ≤ 20 % (H16) > "All systems normal" (D15).

**Do:**
1. Create `apps/core-api/src/domain/devices.ts`:
```ts
import type { Device, Observed, RoomState, Source } from "@eduscope/contracts";
import type { DeviceInfo } from "./model.ts";
import { OUTPUTS } from "./model.ts";

// H8/H9: each device's `online` from the facts that prove it [ASSUMED until intake].
//   zigbee devices → their node; ir_* devices → the ZS06 (ir_mcu → the hw link); the blaster and
//   the coordinator → their own reports; local devices → the hw link. hw down past the grace ⇒ all offline.

function sourceFor(info: DeviceInfo): Source {
  switch (info.kind) {
    case "lights":
    case "projection_screen":
      return "switch";
    case "power_socket":
      return "power_meter";
    case "sensor":
      return "sensor";
    case "hdmi_switch":
      return "hdmi_switch";
    case "audio":
      return "mixer";
    case "projector":
    case "ac":
    case "ir_blaster":
      return "ir";
    case "coordinator":
    case "other":
      return "none";
  }
}

function factOnline(info: DeviceInfo, state: RoomState): boolean | null {
  if (info.kind === "ir_blaster") return state.ir_blaster.online.value;
  if (info.kind === "coordinator") {
    const status = state.zigbee.coordinator.status;
    return status === "starting" ? null : status === "online";
  }
  if (info.transport === "ir_zs06") return state.ir_blaster.online.value;
  if (info.transport === "zigbee") {
    return state.zigbee.nodes.find((node) => node.friendly_name === info.hw_ref)?.online ?? null;
  }
  return true; // local and ir_mcu: reachable while hw-service is
}

function onlineValue(prev: Observed<boolean> | undefined, info: DeviceInfo, value: boolean | null, stale: boolean, now: string): Observed<boolean> {
  const confidence = value === null ? "unknown" : info.kind === "ac" ? "assumed" : "confirmed";
  if (prev !== undefined && prev.value === value && prev.confidence === confidence && prev.stale === stale) return prev;
  const changed = prev === undefined || prev.value !== value;
  return {
    value,
    confidence,
    source: sourceFor(info),
    updated_at: changed ? (value === null ? null : now) : (prev?.updated_at ?? null),
    stale,
    changed_by: null,
  };
}

/**
 * The `devices` array. `hwDown`: link down (keep last values); `hwOffline`: down past the grace
 * (every device offline, last values greyed, §6.7).
 */
export function deriveDevices(
  infos: readonly DeviceInfo[],
  state: RoomState,
  link: { hwDown: boolean; hwOffline: boolean },
  now: string,
): Device[] {
  return infos.map((info) => {
    const prev = state.devices.find((device) => device.id === info.id)?.online;
    const value = link.hwOffline ? false : link.hwDown ? (prev?.value ?? null) : factOnline(info, state);
    return { ...info, online: onlineValue(prev, info, value, link.hwOffline, now), outputs: [...(OUTPUTS[info.id] ?? [])] };
  });
}
```
2. Create `apps/core-api/src/domain/status.ts`:
```ts
import type { RoomState, RoomStatus } from "@eduscope/contracts";

// S1.E4 room status: fault > degraded > normal. Inputs are already-derived fields of the state.

/** H16: a battery at or below this is low. */
export const LOW_BATTERY_PCT = 20;

export function deriveStatus(state: RoomState): RoomStatus {
  if (state.connection.hw === "down") return { level: "fault", text: "Hardware service offline" };
  if (state.zigbee.coordinator.status === "offline") return { level: "fault", text: "Coordinator offline" }; // H9
  const offline = state.devices.filter((device) => device.online.value === false);
  const first = offline[0];
  if (first !== undefined) {
    // H8; one router offline (R7) lands here too: degraded, never fault.
    return { level: "degraded", text: offline.length === 1 ? `${first.name} offline` : `${offline.length} devices offline` };
  }
  const { count, of } = state.environment.sensors.reporting;
  if (count < of) return { level: "degraded", text: count === 0 ? "No sensors reporting" : "Sensor not reporting" };
  const lowBattery = state.zigbee.nodes.some((node) => node.battery_pct !== null && node.battery_pct <= LOW_BATTERY_PCT);
  if (lowBattery) return { level: "degraded", text: "Sensor battery low" }; // H16
  return { level: "normal", text: "All systems normal" };
}
```
3. Create `apps/core-api/src/domain/derive.ts`:
```ts
import type { RoomState } from "@eduscope/contracts";
import { deriveDevices } from "./devices.ts";
import { deriveInterlock } from "./interlock.ts";
import type { RoomModel, RuleConfig } from "./model.ts";
import { reported, withStale } from "./observed.ts";
import { nextPhase } from "./projector.ts";
import { applyStaleness, deriveReporting } from "./sensors.ts";
import { deriveStatus } from "./status.ts";
import { deriveMesh } from "./zigbee.ts";

// Every derived field, recomputed after each change and on the periodic tick (ARCHITECTURE §6.4).

/** H8 after the hw grace: every reported value keeps its last value but is greyed (stale). */
function markAllStale(state: RoomState): RoomState {
  const { display, audio, environment } = state;
  const sensors = environment.sensors;
  return {
    ...state,
    display: {
      ...display,
      source: withStale(display.source, true),
      screen: withStale(display.screen, true),
      projector: {
        ...display.projector,
        state: withStale(display.projector.state, true),
        power: withStale(display.projector.power, true),
        mains: withStale(display.projector.mains, true),
      },
    },
    audio: {
      ...audio,
      channels: { mic: withStale(audio.channels.mic, true), pc: withStale(audio.channels.pc, true) },
      muted_all: withStale(audio.muted_all, true),
    },
    environment: {
      ...environment,
      lights: { front: withStale(environment.lights.front, true), rear: withStale(environment.lights.rear, true) },
      sensors: {
        ...sensors,
        temperature: { ...sensors.temperature, stale: true },
        humidity: { ...sensors.humidity, stale: true },
        occupancy: { ...sensors.occupancy, stale: true },
        contact: { ...sensors.contact, stale: true },
      },
    },
  };
}

export function derive(model: RoomModel, now: Date, cfg: RuleConfig): RoomModel {
  const nowIso = now.toISOString();
  const { facts } = model;
  const hwDown = model.state.connection.hw === "down";
  const hwOffline = hwDown && facts.hw_down_since !== null && now.getTime() - Date.parse(facts.hw_down_since) >= cfg.hwDownGraceMs;

  let state = applyStaleness(model.state, now, cfg);
  if (hwOffline) {
    state = markAllStale(state);
    const blaster = state.ir_blaster.online.value === false ? state.ir_blaster.online : reported(state.ir_blaster.online, false, nowIso);
    state = {
      ...state,
      ir_blaster: { ...state.ir_blaster, online: withStale(blaster, true) },
      zigbee: { ...state.zigbee, coordinator: { ...state.zigbee.coordinator, status: "offline" } },
    };
  }
  const { projector } = state.display;
  state = { ...state, display: { ...state.display, projector: { ...projector, feedback: nextPhase(projector.feedback, projector.state.value, now) } } };
  state = { ...state, devices: deriveDevices(model.registry, state, { hwDown, hwOffline }, nowIso) };
  state = { ...state, zigbee: { ...state.zigbee, mesh: deriveMesh(state.zigbee.nodes, facts.joining_until, now) } };
  state = { ...state, environment: { ...state.environment, sensors: { ...state.environment.sensors, reporting: deriveReporting(state) } } };
  state = { ...state, interlock: deriveInterlock(state, facts.interlock_bypassed) };
  state = { ...state, room: { ...state.room, status: deriveStatus(state) } };
  return { ...model, state };
}
```
4. Create `apps/core-api/test/domain/devices.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import { bootModel, hwEvent, RULES, snapshotEvent, T0 } from "../helpers.ts";

const at = (ms: number) => new Date(Date.parse(T0) + ms);
const online = (model: ReturnType<typeof bootModel>, id: string) => model.state.devices.find((d) => d.id === id)?.online;

describe("H8 device online", () => {
  it("before hw reports anything: unknown; after the snapshot every device is online", () => {
    const boot = derive(bootModel(), new Date(T0), RULES);
    expect(online(boot, "lights")?.value).toBeNull();
    const up = derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES);
    expect(up.state.devices.every((d) => d.online.value === true)).toBe(true);
    expect(online(up, "ac")?.confidence).toBe("assumed");
    expect(up.state.devices.find((d) => d.id === "lights")?.outputs.map((o) => o.id)).toEqual(["lights.front", "lights.rear"]);
  });
  it.each([
    [hwEvent("zigbee.node", { ieee: "0xa4c1380f2b9e0001", friendly_name: "r101_lights", model: "ZBM5-2C-86W", role: "router", power_source: "mains", lqi: null, battery_pct: null, last_seen: T0, online: false }), ["lights"]],
    [hwEvent("ir.blaster", { online: false, lqi: null }), ["ir_blaster", "projector", "ac"]],
  ] as const)("%j takes %j offline", (event, ids) => {
    const model = derive(applyHwEvent(applyHwEvent(bootModel(), snapshotEvent()), event), new Date(T0), RULES);
    expect(model.state.devices.filter((d) => d.online.value === false).map((d) => d.id).sort()).toEqual([...ids].sort());
  });
  it("§6.7: hw down keeps values for the grace, then every device is offline and every value stale", () => {
    const up = derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES); // the store always holds a derived model
    const down = applyHwDown(up, T0);
    const early = derive(down, at(9_999), RULES);
    expect(early.state.devices.every((d) => d.online.value === true)).toBe(true);
    expect(early.state.room.status.text).toBe("Hardware service offline");
    const late = derive(down, at(10_000), RULES);
    expect(late.state.devices.every((d) => d.online.value === false && d.online.stale)).toBe(true);
    expect(late.state.environment.lights.front).toMatchObject({ value: true, stale: true });
    expect(late.state.display.projector.power.value?.watts).toBe(287); // last value kept
    expect(late.state.zigbee.coordinator.status).toBe("offline");
    const back = derive(applyHwEvent(late, snapshotEvent(at(20_000).toISOString())), at(20_000), RULES);
    expect(back.state.connection.hw).toBe("up");
    expect(back.state.devices.every((d) => d.online.value === true && !d.online.stale)).toBe(true);
    expect(back.state.environment.lights.front.stale).toBe(false);
  });
});
```
5. Create `apps/core-api/test/domain/status.test.ts`:
```ts
import type { RoomState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import { deriveStatus } from "../../src/domain/status.ts";
import { bootModel, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const up = () => derive(applyHwEvent(bootModel(), snapshotEvent()), new Date(T0), RULES);
const node = (state: RoomState, name: string) => must(state.zigbee.nodes.find((n) => n.friendly_name === name));
const withEvent = (event: Parameters<typeof applyHwEvent>[1]) => derive(applyHwEvent(up(), event), new Date(T0), RULES).state;

describe("S1.E4 room status", () => {
  it("normal when everything reports", () => {
    expect(up().state.room.status).toEqual({ level: "normal", text: "All systems normal" });
  });
  it("fault: hw-service offline beats everything", () => {
    expect(deriveStatus(derive(applyHwDown(up(), T0), new Date(T0), RULES).state)).toEqual({ level: "fault", text: "Hardware service offline" });
  });
  it("fault: coordinator offline (H9)", () => {
    const state = withEvent(hwEvent("zigbee.coordinator", { ...up().state.zigbee.coordinator, status: "offline" }));
    expect(state.room.status).toEqual({ level: "fault", text: "Coordinator offline" });
  });
  it("degraded: one router offline names the device (R7: never fault)", () => {
    const state = withEvent(hwEvent("zigbee.node", { ...node(up().state, "r101_proj_plug"), online: false }));
    expect(state.room.status).toEqual({ level: "degraded", text: "Projector socket offline" });
  });
  it("degraded: two devices offline are counted", () => {
    let model = applyHwEvent(up(), hwEvent("zigbee.node", { ...node(up().state, "r101_lights"), online: false }));
    model = applyHwEvent(model, hwEvent("ir.blaster", { online: false, lqi: null }));
    // blaster offline takes the projector and the AC (both ir_zs06) with it
    expect(derive(model, new Date(T0), RULES).state.room.status).toEqual({ level: "degraded", text: "4 devices offline" });
  });
  it("S1.E41 counts sensor devices, not tiles; a stale climate tile drops one device", () => {
    expect(up().state.environment.sensors.reporting).toEqual({ count: 3, of: 3 });
    const fresh = applyHwEvent(applyHwEvent(up(), hwEvent("sensors.reading", { node: "r101_motion", kind: "occupancy", value: "clear" })), hwEvent("sensors.reading", { node: "r101_door", kind: "contact", value: "closed" }));
    const later = derive(fresh, new Date(Date.parse(T0) + 11 * 60_000), RULES); // climate reading is 11 min old
    expect(later.state.environment.sensors.reporting).toEqual({ count: 2, of: 3 });
    expect(later.state.room.status).toEqual({ level: "degraded", text: "Sensor not reporting" });
  });
  it("degraded: battery at 20 % (H16)", () => {
    const state = withEvent(hwEvent("zigbee.node", { ...node(up().state, "r101_door"), battery_pct: 20 }));
    expect(state.room.status).toEqual({ level: "degraded", text: "Sensor battery low" });
  });
});
```

**Test:** The two test files above.

**Verify:** `pnpm --filter @eduscope/core-api test` → 104 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): derived fields (online, staleness, status)"` (includes this plan file with the box ticked)

### T14 — State store: rev, re-derive, 50 ms coalesced broadcast
- [x] done

**Files:** `apps/core-api/src/domain/state-store.ts`, `apps/core-api/test/domain/state-store.test.ts`

**Context:** ARCHITECTURE §6.4 / D-02: one in-memory `RoomState`; `update(fn)` applies a pure mutation, re-derives, bumps `rev` (only when something changed), schedules one broadcast per 50 ms; `tick()` re-derives with the current time (staleness, H7b, hw grace) for the 10 s timer; `flush()` lets a `command`/`activity` event follow the state it refers to. `server_time` is stamped on read (S1.E2: clients show server time).

**Do:**
1. Create `apps/core-api/src/domain/state-store.ts`:
```ts
import type { RoomState } from "@eduscope/contracts";
import type { Clock } from "../clock.ts";
import { derive } from "./derive.ts";
import type { RoomModel, RuleConfig } from "./model.ts";

// ARCHITECTURE §6.4: the single in-memory RoomState. Every change goes through update(): apply a
// pure mutation, re-derive, bump `rev`, schedule ONE broadcast per 50 ms (D-02).

export const BROADCAST_COALESCE_MS = 50;

export interface StateStore {
  /** The current state, stamped with the server time. */
  get(): RoomState;
  model(): RoomModel;
  /** Applies `fn`, re-derives and bumps `rev` when anything changed. Returns the new state. */
  update(fn: (model: RoomModel, now: string) => RoomModel): RoomState;
  /** Re-derives with the current time (staleness, H7b, hw grace); broadcasts only on change. */
  tick(): void;
  /** Listeners get the coalesced state (each broadcast). */
  subscribe(listener: (state: RoomState) => void): () => void;
  /** Sends a pending broadcast now (before a `command`/`activity` event that refers to it). */
  flush(): void;
  /** Cancels a pending broadcast timer (shutdown). */
  close(): void;
}

/** Comparison key: everything except the fields that change on their own. */
const fingerprint = (state: RoomState): string => JSON.stringify({ ...state, rev: 0, server_time: "" });

export function createStateStore(options: { initial: RoomModel; clock: Clock; rules: RuleConfig; coalesceMs?: number }): StateStore {
  const { clock, rules } = options;
  const coalesceMs = options.coalesceMs ?? BROADCAST_COALESCE_MS;
  let model = derive(options.initial, clock.now(), rules);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(state: RoomState) => void>();

  const get = (): RoomState => ({ ...model.state, server_time: clock.now().toISOString() });

  const emit = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const state = get();
    for (const listener of listeners) listener(state);
  };

  const commit = (next: RoomModel): void => {
    if (fingerprint(next.state) === fingerprint(model.state)) {
      model = next; // facts may still have changed
      return;
    }
    model = { ...next, state: { ...next.state, rev: model.state.rev + 1 } };
    if (timer === null) timer = setTimeout(emit, coalesceMs);
  };

  return {
    get,
    model: () => model,
    update(fn) {
      const now = clock.now();
      commit(derive(fn(model, now.toISOString()), now, rules));
      return get();
    },
    tick() {
      commit(derive(model, clock.now(), rules));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush() {
      if (timer !== null) emit();
    },
    close() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
```
2. Create `apps/core-api/test/domain/state-store.test.ts`:
```ts
import type { RoomState } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixedClock } from "../../src/clock.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import { bootModel, hwEvent, RULES, snapshotEvent, T0 } from "../helpers.ts";

describe("state store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const clock = fixedClock(T0);
    const store = createStateStore({ initial: bootModel(), clock, rules: RULES });
    const seen: RoomState[] = [];
    store.subscribe((state) => seen.push(state));
    return { clock, store, seen };
  };

  it("starts derived at rev 0 with the link down", () => {
    const { store } = setup();
    expect(store.get().rev).toBe(0);
    expect(store.get().room.status.text).toBe("Hardware service offline");
    expect(store.get().devices).toHaveLength(12);
  });

  it("bumps rev on every change and coalesces broadcasts to one per 50 ms", () => {
    const { store, seen } = setup();
    store.update((m) => applyHwEvent(m, snapshotEvent()));
    store.update((m) => applyHwEvent(m, hwEvent("lights.state", { gang: "rear", on: true })));
    expect(store.get().rev).toBe(2);
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(50);
    expect(seen.map((s) => s.rev)).toEqual([2]);
  });

  it("an update that changes nothing keeps rev and sends nothing", () => {
    const { store, seen } = setup();
    store.update((m) => applyHwEvent(m, snapshotEvent()));
    vi.advanceTimersByTime(50);
    store.update((m) => applyHwEvent(m, hwEvent("heartbeat", {})));
    vi.advanceTimersByTime(50);
    expect(store.get().rev).toBe(1);
    expect(seen).toHaveLength(1);
  });

  it("rev is monotonic across many updates and flush() sends at once", () => {
    const { store, seen } = setup();
    for (let i = 0; i < 5; i += 1) {
      store.update((m) => applyHwEvent(m, hwEvent("lights.state", { gang: "front", on: i % 2 === 0 })));
      store.flush();
    }
    const revs = seen.map((s) => s.rev);
    expect(revs).toEqual([...revs].sort((a, b) => a - b));
    expect(new Set(revs).size).toBe(revs.length);
  });

  it("tick re-derives with the current time (hw grace) and server_time follows the clock", () => {
    const { store, clock } = setup();
    clock.advance(10_000);
    store.tick();
    expect(store.get().devices.every((d) => d.online.value === false)).toBe(true);
    expect(store.get().server_time).toBe("2026-10-05T10:42:10.000Z");
  });
});
```

**Test:** `apps/core-api/test/domain/state-store.test.ts` (above; fake timers).

**Verify:** `pnpm --filter @eduscope/core-api test` → 109 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): state store with rev and 50 ms coalescing"` (includes this plan file with the box ticked)

### T15 — hw-service HTTP client (timeouts per transport)
- [x] done

**Files:** `apps/core-api/src/hw/client.ts`, `apps/core-api/test/hw/client.test.ts`, `apps/core-api/test/helpers.ts`

**Context:** ARCHITECTURE §3.4 command endpoints, §6.3 (per-transport `AbortSignal.timeout`, responses parsed with the `hw/*` zod schemas). D3: every failure (unreachable, timeout, bad answer) becomes an `HwAck` `{ok:false, error:{code}}` so the dispatcher has one path; `timeout` → `timed_out`, anything else → `failed`. IR learn/cancel and permit join are M09. `test/helpers.ts` gains `fakeHw()` (records calls, scripted acks).

**Do:**
1. Create `apps/core-api/src/hw/client.ts`:
```ts
import {
  HwAck, type HwAudioLevelRequest, type HwAudioMuteRequest, type HwHdmiSelectRequest, type HwIrSendRequest,
  type HwLightsSetRequest, type HwProjectionScreenMoveRequest, type HwProjectorPowerRelayRequest,
} from "@eduscope/contracts";

// ARCHITECTURE §3.4 / §6.3: core-api → hw-service commands. Every outcome is an HwAck: an
// unreachable service, a timeout or a bad answer become `{ok:false}` so the dispatcher has one path.

export interface HwClient {
  lightsSet(body: HwLightsSetRequest): Promise<HwAck>;
  projectorRelay(body: HwProjectorPowerRelayRequest): Promise<HwAck>;
  irSend(body: HwIrSendRequest): Promise<HwAck>;
  hdmiSelect(body: HwHdmiSelectRequest): Promise<HwAck>;
  screenMove(body: HwProjectionScreenMoveRequest): Promise<HwAck>;
  audioLevel(body: HwAudioLevelRequest): Promise<HwAck>;
  audioMute(body: HwAudioMuteRequest): Promise<HwAck>;
}

export interface HwTimeouts {
  zigbeeMs: number;
  irSendMs: number;
  hdmiMs: number;
  mixerMs: number;
  screenMs: number;
}

export function createHwClient(options: { baseUrl: string; timeouts: HwTimeouts; fetch?: typeof fetch }): HwClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const { timeouts } = options;

  async function post(path: string, body: unknown, timeoutMs: number): Promise<HwAck> {
    let response: Response;
    try {
      response = await doFetch(`${options.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return timedOut
        ? { ok: false, error: { code: "timeout", message: `${path}: no answer in ${timeoutMs} ms` } }
        : { ok: false, error: { code: "transport", message: "hw-service unreachable" } };
    }
    const raw: unknown = await response.json().catch(() => null);
    const ack = HwAck.safeParse(raw);
    if (ack.success) return ack.data;
    return { ok: false, error: { code: "transport", message: `${path}: unexpected answer (HTTP ${response.status})` } };
  }

  return {
    lightsSet: (body) => post("/v1/lights/set", body, timeouts.zigbeeMs),
    projectorRelay: (body) => post("/v1/projector_power/relay", body, timeouts.zigbeeMs),
    irSend: (body) => post("/v1/ir/send", body, timeouts.irSendMs),
    hdmiSelect: (body) => post("/v1/hdmi/select", body, timeouts.hdmiMs),
    screenMove: (body) => post("/v1/projection_screen/move", body, timeouts.screenMs),
    audioLevel: (body) => post("/v1/audio/level", body, timeouts.mixerMs),
    audioMute: (body) => post("/v1/audio/mute", body, timeouts.mixerMs),
  };
}
```
2. Replace the whole file `apps/core-api/test/helpers.ts`:
```ts
import { readdirSync, readFileSync } from "node:fs";
import { DeviceKind, HwEvent, Transport, type HwAck } from "@eduscope/contracts";
import { vi } from "vitest";
import { Config } from "../src/config.ts";
import type { HwClient } from "../src/hw/client.ts";
import { initialModel } from "../src/domain/initial.ts";
import type { DeviceInfo, RoomModel, RuleConfig } from "../src/domain/model.ts";
import { SEED_DEVICES } from "../src/db/seed.ts";

/** Screenshot clock (Mon 5 Oct 10:42 UTC); every test that needs "now" starts here. */
export const T0 = "2026-10-05T10:42:00.000Z";

/** A complete, valid config for tests; override any key. */
export function testConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  return Config.parse({
    DB_PATH: ":memory:",
    COOKIE_SECRET: "test-cookie-secret-test-cookie-secret",
    INITIAL_ROOM_PIN: "1234",
    INITIAL_TECH_PIN: "123456",
    ...overrides,
  });
}

export const RULES: RuleConfig = { climateIntervalS: 300, powerIntervalS: 60, hwDownGraceMs: 10_000 };

/** The seeded R-101 registry as domain DeviceInfo. */
export const REGISTRY: DeviceInfo[] = SEED_DEVICES.map((row) => ({
  id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
  brand: row.brand ?? null, model: row.model ?? null, hw_ref: row.hw_ref ?? null,
}));

export function bootModel(overrides: Partial<Parameters<typeof initialModel>[0]> = {}): RoomModel {
  return initialModel({
    room: { id: "R-101", hostname: "r-101.local" },
    registry: REGISTRY,
    acSetpoints: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    interlockBypassed: false,
    kwhBaseline: null,
    now: T0,
    ...overrides,
  });
}

const FIXTURES = new URL("../../../packages/contracts/fixtures/hw/", import.meta.url);

/** A parsed fixtures/hw file. */
export function hwFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8"));
}

/** Every `event.*.json` in fixtures/hw, parsed as HwEvent. */
export function hwEventFixtures(): { name: string; event: HwEvent }[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.startsWith("event.") && name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, event: HwEvent.parse(hwFixture(name)) }));
}

/** The fixture snapshot event (screenshot 01 state), with its time moved to `at`. */
export function snapshotEvent(at: string = T0): HwEvent {
  const event = HwEvent.parse(hwFixture("event.snapshot.json"));
  return { ...event, at };
}

export function hwEvent<T extends HwEvent["type"]>(type: T, data: Extract<HwEvent, { type: T }>["data"], at: string = T0): HwEvent {
  return HwEvent.parse({ type, at, data });
}

export interface FakeHw extends HwClient {
  calls: { method: keyof HwClient; body: unknown }[];
  /** Answer of the next calls (default `{ok:true}`). */
  nextAcks: HwAck[];
  /** Runs after each call is recorded (e.g. to feed the echo event into ingest). */
  onCall?: (method: keyof HwClient, body: unknown) => void;
}

export function fakeHw(): FakeHw {
  const hw: FakeHw = {
    calls: [],
    nextAcks: [],
    lightsSet: vi.fn(async (body) => record("lightsSet", body)),
    projectorRelay: vi.fn(async (body) => record("projectorRelay", body)),
    irSend: vi.fn(async (body) => record("irSend", body)),
    hdmiSelect: vi.fn(async (body) => record("hdmiSelect", body)),
    screenMove: vi.fn(async (body) => record("screenMove", body)),
    audioLevel: vi.fn(async (body) => record("audioLevel", body)),
    audioMute: vi.fn(async (body) => record("audioMute", body)),
  };
  function record(method: keyof HwClient, body: unknown): HwAck {
    hw.calls.push({ method, body });
    hw.onCall?.(method, body);
    return hw.nextAcks.shift() ?? { ok: true };
  }
  return hw;
}

/** Unwraps a value a test knows is there (no `!` allowed by lint). */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
```
3. Create `apps/core-api/test/hw/client.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createHwClient } from "../../src/hw/client.ts";
import { must } from "../helpers.ts";

const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000 };

describe("hw client", () => {
  it("POSTs JSON to the §3.4 path and returns the parsed ack", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }));
    const hw = createHwClient({ baseUrl: "http://127.0.0.1:8081", timeouts: TIMEOUTS, fetch });
    expect(await hw.lightsSet({ gang: "rear", on: true })).toEqual({ ok: true });
    const [url, init] = must(fetch.mock.calls[0]);
    expect(url).toBe("http://127.0.0.1:8081/v1/lights/set");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"gang":"rear","on":true}');
  });

  it("passes a hw error ack through", async () => {
    const ack = { ok: false, error: { code: "device_offline", message: "r101_ir is offline" } };
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch: vi.fn(async () => Response.json(ack)) });
    expect(await hw.irSend({ transport: "ir_zs06", code_format: "tuya", code: "x" })).toEqual(ack);
  });

  it.each([
    ["unreachable", async () => Promise.reject(new TypeError("fetch failed")), "transport"],
    ["timeout", async () => Promise.reject(new DOMException("timed out", "TimeoutError")), "timeout"],
    ["bad answer", async () => Response.json({ nope: 1 }, { status: 500 }), "transport"],
  ] as const)("%s → ok:false %s", async (_name, impl, code) => {
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch: vi.fn(impl) });
    expect(await hw.audioLevel({ channel: "mic", level: 10 })).toMatchObject({ ok: false, error: { code } });
  });
});
```

**Test:** `apps/core-api/test/hw/client.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 114 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): hw-service HTTP client"` (includes this plan file with the box ticked)

### T16 — hw SSE stream: parser, backoff, dead detection
- [x] done

**Files:** `apps/core-api/src/hw/stream.ts`, `apps/core-api/test/hw/stream.test.ts`

**Context:** ARCHITECTURE §6.3: `fetch('/v1/events')` + `eventsource-parser`; every event zod-parsed (`HwEvent`), invalid → reported + dropped; backoff 0.5 → 5 s; no frame for 15 s ⇒ reconnect. The first event of every connection is a snapshot (§3.4); a snapshot resets the backoff. AC11: "hw stream parsing of all `fixtures/hw` events".

**Do:**
1. Create `apps/core-api/src/hw/stream.ts`:
```ts
import { HwEvent } from "@eduscope/contracts";
import { createParser } from "eventsource-parser";

// ARCHITECTURE §6.3: GET /v1/events (SSE). First event is always a snapshot. Every event is zod-parsed
// (invalid → reported + dropped). Drop ⇒ onDown, backoff 0.5 → 5 s, retry; no frame for 15 s ⇒ dead.

/** Turns SSE text chunks into parsed HwEvents. */
export function createHwEventDecoder(onEvent: (event: HwEvent) => void, onInvalid: (reason: string) => void): (chunk: string) => void {
  const parser = createParser({
    onEvent(message) {
      let raw: unknown;
      try {
        raw = JSON.parse(message.data);
      } catch {
        onInvalid(`non-JSON ${message.event ?? "message"} event`);
        return;
      }
      const parsed = HwEvent.safeParse(raw);
      if (parsed.success) onEvent(parsed.data);
      else onInvalid(`invalid ${message.event ?? "message"} event: ${parsed.error.issues[0]?.message ?? "?"}`);
    },
  });
  return (chunk) => parser.feed(chunk);
}

export interface HwStreamOptions {
  url: string;
  onEvent(event: HwEvent): void;
  /** The stream dropped or could not connect (called once per drop). */
  onDown(): void;
  onInvalid(reason: string): void;
  deadMs: number;
  fetch?: typeof fetch;
  backoffMs?: readonly number[];
}

export const BACKOFF_MS = [500, 1000, 2000, 4000, 5000] as const;

export interface HwStream {
  stop(): void;
}

export function startHwStream(options: HwStreamOptions): HwStream {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const backoff = options.backoffMs ?? BACKOFF_MS;
  let stopped = false;
  let attempt = 0;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  async function connectOnce(): Promise<void> {
    controller = new AbortController();
    const abort = controller;
    let deadTimer: ReturnType<typeof setTimeout> | null = null;
    const alive = (): void => {
      if (deadTimer !== null) clearTimeout(deadTimer);
      deadTimer = setTimeout(() => abort.abort(), options.deadMs);
    };
    try {
      alive();
      const response = await doFetch(options.url, { headers: { accept: "text/event-stream" }, signal: abort.signal });
      if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status}`);
      const feed = createHwEventDecoder((event) => {
        if (event.type === "snapshot") attempt = 0; // a good connection resets the backoff
        options.onEvent(event);
      }, options.onInvalid);
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        alive();
        feed(decoder.decode(chunk, { stream: true }));
      }
    } catch {
      // connection refused, aborted (dead) or broken: handled below
    } finally {
      if (deadTimer !== null) clearTimeout(deadTimer);
    }
  }

  async function loop(): Promise<void> {
    while (!stopped) {
      await connectOnce();
      if (stopped) return;
      options.onDown();
      const delay = backoff[Math.min(attempt, backoff.length - 1)] ?? 5000;
      attempt += 1;
      await new Promise<void>((resolve) => {
        retryTimer = setTimeout(resolve, delay);
      });
    }
  }

  void loop();
  return {
    stop() {
      stopped = true;
      controller?.abort();
      if (retryTimer !== null) clearTimeout(retryTimer);
    },
  };
}
```
2. Create `apps/core-api/test/hw/stream.test.ts`:
```ts
import type { HwEvent } from "@eduscope/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHwEventDecoder, startHwStream } from "../../src/hw/stream.ts";
import { hwEventFixtures, must } from "../helpers.ts";

const sse = (event: HwEvent): string => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

describe("hw SSE decoder", () => {
  it("parses every fixtures/hw event, even when chunks split frames anywhere", () => {
    const fixtures = hwEventFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(15);
    const text = fixtures.map(({ event }) => sse(event)).join("");
    const seen: HwEvent[] = [];
    const feed = createHwEventDecoder((event) => seen.push(event), (reason) => expect.fail(reason));
    for (let i = 0; i < text.length; i += 7) feed(text.slice(i, i + 7));
    expect(seen).toEqual(fixtures.map(({ event }) => event));
  });

  it("drops non-JSON and contract-violating events and reports them", () => {
    const seen: HwEvent[] = [];
    const invalid: string[] = [];
    const feed = createHwEventDecoder((event) => seen.push(event), (reason) => invalid.push(reason));
    feed("event: lights.state\ndata: not json\n\n");
    feed('event: lights.state\ndata: {"type":"lights.state","at":"2026-10-05T10:42:00Z","data":{"gang":"middle","on":true}}\n\n');
    feed('event: heartbeat\ndata: {"type":"heartbeat","at":"2026-10-05T10:42:00Z","data":{}}\n\n');
    expect(seen.map((e) => e.type)).toEqual(["heartbeat"]);
    expect(invalid).toHaveLength(2);
    expect(invalid[0]).toContain("non-JSON");
  });
});

describe("startHwStream", () => {
  afterEach(() => vi.useRealTimers());

  const body = (text: string): ReadableStream<Uint8Array> =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });

  it("delivers events, reports the drop and reconnects with backoff", async () => {
    const snapshot = must(hwEventFixtures().find(({ name }) => name === "event.snapshot.json")).event;
    const fetch = vi.fn(async () => new Response(body(sse(snapshot)), { status: 200 }));
    const events: string[] = [];
    let downs = 0;
    const stream = startHwStream({
      url: "http://hw/v1/events", deadMs: 15_000, fetch, backoffMs: [10],
      onEvent: (event) => events.push(event.type), onDown: () => (downs += 1), onInvalid: () => undefined,
    });
    await vi.waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2));
    stream.stop();
    expect(events.slice(0, 2)).toEqual(["snapshot", "snapshot"]);
    expect(downs).toBeGreaterThanOrEqual(1);
  });

  it("connection refused ⇒ onDown, then retries", async () => {
    const fetch = vi.fn(async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    });
    let downs = 0;
    const stream = startHwStream({
      url: "http://hw/v1/events", deadMs: 15_000, fetch, backoffMs: [5],
      onEvent: () => undefined, onDown: () => (downs += 1), onInvalid: () => undefined,
    });
    await vi.waitFor(() => expect(downs).toBeGreaterThanOrEqual(2));
    stream.stop();
  });

  it("no frame for deadMs ⇒ the stream is treated as dead", async () => {
    // Never sends, never closes; like real fetch, aborting the request errors the body.
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const silent = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(silent, { status: 200 });
    });
    let downs = 0;
    const stream = startHwStream({
      url: "http://hw/v1/events", deadMs: 30, fetch, backoffMs: [60_000],
      onEvent: () => undefined, onDown: () => (downs += 1), onInvalid: () => undefined,
    });
    await vi.waitFor(() => expect(downs).toBe(1));
    stream.stop();
  });
});
```

**Test:** `apps/core-api/test/hw/stream.test.ts` (above): all fixture events through 7-byte chunks; invalid frames; reconnect after a drop; connection refused; a silent stream is dead after `deadMs`.

**Verify:** `pnpm --filter @eduscope/core-api test` → 119 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): hw SSE stream with backoff and dead detection"` (includes this plan file with the box ticked)

### T17 — IR code lookup
- [x] done

**Files:** `apps/core-api/src/commands/ir-codes.ts`, `apps/core-api/test/commands/ir-codes.test.ts`

**Context:** Milestone note: seeded IR rows have no code, so projector/AC commands fail with a clear `ir_code_missing` precondition message until M09 learns codes. R4 `available_setpoints` = captured setpoint frames, ascending. R8: the device's transport (`ir_zs06` / `ir_mcu`) is what `/v1/ir/send` gets. Codes never leave core-api except to hw-service.

**Do:**
1. Create `apps/core-api/src/commands/ir-codes.ts`:
```ts
import type { IrTransport } from "@eduscope/contracts";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { devices, irCommands } from "../db/schema.ts";

// Stored IR codes for the dispatcher. Codes never leave core-api except to hw-service.

export type IrMatch = { role: "power_on" | "power_off" } | { setpoint_c: number };
export type IrCodeResult = { ok: true; code: string; transport: IrTransport } | { ok: false; message: string };

export interface IrCodeLookup {
  find(deviceId: string, match: IrMatch): IrCodeResult;
}

const isIrTransport = (value: string): value is IrTransport => value === "ir_zs06" || value === "ir_mcu";

export function createIrCodeLookup(db: Db): IrCodeLookup {
  return {
    find(deviceId, match) {
      const device = db.select().from(devices).where(eq(devices.id, deviceId)).get();
      if (device === undefined || !isIrTransport(device.transport)) return { ok: false, message: `${deviceId} is not an IR device` };
      const rows = db.select().from(irCommands).where(eq(irCommands.device_id, deviceId)).all();
      const row = rows.find((r) => ("role" in match ? r.role === match.role : r.role === "setpoint" && r.setpoint_temp_c === match.setpoint_c));
      const name = row?.name ?? ("role" in match ? match.role : `${match.setpoint_c}°`);
      if (row === undefined || row.code === null) return { ok: false, message: `${device.name} · ${name} has no captured IR code` };
      return { ok: true, code: row.code, transport: device.transport };
    },
  };
}

/** R4: AC setpoints that have a captured frame, ascending. */
export function capturedSetpoints(db: Db, deviceId: string): number[] {
  return db
    .select()
    .from(irCommands)
    .where(and(eq(irCommands.device_id, deviceId), eq(irCommands.role, "setpoint"), isNotNull(irCommands.code)))
    .all()
    .flatMap((row) => (row.setpoint_temp_c === null ? [] : [row.setpoint_temp_c]))
    .sort((a, b) => a - b);
}
```
2. Create `apps/core-api/test/commands/ir-codes.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { capturedSetpoints, createIrCodeLookup } from "../../src/commands/ir-codes.ts";
import { openDb } from "../../src/db/client.ts";
import { devices, irCommands } from "../../src/db/schema.ts";
import { seed } from "../../src/db/seed.ts";
import { T0, testConfig } from "../helpers.ts";

async function seeded(fakeCodes: boolean) {
  const { db } = openDb(":memory:");
  await seed(db, testConfig({ SEED_FAKE_IR_CODES: fakeCodes ? "true" : "false" }), T0);
  return db;
}

describe("IR code lookup", () => {
  it("finds a captured code with the device's transport", async () => {
    const ir = createIrCodeLookup(await seeded(true));
    expect(ir.find("projector", { role: "power_on" })).toEqual({ ok: true, code: "C/8hRgHrBkYBgAMH", transport: "ir_zs06" });
    expect(ir.find("ac", { setpoint_c: 24 })).toMatchObject({ ok: true, transport: "ir_zs06" });
  });

  it("names the missing code (ir_code_missing) and unknown setpoints", async () => {
    const ir = createIrCodeLookup(await seeded(false));
    expect(ir.find("projector", { role: "power_on" })).toEqual({ ok: false, message: "Projector · Power on has no captured IR code" });
    expect(ir.find("ac", { setpoint_c: 31 })).toEqual({ ok: false, message: "Air conditioning · 31° has no captured IR code" });
    expect(ir.find("lights", { role: "power_on" })).toEqual({ ok: false, message: "lights is not an IR device" });
  });

  it("R8: a device switched to the MCU fallback sends over ir_mcu", async () => {
    const db = await seeded(true);
    db.update(devices).set({ transport: "ir_mcu" }).where(eq(devices.id, "projector")).run();
    expect(createIrCodeLookup(db).find("projector", { role: "power_off" })).toMatchObject({ ok: true, transport: "ir_mcu" });
  });

  it("R4: captured setpoints only, ascending", async () => {
    const db = await seeded(false);
    expect(capturedSetpoints(db, "ac")).toEqual([]);
    for (const temp of [26, 18, 24]) db.update(irCommands).set({ code: `c${temp}` }).where(eq(irCommands.id, `ac.setpoint_${temp}`)).run();
    expect(capturedSetpoints(db, "ac")).toEqual([18, 24, 26]);
  });
});
```

**Test:** `apps/core-api/test/commands/ir-codes.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 123 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): IR code lookup"` (includes this plan file with the box ticked)

### T18 — Command policies: access per kind, preconditions, hw call plans
- [x] done

**Files:** `apps/core-api/src/commands/policies.ts`, `apps/core-api/test/commands/policies.test.ts`

**Context:** ARCHITECTURE §6.5 `policies.ts` (required access per kind, preconditions: device online, blaster online H25, interlock R11, AC bounds R4/Q5/H19) and §6.7 (hw down ⇒ `hw_unavailable`). D4: a refused command is an HTTP error (409 `precondition` / 503 `hw_unavailable`) and no Command is created. H6a texts per transport: IR "Couldn't reach the blaster", zigbee "Switch didn't respond", others "Command failed" (the kiosk shows `command.error`). R9 mute all = mute both channels; unmute = unmute both, then restore the saved levels. Deadline per plan = the transport timeout (mute all: × number of calls).

**Do:**
1. Create `apps/core-api/src/commands/policies.ts`:
```ts
import type { ApiErrorCode, ChangedBy, CommandBody, HwAck, RoomState } from "@eduscope/contracts";
import { acSent, powerOnSetpoint, stepTarget } from "../domain/ac.ts";
import { saveLevels } from "../domain/audio.ts";
import type { OutputKey } from "../domain/hw-events.ts";
import { mainsOffBlocked } from "../domain/interlock.ts";
import type { RoomModel } from "../domain/model.ts";
import { feedbackAfterIr } from "../domain/projector.ts";
import type { HwClient, HwTimeouts } from "../hw/client.ts";
import type { IrCodeLookup, IrMatch } from "./ir-codes.ts";

// ARCHITECTURE §6.5 policies: required access per kind, preconditions (hw up, device online,
// blaster online H25, interlock R11, AC rules R4/Q5/H19, captured code), and the hw calls to make.

export type HwCall = (hw: HwClient) => Promise<HwAck>;

export interface CommandPlan {
  key: OutputKey;
  calls: readonly HwCall[];
  /** Deadline for the whole command: acks + read-back (Q12). */
  timeoutMs: number;
  /** H6a line when hw refuses. */
  failureText: string;
  /** IR has no read-back: the command ends `assumed` right after the ack (R2, R3). */
  ir: boolean;
  /** Applied before the first hw call (R9 saved levels, H7b waiting). */
  before?: (model: RoomModel, at: string) => RoomModel;
  /** Undoes `before` when hw refuses. */
  revert?: (model: RoomModel) => RoomModel;
  /** IR only: the assumed values once the blaster accepted the frame. */
  after?: (model: RoomModel, at: string, by: ChangedBy) => RoomModel;
  /** Non-IR: the state that proves the command worked (correlation). */
  confirmedBy?: (state: RoomState) => boolean;
}

export type PlanResult = { ok: true; plan: CommandPlan } | { ok: false; status: 409 | 503; code: ApiErrorCode; message: string };

export const FAILURE_TEXT = {
  ir: "Couldn't reach the blaster",
  zigbee: "Switch didn't respond",
  other: "Command failed",
} as const;

/** R14 + ARCHITECTURE §5: projector mains is technician-only, everything else needs control. */
export function requiredAccess(body: CommandBody): "control" | "technician" {
  return body.kind === "projector.mains" ? "technician" : "control";
}

const refuse = (message: string): PlanResult => ({ ok: false, status: 409, code: "precondition", message });

function deviceOffline(state: RoomState, deviceId: string): string | null {
  const device = state.devices.find((d) => d.id === deviceId);
  return device?.online.value === false ? `${device.name} offline` : null;
}

function withAc(model: RoomModel, change: Parameters<typeof acSent>[1], at: string, by: ChangedBy): RoomModel {
  const { environment } = model.state;
  return { ...model, state: { ...model.state, environment: { ...environment, ac: acSent(environment.ac, change, at, by) } } };
}

function irPlan(
  model: RoomModel, ir: IrCodeLookup, timeouts: HwTimeouts, deviceId: string, match: IrMatch, key: OutputKey,
  extra: Pick<CommandPlan, "before" | "revert" | "after">,
): PlanResult {
  const found = ir.find(deviceId, match);
  if (!found.ok) return refuse(found.message);
  if (found.transport === "ir_zs06" && model.state.ir_blaster.online.value === false) return refuse("IR blaster offline"); // H25
  const send: HwCall = (hw) => hw.irSend({ transport: found.transport, code_format: "tuya", code: found.code });
  return { ok: true, plan: { key, calls: [send], timeoutMs: timeouts.irSendMs, failureText: FAILURE_TEXT.ir, ir: true, ...extra } };
}

export function planCommand(body: CommandBody, model: RoomModel, ir: IrCodeLookup, timeouts: HwTimeouts): PlanResult {
  const { state } = model;
  if (state.connection.hw === "down") return { ok: false, status: 503, code: "hw_unavailable", message: "Hardware service offline" };

  switch (body.kind) {
    case "source.select": {
      const offline = deviceOffline(state, "hdmi_switch");
      if (offline !== null) return refuse(offline);
      return {
        ok: true,
        plan: {
          key: "display.source", calls: [(hw) => hw.hdmiSelect({ input: body.input })], timeoutMs: timeouts.hdmiMs,
          failureText: FAILURE_TEXT.other, ir: false, confirmedBy: (s) => s.display.source.value === body.input,
        },
      };
    }
    case "projector.power": {
      const previous = state.display.projector.feedback;
      return irPlan(model, ir, timeouts, "projector", { role: body.on ? "power_on" : "power_off" }, "projector.ir", {
        before: (m, at) => {
          const { projector } = m.state.display;
          const feedback = feedbackAfterIr(body.on, projector.state.value, at);
          return { ...m, state: { ...m.state, display: { ...m.state.display, projector: { ...projector, feedback } } } };
        },
        revert: (m) => ({ ...m, state: { ...m.state, display: { ...m.state.display, projector: { ...m.state.display.projector, feedback: previous } } } }),
      });
    }
    case "projector.mains": {
      const offline = deviceOffline(state, "projector_socket");
      if (offline !== null) return refuse(offline);
      if (!body.on) {
        const blocked = mainsOffBlocked(state, model.facts.interlock_bypassed); // R11
        if (blocked !== null) return refuse(blocked);
      }
      return {
        ok: true,
        plan: {
          key: "projector.mains", calls: [(hw) => hw.projectorRelay({ on: body.on })], timeoutMs: timeouts.zigbeeMs,
          failureText: FAILURE_TEXT.zigbee, ir: false, confirmedBy: (s) => s.display.projector.mains.value === body.on,
        },
      };
    }
    case "screen.move": {
      const offline = deviceOffline(state, "projection_screen");
      if (offline !== null) return refuse(offline);
      const target = body.to === "raise" ? "raised" : "lowered";
      return {
        ok: true,
        plan: {
          key: "screen", calls: [(hw) => hw.screenMove({ to: body.to })], timeoutMs: timeouts.screenMs,
          failureText: FAILURE_TEXT.other, ir: false, confirmedBy: (s) => s.display.screen.value === target,
        },
      };
    }
    case "audio.level": {
      const offline = deviceOffline(state, "audio");
      if (offline !== null) return refuse(offline);
      return {
        ok: true,
        plan: {
          key: body.channel === "mic" ? "audio.mic" : "audio.pc",
          calls: [(hw) => hw.audioLevel({ channel: body.channel, level: body.level })], timeoutMs: timeouts.mixerMs,
          failureText: FAILURE_TEXT.other, ir: false, confirmedBy: (s) => s.audio.channels[body.channel].value === body.level,
        },
      };
    }
    case "audio.mute_all": {
      const offline = deviceOffline(state, "audio");
      if (offline !== null) return refuse(offline);
      const mute: HwCall[] = [(hw) => hw.audioMute({ channel: "mic", muted: body.muted }), (hw) => hw.audioMute({ channel: "pc", muted: body.muted })];
      const saved = state.audio.saved_levels;
      // R9: unmute restores the levels saved by the mute, after both channels are unmuted.
      const restore: HwCall[] = body.muted
        ? []
        : (["mic", "pc"] as const).flatMap((channel): HwCall[] => {
            const level = saved[channel];
            return level === null ? [] : [(hw) => hw.audioLevel({ channel, level })];
          });
      const calls = [...mute, ...restore];
      return {
        ok: true,
        plan: {
          key: "audio.mute", calls, timeoutMs: timeouts.mixerMs * calls.length, failureText: FAILURE_TEXT.other, ir: false,
          before: (m) => (body.muted ? { ...m, state: { ...m.state, audio: saveLevels(m.state.audio) } } : m),
          confirmedBy: (s) => s.audio.muted_all.value === body.muted,
        },
      };
    }
    case "lights.set": {
      const offline = deviceOffline(state, "lights");
      if (offline !== null) return refuse(offline);
      return {
        ok: true,
        plan: {
          key: body.gang === "front" ? "lights.front" : "lights.rear",
          calls: [(hw) => hw.lightsSet({ gang: body.gang, on: body.on })], timeoutMs: timeouts.zigbeeMs,
          failureText: FAILURE_TEXT.zigbee, ir: false, confirmedBy: (s) => s.environment.lights[body.gang].value === body.on,
        },
      };
    }
    case "ac.power": {
      if (!body.on) {
        return irPlan(model, ir, timeouts, "ac", { role: "power_off" }, "ac", {
          after: (m, at, by) => withAc(m, { power: "off" }, at, by),
        });
      }
      const setpoint = powerOnSetpoint(state.environment.ac);
      if (setpoint === null) return refuse("Air conditioning has no captured setpoint frame");
      return irPlan(model, ir, timeouts, "ac", { setpoint_c: setpoint }, "ac", {
        after: (m, at, by) => withAc(m, { power: "on", setpoint_c: setpoint }, at, by),
      });
    }
    case "ac.step": {
      const step = stepTarget(state.environment.ac, body.direction);
      if (!step.ok) return refuse(step.reason);
      return irPlan(model, ir, timeouts, "ac", { setpoint_c: step.temp_c }, "ac", {
        after: (m, at, by) => withAc(m, { setpoint_c: step.temp_c }, at, by),
      });
    }
  }
}
```
2. Create `apps/core-api/test/commands/policies.test.ts`:
```ts
import type { CommandBody, HwEvent } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import { FAILURE_TEXT, planCommand, requiredAccess } from "../../src/commands/policies.ts";
import { derive } from "../../src/domain/derive.ts";
import { applyHwDown, applyHwEvent } from "../../src/domain/hw-events.ts";
import type { RoomModel } from "../../src/domain/model.ts";
import { bootModel, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000 };

const ir = (codes: Record<string, string>): IrCodeLookup => ({
  find(deviceId, match) {
    const key = "role" in match ? `${deviceId}.${match.role}` : `${deviceId}.setpoint_${match.setpoint_c}`;
    const code = codes[key];
    return code === undefined ? { ok: false, message: `${key} has no captured IR code` } : { ok: true, code, transport: "ir_zs06" };
  },
});
const CODES = ir({ "projector.power_on": "ON", "ac.power_off": "AC-OFF", "ac.setpoint_24": "AC-24", "ac.setpoint_26": "AC-26" });

/** R-101 live (snapshot applied, derived), plus any extra hw events. */
function live(...events: HwEvent[]): RoomModel {
  let model = applyHwEvent(bootModel({ acSetpoints: [24, 26] }), snapshotEvent());
  for (const event of events) model = applyHwEvent(model, event);
  return derive(model, new Date(T0), RULES);
}

const refusal = (body: CommandBody, model: RoomModel = live(), codes: IrCodeLookup = CODES) => {
  const result = planCommand(body, model, codes, TIMEOUTS);
  return result.ok ? null : { status: result.status, code: result.code, message: result.message };
};

describe("command policies (§6.5)", () => {
  it("R14: projector mains needs technician, everything else control", () => {
    expect(requiredAccess({ kind: "projector.mains", on: false })).toBe("technician");
    expect(requiredAccess({ kind: "lights.set", gang: "rear", on: true })).toBe("control");
  });

  it("hw down → 503 hw_unavailable for every kind", () => {
    const down = derive(applyHwDown(live(), T0), new Date(T0), RULES);
    expect(refusal({ kind: "lights.set", gang: "rear", on: true }, down)).toEqual({ status: 503, code: "hw_unavailable", message: "Hardware service offline" });
  });

  it.each([
    [{ kind: "projector.mains", on: false }, "Projector still draws 287 W · mains stays on until it cools"], // R11
    [{ kind: "ac.step", direction: "up" }, "Turn the air conditioning on first"], // Q5
    [{ kind: "projector.power", on: false }, "projector.power_off has no captured IR code"], // ir_code_missing
  ] as const)("%j → 409 %s", (body, message) => {
    expect(refusal(body)).toEqual({ status: 409, code: "precondition", message });
  });

  it("H8/H25: device offline and blaster offline", () => {
    const lights = must(live().state.zigbee.nodes.find((n) => n.friendly_name === "r101_lights"));
    expect(refusal({ kind: "lights.set", gang: "rear", on: true }, live(hwEvent("zigbee.node", { ...lights, online: false })))?.message).toBe("Lighting switch offline");
    expect(refusal({ kind: "ac.power", on: false }, live(hwEvent("ir.blaster", { online: false, lqi: null })))?.message).toBe("IR blaster offline");
  });

  it("AC power on without any captured setpoint frame", () => {
    const model = derive(applyHwEvent(bootModel({ acSetpoints: [] }), snapshotEvent()), new Date(T0), RULES);
    expect(refusal({ kind: "ac.power", on: true }, model)?.message).toBe("Air conditioning has no captured setpoint frame");
  });

  it("plans carry the output key, the transport timeout and the H6a text", () => {
    const lights = planCommand({ kind: "lights.set", gang: "front", on: false }, live(), CODES, TIMEOUTS);
    expect(lights.ok && { key: lights.plan.key, timeoutMs: lights.plan.timeoutMs, failureText: lights.plan.failureText, ir: lights.plan.ir })
      .toEqual({ key: "lights.front", timeoutMs: 5000, failureText: FAILURE_TEXT.zigbee, ir: false });
    const ac = planCommand({ kind: "ac.power", on: true }, live(), CODES, TIMEOUTS);
    expect(ac.ok && { key: ac.plan.key, timeoutMs: ac.plan.timeoutMs, failureText: ac.plan.failureText, ir: ac.plan.ir })
      .toEqual({ key: "ac", timeoutMs: 3000, failureText: "Couldn't reach the blaster", ir: true });
    const unmute = planCommand({ kind: "audio.mute_all", muted: false }, live(), CODES, TIMEOUTS);
    expect(unmute.ok && unmute.plan.calls.length).toBe(2); // nothing saved yet: no level restore
  });
});
```

**Test:** `apps/core-api/test/commands/policies.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 131 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): command policies and preconditions"` (includes this plan file with the box ticked)

### T19 — Command dispatcher: pending → sent → assumed / failed / timed_out, last write wins
- [x] done

**Files:** `apps/core-api/src/errors.ts`, `apps/core-api/src/commands/dispatcher.ts`, `apps/core-api/test/commands/setup.ts`, `apps/core-api/test/commands/dispatcher.test.ts`

**Context:** ARCHITECTURE §6.5: create `Command` (`pending`), broadcast, call hw → `sent` or `failed`, IR ⇒ `assumed` + assumed values (R3) right after the ack; read-back outputs wait for a report (T20) or the deadline (`timed_out`). LWW (R12): a newer command on the same output ends the older one as `assumed` without a toast (D5). `audio.level` with `final:false` is neither logged nor toasted. Activity = H13 with the issuer's label and `public_id` (the kiosk drops its own). `CommandRejected` carries the HTTP status for the route (T27).

**Do:**
1. Create `apps/core-api/src/errors.ts`:
```ts
import type { ApiErrorCode } from "@eduscope/contracts";

/** Any failure a route answers with an ApiError body (`{code, message}`). */
export class ApiFailure extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiFailure";
    this.status = status;
    this.code = code;
  }
}
```
2. Create `apps/core-api/src/commands/dispatcher.ts`:
```ts
import { randomUUID } from "node:crypto";
import type { AccessLevel, ApiErrorCode, ClientLabel, Command, CommandRequest, CommandStatus, RoomState, ServerEvent } from "@eduscope/contracts";
import type { Clock } from "../clock.ts";
import type { EventLogger } from "../db/event-log.ts";
import { ApiFailure } from "../errors.ts";
import { describeCommand } from "../domain/attribution.ts";
import type { OutputKey } from "../domain/hw-events.ts";
import type { StateStore } from "../domain/state-store.ts";
import type { HwClient, HwTimeouts } from "../hw/client.ts";
import type { IrCodeLookup } from "./ir-codes.ts";
import { type CommandPlan, planCommand, requiredAccess } from "./policies.ts";

// ARCHITECTURE §6.5: CommandRequest → policies → Command (pending) → hw → sent | failed →
// read-back (confirmed) | IR ack (assumed) | deadline (timed_out). Last write wins per output.

export interface Issuer {
  public_id: string;
  label: ClientLabel;
  access: AccessLevel;
}

/** 403 (access), 409 (precondition) or 503 (hw down): no Command is created. */
export class CommandRejected extends ApiFailure {
  constructor(status: 403 | 409 | 503, code: ApiErrorCode, message: string) {
    super(status, code, message);
    this.name = "CommandRejected";
  }
}

interface Inflight {
  command: Command;
  plan: CommandPlan;
  issuer: Issuer;
  done: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

/** A command that a hw report just proved (returned by claim, finished by confirm). */
export interface Claim {
  readonly inflight: Inflight;
  readonly by: ClientLabel;
}

export interface Dispatcher {
  /** Validates and starts a command; throws CommandRejected. Returns the `pending` Command (202). */
  dispatch(request: CommandRequest, issuer: Issuer): Command;
  /** Called by ingest inside a store update: the in-flight command this report proves, if any. */
  claim(key: OutputKey, state: RoomState): Claim | null;
  /** Broadcasts a claimed command as `confirmed` (+ activity). Call after the state broadcast. */
  confirm(claim: Claim): void;
  /** In-flight commands (tests). */
  inflightCount(): number;
  close(): void;
}

const RANK: Record<AccessLevel, number> = { view: 0, control: 1, technician: 2 };

export function createDispatcher(deps: {
  store: StateStore;
  hw: HwClient;
  ir: IrCodeLookup;
  timeouts: HwTimeouts;
  clock: Clock;
  emit: (event: ServerEvent) => void;
  log: EventLogger;
  newId?: () => string;
}): Dispatcher {
  const newId = deps.newId ?? randomUUID;
  const inflight = new Map<OutputKey, Inflight>();
  const quiet = (command: Command): boolean => command.body.kind === "audio.level" && !command.body.final;

  function finish(entry: Inflight, status: CommandStatus, error: string | null, announce: boolean): void {
    if (entry.done) return;
    entry.done = true;
    if (entry.timer !== null) clearTimeout(entry.timer);
    if (inflight.get(entry.plan.key) === entry) inflight.delete(entry.plan.key);
    entry.command = { ...entry.command, status, error };
    deps.emit({ type: "command", command: entry.command });
    if (quiet(entry.command)) return; // slider drags: no log, no toast (§6.5)
    deps.log({
      type: "command", actor: entry.issuer.label, public_id: entry.issuer.public_id, subject: entry.command.body.kind,
      payload: entry.command.body, result: status,
    });
    if (announce && (status === "confirmed" || status === "assumed")) {
      deps.emit({ type: "activity", text: describeCommand(entry.command.body), by: entry.issuer.label, public_id: entry.issuer.public_id });
    }
  }

  async function run(entry: Inflight): Promise<void> {
    const { plan } = entry;
    for (const call of plan.calls) {
      const ack = await call(deps.hw);
      if (!ack.ok) {
        if (plan.revert !== undefined) deps.store.update((model) => plan.revert?.(model) ?? model);
        finish(entry, ack.error.code === "timeout" ? "timed_out" : "failed", ack.error.code === "timeout" ? null : plan.failureText, false);
        return;
      }
    }
    if (entry.done) return; // already confirmed by an early report, or superseded
    entry.command = { ...entry.command, status: "sent" };
    deps.emit({ type: "command", command: entry.command });
    if (plan.ir) {
      if (plan.after !== undefined) deps.store.update((model, at) => plan.after?.(model, at, entry.issuer.label) ?? model);
      deps.store.flush();
      finish(entry, "assumed", null, true);
    }
  }

  return {
    dispatch(request, issuer) {
      const { body } = request;
      if (RANK[issuer.access] < RANK[requiredAccess(body)]) throw new CommandRejected(403, "forbidden", "Technician PIN required");
      const result = planCommand(body, deps.store.model(), deps.ir, deps.timeouts);
      if (!result.ok) throw new CommandRejected(result.status, result.code, result.message);
      const { plan } = result;

      const command: Command = {
        id: newId(), client_cmd_id: request.client_cmd_id, body,
        issued_by: { public_id: issuer.public_id, label: issuer.label },
        status: "pending", error: null, at: deps.clock.now().toISOString(),
      };
      const older = inflight.get(plan.key);
      if (older !== undefined) finish(older, "assumed", null, false); // last write wins (R12)
      const entry: Inflight = { command, plan, issuer, done: false, timer: null };
      entry.timer = setTimeout(() => finish(entry, "timed_out", null, false), plan.timeoutMs);
      inflight.set(plan.key, entry);
      deps.emit({ type: "command", command });
      if (plan.before !== undefined) deps.store.update((model, at) => plan.before?.(model, at) ?? model);
      void run(entry);
      return command;
    },
    claim(key, state) {
      const entry = inflight.get(key);
      if (entry === undefined || entry.done || entry.plan.confirmedBy?.(state) !== true) return null;
      inflight.delete(key);
      if (entry.timer !== null) clearTimeout(entry.timer);
      entry.timer = null;
      return { inflight: entry, by: entry.issuer.label };
    },
    confirm(claim) {
      finish(claim.inflight, "confirmed", null, true);
    },
    inflightCount: () => inflight.size,
    close() {
      for (const entry of inflight.values()) if (entry.timer !== null) clearTimeout(entry.timer);
      inflight.clear();
    },
  };
}
```
3. Create `apps/core-api/test/commands/setup.ts`:
```ts
import type { Command, CommandBody, HwEvent, ServerEvent } from "@eduscope/contracts";
import { fixedClock } from "../../src/clock.ts";
import { createDispatcher, type Issuer } from "../../src/commands/dispatcher.ts";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import { bootModel, fakeHw, RULES, snapshotEvent, T0 } from "../helpers.ts";

/** Short deadlines so timeout tests run on real timers. */
export const TEST_TIMEOUTS = { zigbeeMs: 60, irSendMs: 60, hdmiMs: 60, mixerMs: 60, screenMs: 60 };

export const PHONE: Issuer = { public_id: "pub-phone", label: "phone", access: "control" };
export const LAPTOP: Issuer = { public_id: "pub-laptop", label: "laptop", access: "control" };
export const TECH: Issuer = { public_id: "pub-tech", label: "laptop", access: "technician" };

/** Captured codes by "<device>.<role>" / "<device>.setpoint_<t>"; anything else is missing. */
export function irStub(codes: Record<string, string>): IrCodeLookup {
  return {
    find(deviceId, match) {
      const key = "role" in match ? `${deviceId}.${match.role}` : `${deviceId}.setpoint_${match.setpoint_c}`;
      const code = codes[key];
      return code === undefined ? { ok: false, message: `${key} has no captured IR code` } : { ok: true, code, transport: "ir_zs06" };
    },
  };
}

const ALL_CODES = {
  "projector.power_on": "ON", "projector.power_off": "OFF", "ac.power_off": "AC-OFF",
  ...Object.fromEntries([18, 20, 22, 24, 26, 28, 30].map((t) => [`ac.setpoint_${t}`, `AC-${t}`])),
};

/** A live room (fixture snapshot applied, hw up) with a dispatcher wired like app.ts. */
export function room(options: { codes?: Record<string, string> } = {}) {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const events: ServerEvent[] = [];
  const logs: LogEntry[] = [];
  const store = createStateStore({
    initial: applyHwEvent(bootModel({ acSetpoints: [18, 20, 22, 24, 26, 28, 30] }), snapshotEvent()),
    clock, rules: RULES, coalesceMs: 0,
  });
  store.subscribe((state) => events.push({ type: "state", state }));
  const emit = (event: ServerEvent): void => {
    events.push(event);
  };
  const log = (entry: LogEntry): void => {
    logs.push(entry);
  };
  const dispatcher = createDispatcher({ store, hw, ir: irStub(options.codes ?? ALL_CODES), timeouts: TEST_TIMEOUTS, clock, emit, log });
  let seq = 0;
  const send = (body: CommandBody, issuer: Issuer = PHONE): Command =>
    dispatcher.dispatch({ client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, body }, issuer);
  const statuses = (command: Command): string[] =>
    events.flatMap((e) => (e.type === "command" && e.command.id === command.id ? [e.command.status] : []));
  const activities = (): string[] => events.flatMap((e) => (e.type === "activity" ? [`${e.text} · ${e.by}`] : []));
  /** A hw report applied straight to the store (no attribution; T20's ingest does that). */
  const report = (event: HwEvent): void => {
    store.update((model) => applyHwEvent(model, event));
  };
  return { clock, hw, events, logs, store, dispatcher, send, statuses, activities, report };
}
```
4. Create `apps/core-api/test/commands/dispatcher.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { CommandRejected } from "../../src/commands/dispatcher.ts";
import { applyHwDown } from "../../src/domain/hw-events.ts";
import { hwEvent, T0 } from "../helpers.ts";
import { LAPTOP, PHONE, room } from "./setup.ts";

describe("dispatcher outcomes", () => {
  it("assumed: AC power on sends the 24° frame; values become assumed (R3)", async () => {
    const r = room();
    const command = r.send({ kind: "ac.power", on: true });
    expect(command).toMatchObject({ status: "pending", issued_by: { public_id: "pub-phone", label: "phone" }, at: T0 });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent", "assumed"]);
    expect(r.hw.calls).toEqual([{ method: "irSend", body: { transport: "ir_zs06", code_format: "tuya", code: "AC-24" } }]);
    const { ac } = r.store.get().environment;
    expect(ac.power).toMatchObject({ value: "on", confidence: "assumed", changed_by: "phone" });
    expect(ac.setpoint_c.value).toBe(24);
    expect(r.activities()).toEqual(["Air conditioning turned on · phone"]);
    expect(r.logs).toEqual([expect.objectContaining({ type: "command", actor: "phone", subject: "ac.power", result: "assumed" })]);
  });

  it("assumed: AC + steps to the next captured setpoint (R4)", async () => {
    const r = room();
    const on = r.send({ kind: "ac.power", on: true });
    await expect.poll(() => r.statuses(on).at(-1)).toBe("assumed");
    const step = r.send({ kind: "ac.step", direction: "up" });
    await expect.poll(() => r.statuses(step).at(-1)).toBe("assumed");
    expect(r.hw.calls.at(-1)?.body).toMatchObject({ code: "AC-26" }); // 25 never captured
    expect(r.store.get().environment.ac.setpoint_c.value).toBe(26);
  });

  it("assumed: projector power on waits for draw (H7b) and never confirms by IR (R2)", async () => {
    const r = room();
    r.report(hwEvent("projector_power.reading", { watts: 3, volts: 231, energy_kwh_total: 412.7 }));
    const command = r.send({ kind: "projector.power", on: true });
    expect(r.store.get().display.projector.feedback).toEqual({ last_ir: "power_on", sent_at: T0, phase: "waiting_for_draw" });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent", "assumed"]);
    expect(r.store.get().display.projector.state.value).toBe("standby");
    r.report(hwEvent("projector_power.reading", { watts: 24, volts: 231, energy_kwh_total: 412.7 }));
    expect(r.store.get().display.projector.state.value).toBe("warming_up");
    expect(r.store.get().display.projector.feedback.phase).toBe("idle");
  });

  it("failed: hw refuses → H6a text per transport; projector feedback is reverted", async () => {
    const r = room();
    r.hw.nextAcks.push({ ok: false, error: { code: "device_offline", message: "r101_lights is offline" } });
    const lights = r.send({ kind: "lights.set", gang: "front", on: false });
    await expect.poll(() => r.statuses(lights)).toEqual(["pending", "failed"]);
    expect(r.events.find((e) => e.type === "command" && e.command.status === "failed")).toMatchObject({ command: { error: "Switch didn't respond" } });

    r.report(hwEvent("projector_power.reading", { watts: 3, volts: 231, energy_kwh_total: 412.7 }));
    r.hw.nextAcks.push({ ok: false, error: { code: "transport", message: "hw-service unreachable" } });
    const projector = r.send({ kind: "projector.power", on: true });
    await expect.poll(() => r.statuses(projector).at(-1)).toBe("failed");
    expect(r.events.findLast((e) => e.type === "command")).toMatchObject({ command: { error: "Couldn't reach the blaster" } });
    expect(r.store.get().display.projector.feedback.phase).toBe("idle");
    expect(r.activities()).toEqual([]);
  });

  it("timed_out: no read-back within the transport timeout; a hw timeout ack too", async () => {
    const r = room();
    const silent = r.send({ kind: "lights.set", gang: "rear", on: true });
    await expect.poll(() => r.statuses(silent)).toEqual(["pending", "sent", "timed_out"]);
    r.hw.nextAcks.push({ ok: false, error: { code: "timeout", message: "no answer" } });
    const slow = r.send({ kind: "screen.move", to: "raise" });
    await expect.poll(() => r.statuses(slow)).toEqual(["pending", "timed_out"]);
    expect(r.dispatcher.inflightCount()).toBe(0);
  });

  it("hw down: 503 hw_unavailable, no command, no hw call (§6.7)", () => {
    const r = room();
    r.store.update((model, at) => applyHwDown(model, at));
    expect(() => r.send({ kind: "lights.set", gang: "rear", on: true })).toThrow(
      expect.objectContaining({ status: 503, code: "hw_unavailable", message: "Hardware service offline" }),
    );
    expect(r.hw.calls).toEqual([]);
    expect(r.events.filter((e) => e.type === "command")).toEqual([]);
  });

  it("last write wins: a newer command on the same output supersedes the older one quietly", () => {
    const r = room();
    const first = r.send({ kind: "lights.set", gang: "rear", on: true }, PHONE);
    const second = r.send({ kind: "lights.set", gang: "rear", on: false }, LAPTOP);
    expect(r.statuses(first)).toEqual(["pending", "assumed"]); // no longer awaited, no toast
    expect(r.statuses(second)).toEqual(["pending"]);
    expect(r.dispatcher.inflightCount()).toBe(1);
    expect(r.activities()).toEqual([]);
  });

  it("access: projector mains as control → 403 CommandRejected", () => {
    const r = room();
    expect(() => r.send({ kind: "projector.mains", on: true }, PHONE)).toThrow(CommandRejected);
    expect(() => r.send({ kind: "projector.mains", on: true }, PHONE)).toThrow(expect.objectContaining({ status: 403, code: "forbidden" }));
  });
});
```

**Test:** `apps/core-api/test/commands/dispatcher.test.ts` (above): assumed (AC on, AC +, projector), failed (both texts, projector feedback reverted), timed_out (no report; hw timeout ack), hw down, LWW, 403.

**Verify:** `pnpm --filter @eduscope/core-api test` → 139 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): command dispatcher"` (includes this plan file with the box ticked)

### T20 — hw ingest: correlation (confirmed) and "by hand" attribution
- [x] done

**Files:** `apps/core-api/src/hw/ingest.ts`, `apps/core-api/test/commands/setup.ts`, `apps/core-api/test/commands/correlation.test.ts`, `apps/core-api/test/hw/ingest.test.ts`

**Context:** ARCHITECTURE §6.3 `ingest.ts` (each HwEvent → one `store.update()` running the domain rules), §6.5 correlation (a report that proves an in-flight command confirms it; `changed_by` = issuer label), R6 / H13 (a light change with no command = "by hand" toast on every client), D12 (a resync snapshot is never "by hand"), §6.7 (`down()` marks the link down and schedules a re-derive at the 10 s grace), kWh baseline persisted once per day. The state broadcast is flushed before `confirmed`/`activity` so clients see the new value before their pending overlay clears (H5).

**Do:**
1. Create `apps/core-api/src/hw/ingest.ts`:
```ts
import type { ChangedBy, HwEvent, ServerEvent } from "@eduscope/contracts";
import type { Claim, Dispatcher } from "../commands/dispatcher.ts";
import type { EventLogger } from "../db/event-log.ts";
import { attributionFor } from "../domain/attribution.ts";
import { applyHwDown, applyHwEvent, reportedKeys, setChangedBy, valueChanged } from "../domain/hw-events.ts";
import type { KwhBaseline } from "../domain/model.ts";
import type { StateStore } from "../domain/state-store.ts";

// ARCHITECTURE §6.3: each HwEvent → one store update running the domain rules, then attribution
// (H13/R6): a report that proves an in-flight command confirms it; an uncommanded light change is "by hand".

export interface Ingest {
  handle(event: HwEvent): void;
  /** The stream dropped (§6.7). */
  down(): void;
}

const BY_HAND_TEXT: Record<string, (on: boolean) => string> = {
  "lights.front": (on) => `Front of room turned ${on ? "on" : "off"}`,
  "lights.rear": (on) => `Rear of room turned ${on ? "on" : "off"}`,
};

export function createIngest(deps: {
  store: StateStore;
  dispatcher: Dispatcher;
  emit: (event: ServerEvent) => void;
  log: EventLogger;
  persistBaseline: (baseline: KwhBaseline) => void;
  /** Called with the grace delay when the link drops, so the offline step lands on time. */
  scheduleTick: (delayMs: number) => void;
  hwDownGraceMs: number;
}): Ingest {
  const { store, dispatcher } = deps;

  return {
    handle(event) {
      if (event.type === "heartbeat") return;
      if (event.type === "hw.error") {
        deps.log({ type: "hw", subject: event.data.module, result: event.data.code, payload: event.data });
        return;
      }
      const wasDown = store.get().connection.hw === "down";
      const baselineBefore = store.model().facts.kwh_baseline;
      const claims: Claim[] = [];
      const byHand: { key: string; on: boolean }[] = [];

      store.update((model) => {
        const next = applyHwEvent(model, event);
        let state = next.state;
        for (const key of reportedKeys(event)) {
          const claim = dispatcher.claim(key, state);
          if (claim !== null) claims.push(claim);
          const changed = valueChanged(model.state, state, key);
          // A snapshot after a drop is a resync, not a wall-plate press: only a claim attributes it.
          const by: ChangedBy | null | undefined =
            event.type === "snapshot" ? (claim?.by ?? undefined) : attributionFor(key, changed, claim?.by ?? null);
          if (by !== undefined) state = setChangedBy(state, key, by);
          if (by === "by hand" && key in BY_HAND_TEXT) {
            const gang = key === "lights.front" ? "front" : "rear";
            byHand.push({ key, on: state.environment.lights[gang].value === true });
          }
        }
        return { ...next, state };
      });

      const baseline = store.model().facts.kwh_baseline;
      if (baseline !== null && JSON.stringify(baseline) !== JSON.stringify(baselineBefore)) deps.persistBaseline(baseline);
      if (event.type === "snapshot" && wasDown) deps.log({ type: "hw", subject: "link", result: "up" });

      if (claims.length === 0 && byHand.length === 0) return;
      store.flush(); // the new value reaches clients before the pending overlay clears
      for (const claim of claims) dispatcher.confirm(claim);
      for (const change of byHand) {
        const text = BY_HAND_TEXT[change.key]?.(change.on);
        if (text === undefined) continue;
        deps.emit({ type: "activity", text, by: "by hand", public_id: null });
        deps.log({ type: "state", actor: "by hand", subject: change.key, payload: { on: change.on } });
      }
    },
    down() {
      if (store.get().connection.hw === "up") {
        store.update((model, at) => applyHwDown(model, at));
        deps.log({ type: "hw", subject: "link", result: "down" });
      }
      deps.scheduleTick(deps.hwDownGraceMs);
    },
  };
}
```
2. Replace the whole file `apps/core-api/test/commands/setup.ts`:
```ts
import type { Command, CommandBody, HwEvent, ServerEvent } from "@eduscope/contracts";
import { fixedClock } from "../../src/clock.ts";
import { createDispatcher, type Issuer } from "../../src/commands/dispatcher.ts";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import type { KwhBaseline } from "../../src/domain/model.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import { createIngest } from "../../src/hw/ingest.ts";
import { bootModel, fakeHw, RULES, snapshotEvent, T0 } from "../helpers.ts";

/** Short deadlines so timeout tests run on real timers. */
export const TEST_TIMEOUTS = { zigbeeMs: 60, irSendMs: 60, hdmiMs: 60, mixerMs: 60, screenMs: 60 };

export const PHONE: Issuer = { public_id: "pub-phone", label: "phone", access: "control" };
export const LAPTOP: Issuer = { public_id: "pub-laptop", label: "laptop", access: "control" };
export const TECH: Issuer = { public_id: "pub-tech", label: "laptop", access: "technician" };

/** Captured codes by "<device>.<role>" / "<device>.setpoint_<t>"; anything else is missing. */
export function irStub(codes: Record<string, string>): IrCodeLookup {
  return {
    find(deviceId, match) {
      const key = "role" in match ? `${deviceId}.${match.role}` : `${deviceId}.setpoint_${match.setpoint_c}`;
      const code = codes[key];
      return code === undefined ? { ok: false, message: `${key} has no captured IR code` } : { ok: true, code, transport: "ir_zs06" };
    },
  };
}

const ALL_CODES = {
  "projector.power_on": "ON", "projector.power_off": "OFF", "ac.power_off": "AC-OFF",
  ...Object.fromEntries([18, 20, 22, 24, 26, 28, 30].map((t) => [`ac.setpoint_${t}`, `AC-${t}`])),
};

/** A live room (fixture snapshot applied, hw up) with dispatcher + ingest wired like app.ts. */
export function room(options: { codes?: Record<string, string> } = {}) {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const events: ServerEvent[] = [];
  const logs: LogEntry[] = [];
  const baselines: KwhBaseline[] = [];
  const ticks: number[] = [];
  const store = createStateStore({
    initial: applyHwEvent(bootModel({ acSetpoints: [18, 20, 22, 24, 26, 28, 30] }), snapshotEvent()),
    clock, rules: RULES, coalesceMs: 0,
  });
  store.subscribe((state) => events.push({ type: "state", state }));
  const emit = (event: ServerEvent): void => {
    events.push(event);
  };
  const log = (entry: LogEntry): void => {
    logs.push(entry);
  };
  const dispatcher = createDispatcher({ store, hw, ir: irStub(options.codes ?? ALL_CODES), timeouts: TEST_TIMEOUTS, clock, emit, log });
  const ingest = createIngest({
    store, dispatcher, emit, log, hwDownGraceMs: 10_000,
    persistBaseline: (baseline) => baselines.push(baseline),
    scheduleTick: (ms) => ticks.push(ms),
  });
  let seq = 0;
  const send = (body: CommandBody, issuer: Issuer = PHONE): Command =>
    dispatcher.dispatch({ client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, body }, issuer);
  const statuses = (command: Command): string[] =>
    events.flatMap((e) => (e.type === "command" && e.command.id === command.id ? [e.command.status] : []));
  const activities = (): string[] => events.flatMap((e) => (e.type === "activity" ? [`${e.text} · ${e.by}`] : []));
  /** A hw report, through ingest (attribution, correlation). */
  const report = (event: HwEvent): void => ingest.handle(event);
  /** Makes the fake hw answer every command with the matching report, like the real fake service. */
  const echo = (toEvent: (method: string, body: unknown) => HwEvent | null): void => {
    hw.onCall = (method, body) => {
      const event = toEvent(method, body);
      if (event !== null) ingest.handle(event);
    };
  };
  return { clock, hw, events, logs, baselines, ticks, store, dispatcher, ingest, send, statuses, activities, report, echo };
}
```
3. Create `apps/core-api/test/commands/correlation.test.ts`:
```ts
import { HwAudioLevelRequest, HwLightsSetRequest } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { hwEvent } from "../helpers.ts";
import { LAPTOP, PHONE, room } from "./setup.ts";

const lightsEcho = (method: string, body: unknown) =>
  method === "lightsSet" ? hwEvent("lights.state", HwLightsSetRequest.parse(body)) : null;

describe("correlation: a hw report confirms the in-flight command (§6.5)", () => {
  it("confirmed: the switch reports the new state before the ack", async () => {
    const r = room();
    r.echo(lightsEcho);
    const command = r.send({ kind: "lights.set", gang: "rear", on: true });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "confirmed"]);
    expect(r.store.get().environment.lights.rear).toMatchObject({ value: true, confidence: "confirmed", changed_by: "phone" });
    expect(r.activities()).toEqual(["Rear of room turned on · phone"]);
    expect(r.logs.filter((l) => l.type === "command")).toEqual([
      expect.objectContaining({ actor: "phone", public_id: "pub-phone", subject: "lights.set", result: "confirmed" }),
    ]);
    // the state carrying the new value reaches clients before `confirmed` clears their overlay
    const stateIndex = r.events.findIndex((e) => e.type === "state" && e.state.environment.lights.rear.value === true);
    const confirmedIndex = r.events.findIndex((e) => e.type === "command" && e.command.status === "confirmed");
    expect(stateIndex).toBeLessThan(confirmedIndex);
  });

  it("confirmed: the report arrives after the ack (sent first)", async () => {
    const r = room();
    const command = r.send({ kind: "source.select", input: "smart_board" });
    await expect.poll(() => r.statuses(command)).toEqual(["pending", "sent"]);
    r.report(hwEvent("hdmi.state", { input: "smart_board" }));
    expect(r.statuses(command)).toEqual(["pending", "sent", "confirmed"]);
    expect(r.store.get().display.source).toMatchObject({ value: "smart_board", changed_by: "phone" });
  });

  it("last write wins: the newest command is the one the report confirms", async () => {
    const r = room();
    r.send({ kind: "lights.set", gang: "rear", on: true }, PHONE);
    const second = r.send({ kind: "lights.set", gang: "rear", on: false }, LAPTOP);
    r.report(hwEvent("lights.state", { gang: "rear", on: false }));
    await expect.poll(() => r.statuses(second).at(-1)).toBe("confirmed");
    expect(r.store.get().environment.lights.rear.changed_by).toBe("laptop");
    expect(r.activities()).toEqual(["Rear of room turned off · laptop"]);
  });

  it("slider drags (final:false) are not logged and raise no toast", async () => {
    const r = room();
    r.echo((method, body) => (method === "audioLevel" ? hwEvent("audio.state", { ...HwAudioLevelRequest.parse(body), muted: false }) : null));
    const drag = r.send({ kind: "audio.level", channel: "mic", level: 40, final: false });
    await expect.poll(() => r.statuses(drag).at(-1)).toBe("confirmed");
    expect(r.logs.filter((l) => l.type === "command")).toEqual([]);
    expect(r.activities()).toEqual([]);
  });

  it("R9: mute all needs both channels muted; unmute unmutes then restores the saved levels", async () => {
    const r = room();
    const mute = r.send({ kind: "audio.mute_all", muted: true });
    expect(r.store.get().audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    await expect.poll(() => r.statuses(mute).at(-1)).toBe("sent");
    r.report(hwEvent("audio.state", { channel: "mic", level: 62, muted: true }));
    expect(r.statuses(mute).at(-1)).toBe("sent"); // one channel is not "all"
    r.report(hwEvent("audio.state", { channel: "pc", level: 38, muted: true }));
    expect(r.statuses(mute).at(-1)).toBe("confirmed");
    r.hw.calls.length = 0;
    r.send({ kind: "audio.mute_all", muted: false });
    await expect.poll(() => r.hw.calls.length).toBe(4);
    expect(r.hw.calls.map((c) => [c.method, c.body])).toEqual([
      ["audioMute", { channel: "mic", muted: false }], ["audioMute", { channel: "pc", muted: false }],
      ["audioLevel", { channel: "mic", level: 62 }], ["audioLevel", { channel: "pc", level: 38 }],
    ]);
  });
});
```
4. Create `apps/core-api/test/hw/ingest.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { hwEvent, snapshotEvent } from "../helpers.ts";
import { room } from "../commands/setup.ts";

describe("ingest", () => {
  it("R6: a light change nobody commanded is 'by hand' on every client", () => {
    const r = room();
    r.report(hwEvent("lights.state", { gang: "rear", on: true }));
    expect(r.store.get().environment.lights.rear).toMatchObject({ value: true, confidence: "confirmed", changed_by: "by hand" });
    expect(r.events.filter((e) => e.type === "activity")).toEqual([{ type: "activity", text: "Rear of room turned on", by: "by hand", public_id: null }]);
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "state", actor: "by hand", subject: "lights.rear" }));
  });

  it("a report that repeats the current value changes nothing and says nothing", () => {
    const r = room();
    const rev = r.store.get().rev;
    r.report(hwEvent("lights.state", { gang: "front", on: true })); // already on in the snapshot
    expect(r.store.get().rev).toBe(rev);
    expect(r.events.filter((e) => e.type === "activity")).toEqual([]);
  });

  it("a resync snapshot that differs is not a wall-plate press", () => {
    const r = room();
    const snap = snapshotEvent();
    if (snap.type !== "snapshot") throw new Error("fixture");
    r.report({ ...snap, data: { ...snap.data, lights: { front: false, rear: true } } });
    expect(r.store.get().environment.lights.rear.value).toBe(true);
    expect(r.store.get().environment.lights.rear.changed_by).toBeNull();
    expect(r.events.filter((e) => e.type === "activity")).toEqual([]);
  });

  it("persists a new kWh baseline once, not on every reading", () => {
    const r = room(); // the snapshot already set today's baseline
    expect(r.baselines).toEqual([]);
    r.report(hwEvent("projector_power.reading", { watts: 287, volts: 231, energy_kwh_total: 413 }, "2026-10-06T00:00:05Z"));
    r.report(hwEvent("projector_power.reading", { watts: 287, volts: 231, energy_kwh_total: 413.1 }, "2026-10-06T00:01:05Z"));
    expect(r.baselines).toEqual([{ date: "2026-10-06", kwh_total: 413 }]);
  });

  it("down(): link down, logged, and a tick scheduled at the grace; up again on the next snapshot", () => {
    const r = room();
    r.ingest.down();
    expect(r.store.get().connection.hw).toBe("down");
    expect(r.ticks).toEqual([10_000]);
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "hw", subject: "link", result: "down" }));
    r.report(snapshotEvent());
    expect(r.store.get().connection.hw).toBe("up");
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "hw", subject: "link", result: "up" }));
  });

  it("hw.error is logged; heartbeat and ir.learn change nothing", () => {
    const r = room();
    const rev = r.store.get().rev;
    r.report(hwEvent("hw.error", { module: "ir", code: "transport", message: "serial port gone" }));
    r.report(hwEvent("heartbeat", {}));
    r.report(hwEvent("ir.learn", { status: "listening" }));
    expect(r.store.get().rev).toBe(rev);
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "hw", subject: "ir", result: "transport" }));
  });
});
```

**Test:** `test/commands/correlation.test.ts` (confirmed before/after the ack, LWW confirm, slider silent, R9 mute/unmute calls) and `test/hw/ingest.test.ts` (by hand, repeat report, resync snapshot, baseline, down/up, hw.error).

**Verify:** `pnpm --filter @eduscope/core-api test` → 150 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): hw ingest with correlation and by-hand attribution"` (includes this plan file with the box ticked)

### T21 — Session rules: idle expiry and the kiosk exemption
- [x] done

**Files:** `apps/core-api/src/domain/session-rules.ts`, `apps/core-api/test/auth/session-rules.test.ts`

**Context:** SPEC §2.3 / R14: control 2 h idle, technician 15 min, kiosk technician 2 min, kiosk never below control. ARCHITECTURE §5 / D-09: kiosk = `LOCALHOST_IS_KIOSK=true` AND the socket peer is `127.0.0.1`, `::1` or `::ffff:127.0.0.1` (never a header; `trustProxy: false`); a kiosk row is honoured only from loopback. The class-block end (§2.3) is M09.

**Do:**
1. Create `apps/core-api/src/domain/session-rules.ts`:
```ts
import type { AccessLevel, ClientType } from "@eduscope/contracts";

// SPEC §2.3 session ends (R14) and the kiosk exemption (ARCHITECTURE §5, D-09). Pure.
// The class-block end (§2.3) is added by the M09 scheduler.

export const CONTROL_IDLE_MS = 2 * 60 * 60_000;
export const TECHNICIAN_IDLE_MS = 15 * 60_000;
export const KIOSK_TECHNICIAN_IDLE_MS = 2 * 60_000;
/** Rows of browsers that never unlocked are dropped after this (they get a new row on return). */
export const VIEW_ROW_TTL_MS = 7 * 24 * 60 * 60_000;

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** The request comes from the kiosk: the flag is on AND the socket peer is loopback (never a header). */
export function isKioskRequest(remoteAddress: string | undefined, localhostIsKiosk: boolean): boolean {
  return localhostIsKiosk && remoteAddress !== undefined && LOOPBACK.has(remoteAddress);
}

/** What a client has with no PIN: the kiosk is always control (R14), a remote browser is view. */
export function baselineAccess(clientType: ClientType): AccessLevel {
  return clientType === "kiosk" ? "control" : "view";
}

/** When an unlocked session ends if nothing happens (null = never). */
export function expiresAt(access: AccessLevel, clientType: ClientType, lastActivity: Date): Date | null {
  if (access === "technician") {
    return new Date(lastActivity.getTime() + (clientType === "kiosk" ? KIOSK_TECHNICIAN_IDLE_MS : TECHNICIAN_IDLE_MS));
  }
  if (access === "control" && clientType === "remote") return new Date(lastActivity.getTime() + CONTROL_IDLE_MS);
  return null;
}

/** A stored row is honoured only by the same kind of client: a kiosk row only from the kiosk. */
export function rowMatches(rowClientType: ClientType, kioskRequest: boolean): boolean {
  return rowClientType === (kioskRequest ? "kiosk" : "remote");
}

export function hasAccess(have: AccessLevel, need: AccessLevel): boolean {
  const rank: Record<AccessLevel, number> = { view: 0, control: 1, technician: 2 };
  return rank[have] >= rank[need];
}
```
2. Create `apps/core-api/test/auth/session-rules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { baselineAccess, expiresAt, hasAccess, isKioskRequest, rowMatches } from "../../src/domain/session-rules.ts";
import { T0 } from "../helpers.ts";

describe("§5 kiosk exemption", () => {
  it.each([
    ["127.0.0.1", true, true],
    ["::1", true, true],
    ["::ffff:127.0.0.1", true, true],
    ["192.168.1.20", true, false],
    ["127.0.0.1", false, false], // flag off (dev: the Vite proxy makes everyone local)
    [undefined, true, false],
  ])("%s with LOCALHOST_IS_KIOSK=%s → kiosk %s", (address, flag, kiosk) => {
    expect(isKioskRequest(address, flag)).toBe(kiosk);
  });
  it("a kiosk row is only honoured from the kiosk, a remote row only from remote", () => {
    expect(rowMatches("kiosk", true)).toBe(true);
    expect(rowMatches("kiosk", false)).toBe(false);
    expect(rowMatches("remote", true)).toBe(false);
  });
  it("baseline: kiosk control, remote view (R14)", () => {
    expect(baselineAccess("kiosk")).toBe("control");
    expect(baselineAccess("remote")).toBe("view");
  });
});

describe("§2.3 session ends", () => {
  const last = new Date(T0);
  it.each([
    ["control", "remote", "2026-10-05T12:42:00.000Z"], // 2 h idle
    ["technician", "remote", "2026-10-05T10:57:00.000Z"], // 15 min
    ["technician", "kiosk", "2026-10-05T10:44:00.000Z"], // kiosk: 2 min
    ["control", "kiosk", null], // the kiosk never loses control
    ["view", "remote", null],
  ] as const)("%s %s expires at %s", (access, clientType, expected) => {
    expect(expiresAt(access, clientType, last)?.toISOString() ?? null).toBe(expected);
  });
  it("hasAccess ranks view < control < technician", () => {
    expect(hasAccess("technician", "control")).toBe(true);
    expect(hasAccess("control", "technician")).toBe(false);
    expect(hasAccess("view", "control")).toBe(false);
  });
});
```

**Test:** `apps/core-api/test/auth/session-rules.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 164 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): session expiry and kiosk rules"` (includes this plan file with the box ticked)

### T22 — PIN throttle (H17)
- [x] done

**Files:** `apps/core-api/src/auth/pin-throttle.ts`, `apps/core-api/test/auth/pin-throttle.test.ts`

**Context:** ARCHITECTURE §5 / D-08 (hand-written, in memory): per `(ip, level)` 5 wrong ⇒ locked 60 s, the answer carries `retry_after_s`; more than 20 failures/min across all IPs ⇒ PIN entry locked for everyone for 60 s. Like the mock, the 5th wrong PIN already answers `locked` (H17 "after 5 wrong attempts"; AC5's sixth is locked too).

**Do:**
1. Create `apps/core-api/src/auth/pin-throttle.ts`:
```ts
import type { PinError } from "@eduscope/contracts";
import type { Clock } from "../clock.ts";

// ARCHITECTURE §5 throttle (in memory, D-08): per (ip, level) 5 wrong ⇒ locked 60 s (H17);
// more than 20 failures in a minute across all IPs ⇒ PIN entry locked for everyone for 60 s.

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 60_000;
export const GLOBAL_MAX_FAILURES = 20;
export const GLOBAL_WINDOW_MS = 60_000;

export interface PinThrottle {
  /** A PinError `locked` while entry is blocked for this (ip, level), else null. */
  check(ip: string, level: string): PinError | null;
  /** Records a wrong PIN; the 5th in a row answers `locked`. */
  fail(ip: string, level: string): PinError;
  succeed(ip: string, level: string): void;
}

export function createPinThrottle(clock: Clock): PinThrottle {
  const failures = new Map<string, number>();
  const lockedUntil = new Map<string, number>();
  let recent: number[] = [];
  let globalLockedUntil = 0;
  const key = (ip: string, level: string): string => `${level}|${ip}`;
  const locked = (until: number, now: number): PinError => ({
    reason: "locked", retry_after_s: Math.max(1, Math.ceil((until - now) / 1000)), attempts_left: 0,
  });

  return {
    check(ip, level) {
      const now = clock.now().getTime();
      if (now < globalLockedUntil) return locked(globalLockedUntil, now);
      const until = lockedUntil.get(key(ip, level)) ?? 0;
      return now < until ? locked(until, now) : null;
    },
    fail(ip, level) {
      const now = clock.now().getTime();
      recent = [...recent.filter((at) => now - at < GLOBAL_WINDOW_MS), now];
      if (recent.length > GLOBAL_MAX_FAILURES) globalLockedUntil = now + LOCKOUT_MS;
      const k = key(ip, level);
      const count = (failures.get(k) ?? 0) + 1;
      if (count >= MAX_ATTEMPTS) {
        failures.delete(k);
        lockedUntil.set(k, now + LOCKOUT_MS);
        return locked(now + LOCKOUT_MS, now);
      }
      failures.set(k, count);
      if (now < globalLockedUntil) return locked(globalLockedUntil, now);
      return { reason: "wrong", retry_after_s: null, attempts_left: MAX_ATTEMPTS - count };
    },
    succeed(ip, level) {
      failures.delete(key(ip, level));
    },
  };
}
```
2. Create `apps/core-api/test/auth/pin-throttle.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createPinThrottle } from "../../src/auth/pin-throttle.ts";
import { fixedClock } from "../../src/clock.ts";
import { T0 } from "../helpers.ts";

describe("PIN throttle (H17)", () => {
  it("5 wrong in a row ⇒ locked 60 s; the countdown runs; then entry opens again", () => {
    const clock = fixedClock(T0);
    const throttle = createPinThrottle(clock);
    expect([1, 2, 3, 4].map(() => throttle.fail("10.0.0.5", "control"))).toEqual([4, 3, 2, 1].map((left) => ({ reason: "wrong", retry_after_s: null, attempts_left: left })));
    expect(throttle.fail("10.0.0.5", "control")).toEqual({ reason: "locked", retry_after_s: 60, attempts_left: 0 });
    clock.advance(2_000);
    expect(throttle.check("10.0.0.5", "control")).toEqual({ reason: "locked", retry_after_s: 58, attempts_left: 0 });
    expect(throttle.check("10.0.0.6", "control")).toBeNull(); // per IP
    expect(throttle.check("10.0.0.5", "technician")).toBeNull(); // per level
    clock.advance(58_000);
    expect(throttle.check("10.0.0.5", "control")).toBeNull();
  });
  it("a success resets the count", () => {
    const throttle = createPinThrottle(fixedClock(T0));
    for (let i = 0; i < 4; i += 1) throttle.fail("10.0.0.5", "control");
    throttle.succeed("10.0.0.5", "control");
    expect(throttle.fail("10.0.0.5", "control").attempts_left).toBe(4);
  });
  it("more than 20 failures a minute across IPs locks everyone for 60 s", () => {
    const clock = fixedClock(T0);
    const throttle = createPinThrottle(clock);
    for (let i = 0; i < 20; i += 1) throttle.fail(`10.0.1.${i}`, "control");
    expect(throttle.check("10.0.9.9", "control")).toBeNull();
    expect(throttle.fail("10.0.1.99", "control")).toMatchObject({ reason: "locked", retry_after_s: 60 });
    expect(throttle.check("10.0.9.9", "technician")).toMatchObject({ reason: "locked" });
    clock.advance(60_000);
    expect(throttle.check("10.0.9.9", "technician")).toBeNull();
  });
});
```

**Test:** `apps/core-api/test/auth/pin-throttle.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 167 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): PIN throttle"` (includes this plan file with the box ticked)

### T23 — Session service (rows, login, lock, expiry, sweep) + decision D-21
- [x] done

**Files:** `apps/core-api/src/auth/sessions.ts`, `apps/core-api/test/auth/sessions.test.ts`, `docs/decisions/D-21-session-rows.md`

**Context:** ARCHITECTURE §5 / D-07 (server-side rows, signed cookie = row id, `public_id` safe to broadcast; technician login upgrades the row; expiry checked on every request and by a 15 s sweep; expiry pushes `session`). D1/D2 = **D-21** (created here): every browser gets a row; Lock and expiry downgrade it in place (the ARCHITECTURE sentence "Lock deletes the row, clears the cookie" is superseded). Remote rows that never unlock are dropped after 7 days. `label` starts as "laptop" until `hello`/login names it (Q19).

**Do:**
1. Create `apps/core-api/src/auth/sessions.ts`:
```ts
import { randomBytes } from "node:crypto";
import {
  AccessLevel, ClientLabel, ClientSession, ClientType, type AccessLevel as Access, type ClientLabel as Label,
  type ClientType as Type,
} from "@eduscope/contracts";
import { and, eq, isNotNull, lt, lte, ne } from "drizzle-orm";
import type { Clock } from "../clock.ts";
import type { Db } from "../db/client.ts";
import type { EventLogger } from "../db/event-log.ts";
import { sessions } from "../db/schema.ts";
import { baselineAccess, expiresAt, hasAccess, rowMatches, VIEW_ROW_TTL_MS } from "../domain/session-rules.ts";

// ARCHITECTURE §5 sessions (D-07): a `sessions` row per browser, cookie = row id, `public_id` is
// what other clients may see. Expiry is checked on every request and by a 15 s sweep.

export type SessionRow = typeof sessions.$inferSelect;

/** Who is asking, after cookie, kiosk exemption and expiry are applied. */
export interface ResolvedClient {
  row: SessionRow | null;
  clientType: Type;
  access: Access;
  label: Label;
  ip: string;
}

export interface SessionService {
  resolve(cookieId: string | null, ip: string, kiosk: boolean): ResolvedClient;
  /** Gives the client a row (and a cookie to set) if it has none. */
  ensure(client: ResolvedClient): { client: ResolvedClient & { row: SessionRow }; newCookieId: string | null };
  login(client: ResolvedClient & { row: SessionRow }, level: "control" | "technician", label: Label): ClientSession;
  lock(client: ResolvedClient & { row: SessionRow }): ClientSession;
  /** An authorised mutation: resets the idle timer (§5 "Activity"). */
  touch(client: ResolvedClient): void;
  /** WS `hello`: a remote browser names its form factor (Q19). */
  setLabel(publicId: string, label: Label): void;
  /** Ends idle sessions (pushes `session`) and drops old view rows. */
  sweep(): void;
  toClientSession(client: ResolvedClient & { row: SessionRow }): ClientSession;
}

const DEFAULT_REMOTE_LABEL: Label = "laptop";

export function createSessionService(deps: {
  db: Db;
  clock: Clock;
  log: EventLogger;
  /** A session changed without the client asking (expiry, lock/login from another tab): push it. */
  onChange: (session: ClientSession) => void;
}): SessionService {
  const { db, clock } = deps;
  const nowIso = (): string => clock.now().toISOString();

  const toClientSession = (row: SessionRow): ClientSession =>
    ClientSession.parse({
      public_id: row.public_id, client_type: row.client_type, label: row.label, access: row.access,
      unlocked_at: row.unlocked_at, last_activity: row.last_activity, expires_at: row.expires_at,
    });

  const reload = (id: string): SessionRow => {
    const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (row === undefined) throw new Error("session row vanished");
    return row;
  };

  /** Drops an unlocked row back to its baseline (expiry, lock). */
  const downgrade = (row: SessionRow, reason: string): SessionRow => {
    const clientType = ClientType.parse(row.client_type);
    db.update(sessions)
      .set({ access: baselineAccess(clientType), unlocked_at: null, last_activity: null, expires_at: null })
      .where(eq(sessions.id, row.id))
      .run();
    deps.log({ type: "session", actor: row.label, public_id: row.public_id, subject: reason, result: baselineAccess(clientType) });
    return reload(row.id);
  };

  const fromRow = (row: SessionRow, ip: string): ResolvedClient => ({
    row, ip, clientType: ClientType.parse(row.client_type), access: AccessLevel.parse(row.access), label: ClientLabel.parse(row.label),
  });

  return {
    resolve(cookieId, ip, kiosk) {
      const clientType: Type = kiosk ? "kiosk" : "remote";
      let row = cookieId === null ? undefined : db.select().from(sessions).where(eq(sessions.id, cookieId)).get();
      if (row !== undefined && !rowMatches(ClientType.parse(row.client_type), kiosk)) row = undefined; // kiosk row off-loopback
      if (row !== undefined && row.expires_at !== null && Date.parse(row.expires_at) <= clock.now().getTime()) {
        row = downgrade(row, "expired");
        deps.onChange(toClientSession(row));
      }
      if (row !== undefined) return fromRow(row, ip);
      return { row: null, ip, clientType, access: baselineAccess(clientType), label: kiosk ? "room screen" : DEFAULT_REMOTE_LABEL };
    },
    ensure(client) {
      if (client.row !== null) return { client: { ...client, row: client.row }, newCookieId: null };
      const id = randomBytes(32).toString("base64url");
      db.insert(sessions)
        .values({
          id, public_id: randomBytes(9).toString("base64url"), access: client.access, client_type: client.clientType,
          label: client.label, ip: client.ip, created_at: nowIso(), unlocked_at: null, last_activity: null, expires_at: null,
        })
        .run();
      const row = reload(id);
      return { client: { ...fromRow(row, client.ip), row }, newCookieId: id };
    },
    login(client, level, label) {
      const now = clock.now();
      const access: Access = hasAccess(client.access, level) ? client.access : level;
      const expires = expiresAt(access, client.clientType, now);
      db.update(sessions)
        .set({
          access, label: client.clientType === "kiosk" ? "room screen" : label, ip: client.ip,
          unlocked_at: now.toISOString(), last_activity: now.toISOString(), expires_at: expires === null ? null : expires.toISOString(),
        })
        .where(eq(sessions.id, client.row.id))
        .run();
      const session = toClientSession(reload(client.row.id));
      deps.log({ type: "session", actor: session.label, public_id: session.public_id, subject: "login", result: access });
      deps.onChange(session);
      return session;
    },
    lock(client) {
      const session = toClientSession(downgrade(client.row, "lock"));
      deps.onChange(session);
      return session;
    },
    touch(client) {
      if (client.row === null || client.access === baselineAccess(client.clientType)) return;
      const now = clock.now();
      const expires = expiresAt(client.access, client.clientType, now);
      db.update(sessions)
        .set({ last_activity: now.toISOString(), expires_at: expires === null ? null : expires.toISOString() })
        .where(eq(sessions.id, client.row.id))
        .run();
    },
    setLabel(publicId, label) {
      db.update(sessions).set({ label }).where(and(eq(sessions.public_id, publicId), eq(sessions.client_type, "remote"))).run();
    },
    sweep() {
      const now = nowIso();
      const expired = db
        .select()
        .from(sessions)
        .where(and(isNotNull(sessions.expires_at), lte(sessions.expires_at, now), ne(sessions.access, "view")))
        .all();
      for (const row of expired) deps.onChange(toClientSession(downgrade(row, "expired")));
      const cutoff = new Date(clock.now().getTime() - VIEW_ROW_TTL_MS).toISOString();
      db.delete(sessions).where(and(eq(sessions.access, "view"), lt(sessions.created_at, cutoff))).run();
    },
    toClientSession: (client) => toClientSession(client.row),
  };
}
```
2. Create `apps/core-api/test/auth/sessions.test.ts`:
```ts
import type { ClientSession } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { createSessionService } from "../../src/auth/sessions.ts";
import { fixedClock } from "../../src/clock.ts";
import { openDb } from "../../src/db/client.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { sessions as sessionsTable } from "../../src/db/schema.ts";
import { T0 } from "../helpers.ts";

function service() {
  const { db } = openDb(":memory:");
  const clock = fixedClock(T0);
  const pushed: ClientSession[] = [];
  const logs: LogEntry[] = [];
  const sessions = createSessionService({ db, clock, log: (entry) => logs.push(entry), onChange: (s) => pushed.push(s) });
  return { db, clock, pushed, logs, sessions };
}

const PHONE_IP = "192.168.1.50";

describe("session service", () => {
  it("no cookie: remote → view, kiosk → control (no row yet)", () => {
    const { sessions } = service();
    expect(sessions.resolve(null, PHONE_IP, false)).toEqual({ row: null, ip: PHONE_IP, clientType: "remote", access: "view", label: "laptop" });
    expect(sessions.resolve(null, "127.0.0.1", true)).toMatchObject({ row: null, clientType: "kiosk", access: "control", label: "room screen" });
  });

  it("ensure creates one row and a cookie id; the cookie resolves back to it", () => {
    const { sessions, db } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    expect(newCookieId).toMatch(/^[\w-]{43}$/);
    expect(client.row.public_id).not.toBe(newCookieId);
    expect(sessions.ensure(client).newCookieId).toBeNull();
    expect(sessions.resolve(newCookieId, PHONE_IP, false).row?.id).toBe(newCookieId);
    expect(db.select().from(sessionsTable).all()).toHaveLength(1);
  });

  it("login sets access, label, unlock time and the idle expiry, and pushes it", () => {
    const { sessions, pushed, logs } = service();
    const { client } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    const session = sessions.login(client, "control", "phone");
    expect(session).toMatchObject({ client_type: "remote", label: "phone", access: "control", unlocked_at: T0, last_activity: T0, expires_at: "2026-10-05T12:42:00.000Z" });
    expect(pushed).toEqual([session]);
    expect(logs).toEqual([expect.objectContaining({ type: "session", subject: "login", result: "control" })]);
  });

  it("a room PIN never lowers a technician session; the kiosk keeps its label", () => {
    const { sessions } = service();
    const remote = sessions.ensure(sessions.resolve(null, PHONE_IP, false)).client;
    sessions.login(remote, "technician", "laptop");
    const again = sessions.resolve(remote.row.id, PHONE_IP, false);
    expect(sessions.login({ ...again, row: remote.row }, "control", "laptop").access).toBe("technician");
    const kiosk = sessions.ensure(sessions.resolve(null, "127.0.0.1", true)).client;
    expect(sessions.login(kiosk, "technician", "phone")).toMatchObject({ label: "room screen", expires_at: "2026-10-05T10:44:00.000Z" });
  });

  it("an expired session is downgraded on the next request and pushed", () => {
    const { sessions, clock, pushed } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    sessions.login(client, "technician", "laptop");
    clock.advance(15 * 60_000);
    expect(sessions.resolve(newCookieId, PHONE_IP, false)).toMatchObject({ access: "view" });
    expect(pushed.at(-1)).toMatchObject({ access: "view", expires_at: null });
  });

  it("touch resets the idle timer; lock drops to the baseline", () => {
    const { sessions, clock } = service();
    const { client, newCookieId } = sessions.ensure(sessions.resolve(null, PHONE_IP, false));
    sessions.login(client, "control", "phone");
    clock.advance(60 * 60_000);
    sessions.touch(sessions.resolve(newCookieId, PHONE_IP, false));
    clock.advance(90 * 60_000);
    const live = sessions.resolve(newCookieId, PHONE_IP, false);
    expect(live.access).toBe("control");
    expect(live.row?.expires_at).toBe("2026-10-05T13:42:00.000Z");
  });

  it("a kiosk row is ignored from a LAN address (and a remote row from the kiosk)", () => {
    const { sessions } = service();
    const { newCookieId } = sessions.ensure(sessions.resolve(null, "127.0.0.1", true));
    expect(sessions.resolve(newCookieId, PHONE_IP, false)).toMatchObject({ row: null, clientType: "remote", access: "view" });
  });

  it("hello labels only remote rows; the sweep ends idle sessions and drops week-old view rows", () => {
    const { sessions, clock, pushed, db } = service();
    const viewer = sessions.ensure(sessions.resolve(null, "192.168.1.60", false)).client;
    sessions.setLabel(viewer.row.public_id, "tablet");
    const unlocked = sessions.ensure(sessions.resolve(null, PHONE_IP, false)).client;
    sessions.login(unlocked, "control", "phone");
    clock.advance(2 * 60 * 60_000);
    sessions.sweep();
    expect(pushed.at(-1)).toMatchObject({ public_id: unlocked.row.public_id, access: "view" });
    expect(sessions.resolve(viewer.row.id, "192.168.1.60", false).label).toBe("tablet");
    clock.advance(7 * 24 * 60 * 60_000);
    sessions.sweep();
    expect(db.select().from(sessionsTable).all()).toHaveLength(0);
  });
});
```
3. Create `docs/decisions/D-21-session-rows.md`:
```markdown
# D-21 — Every browser has a session row; Lock and expiry downgrade it in place

Date: 2026-10-14 · Milestone: M08 · Supersedes: ARCHITECTURE §5, the sentence "**Lock:** `POST /api/session/lock`
deletes the row (kiosk: drops back to `control`), clears the cookie, pushes `session` to that session's sockets."

## Context

`ClientSession.public_id` is required on every `GET /api/session` answer, and the kiosk ignores `activity` toasts
whose `public_id` is its own (H13). A browser that never unlocked still needs a stable `public_id`, and a browser
that locks must keep the same one, or it would toast its own commands after re-unlocking. The WS hub can push
`session` events (H24 expiry, Lock from another tab) only to sockets whose upgrade carried a session cookie.

## Decision

1. `GET /api/session` (and login, lock, commands) gives a browser without a valid cookie a `sessions` row at its
   baseline (remote `view`, kiosk `control`) and sets the signed `ec_sid` cookie (`HttpOnly; SameSite=Strict;
   Path=/`). Remote rows that stay `view` are deleted by the 15 s sweep 7 days after creation.
2. Lock and expiry **downgrade the row in place** (remote → `view`, kiosk → `control`; `unlocked_at`,
   `last_activity`, `expires_at` cleared). The row, cookie and `public_id` stay. The change is pushed as `session`.
3. The kiosk http adapter requests `GET /api/session` before it opens the WebSocket, so the upgrade carries the
   cookie and the hub can address that socket.

## Consequences

- One code path for "a session ended" (lock, idle expiry, M09 class-block end): downgrade + push.
- `sessions` also holds view-only browsers; S3b's client list (M09) comes from the WS hub, not from this table.
- A cookie is set for every visitor, including view-only ones. It carries no access by itself: access lives in the
  row and is re-checked on every request.
```

**Test:** `apps/core-api/test/auth/sessions.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 175 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): session service"` (includes this plan file with the box ticked)

### T24 — `buildApp()` with errors, `GET /api/state`, `GET /api/health` and the SPA
- [x] done

**Files:** `apps/core-api/src/plugins/errors.ts`, `apps/core-api/src/plugins/static.ts`, `apps/core-api/src/routes/state.ts`, `apps/core-api/src/routes/health.ts`, `apps/core-api/src/app.ts`, `apps/core-api/test/routes/app-helpers.ts`, `apps/core-api/test/routes/read.test.ts`, `apps/core-api/test/routes/static.test.ts`

**Context:** ARCHITECTURE §6.1: `buildApp(deps)` used by main and tests; `deps = {db, hw, clock, config}`; tests use `:memory:`, a fake hw client, a fixed clock and `fastify.inject` (no ports). §4.3: core-api serves `index.html` for any non-`/api`, non-`/ws` GET (AC8 deep links). Every 4xx is an `ApiError`. `trustProxy: false` (milestone note). `app.ts` is rewritten whole in T25–T28 as plugins arrive; this first version has no sessions yet (state and health are `view`).

**Do:**
1. Create `apps/core-api/src/plugins/errors.ts`:
```ts
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
```
2. Create `apps/core-api/src/plugins/static.ts`:
```ts
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
```
3. Create `apps/core-api/src/routes/state.ts`:
```ts
import type { FastifyInstance } from "fastify";
import type { StateStore } from "../domain/state-store.ts";

/** GET /api/state → RoomState (view level; the UI itself takes state from the WS snapshot). */
export async function stateRoutes(app: FastifyInstance, options: { store: StateStore }) {
  app.get("/state", async () => options.store.get());
}
```
4. Create `apps/core-api/src/routes/health.ts`:
```ts
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
```
5. Create `apps/core-api/src/app.ts`:
```ts
import { DeviceKind, Transport } from "@eduscope/contracts";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Clock } from "./clock.ts";
import { createDispatcher, type Dispatcher } from "./commands/dispatcher.ts";
import { capturedSetpoints, createIrCodeLookup } from "./commands/ir-codes.ts";
import type { Config } from "./config.ts";
import { openDb, type Db } from "./db/client.ts";
import { createEventLogger } from "./db/event-log.ts";
import { devices } from "./db/schema.ts";
import { seed } from "./db/seed.ts";
import { readSetting, writeSetting } from "./db/settings.ts";
import { initialModel } from "./domain/initial.ts";
import type { DeviceInfo, KwhBaseline } from "./domain/model.ts";
import { createStateStore, type StateStore } from "./domain/state-store.ts";
import type { HwClient, HwTimeouts } from "./hw/client.ts";
import { createIngest, type Ingest } from "./hw/ingest.ts";
import { errorsPlugin } from "./plugins/errors.ts";
import { staticPlugin } from "./plugins/static.ts";
import { healthRoutes } from "./routes/health.ts";
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
}

/** What tests and main.ts reach into. */
export interface Room {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  ingest: Ingest;
}

declare module "fastify" {
  interface FastifyInstance {
    room: Room;
  }
}

/** §6.4 "a 10 s timer re-evaluates staleness" (also H7b and the hw grace). */
export const TICK_MS = 10_000;

export function hwTimeouts(config: Config): HwTimeouts {
  return {
    zigbeeMs: config.TIMEOUT_ZIGBEE_MS,
    irSendMs: config.TIMEOUT_IR_SEND_MS,
    hdmiMs: config.TIMEOUT_HDMI_MS,
    mixerMs: config.TIMEOUT_MIXER_MS,
    screenMs: config.TIMEOUT_SCREEN_MS,
  };
}

const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });

function loadRegistry(db: Db): DeviceInfo[] {
  return db
    .select()
    .from(devices)
    .orderBy(devices.sort)
    .all()
    .map((row) => ({
      id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
      brand: row.brand, model: row.model, hw_ref: row.hw_ref,
    }));
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, clock } = deps;
  const { db, close: closeDb } = openDb(deps.db);
  await seed(db, config, clock.now().toISOString());

  const log = createEventLogger(db, clock);
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
    store, hw: deps.hw, ir: createIrCodeLookup(db), timeouts: hwTimeouts(config), clock, emit: () => undefined, log,
  });
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const ingest = createIngest({
    store, dispatcher, log,
    emit: () => undefined,
    persistBaseline: (baseline: KwhBaseline) => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString()),
    scheduleTick: (delayMs) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        store.tick();
      }, delayMs);
      timers.add(timer);
    },
    hwDownGraceMs: config.HW_DOWN_GRACE_MS,
  });

  const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("room", { db, store, dispatcher, ingest });

  await app.register(errorsPlugin);
  await app.register(
    async (api) => {
      await api.register(stateRoutes, { store });
      await api.register(healthRoutes, { store });
    },
    { prefix: "/api" },
  );
  await app.register(staticPlugin, { kioskDist: config.KIOSK_DIST });

  app.addHook("onReady", async () => {
    timers.add(setInterval(() => store.tick(), TICK_MS));
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
```
6. Create `apps/core-api/test/routes/app-helpers.ts`:
```ts
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp } from "../../src/app.ts";
import { fixedClock, type FixedClock } from "../../src/clock.ts";
import type { Config } from "../../src/config.ts";
import { fakeHw, snapshotEvent, T0, testConfig, type FakeHw } from "../helpers.ts";

export const HOST = "r-101.local";
export const ORIGIN = `http://${HOST}`;
/** A phone on the room Wi-Fi (not loopback). */
export const PHONE_IP = "192.168.1.50";

export interface TestApp {
  app: FastifyInstance;
  clock: FixedClock;
  hw: FakeHw;
}

/** buildApp with `:memory:`, a fake hw client, a fixed clock; hw reported up (fixture snapshot) unless `hwUp: false`. */
export async function startApp(overrides: Partial<Record<keyof Config, string>> = {}, options: { hwUp?: boolean } = {}): Promise<TestApp> {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const app = await buildApp({ db: ":memory:", hw, clock, config: testConfig(overrides) });
  await app.ready();
  if (options.hwUp !== false) app.room.ingest.handle(snapshotEvent());
  return { app, clock, hw };
}

export interface Call {
  cookie?: string | null;
  payload?: unknown;
  origin?: string | null;
  contentType?: string;
  remoteAddress?: string;
}

export function call(app: FastifyInstance, method: "GET" | "POST", url: string, options: Call = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { host: HOST };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  if (method === "POST") headers["content-type"] = options.contentType ?? "application/json";
  return app.inject({
    method, url, headers, remoteAddress: options.remoteAddress ?? PHONE_IP,
    ...(method === "POST" ? { payload: JSON.stringify(options.payload ?? {}) } : {}),
  });
}

/** The signed `ec_sid` value a response set, if any. */
export function cookieOf(response: LightMyRequestResponse): string | null {
  return response.cookies.find((c) => c.name === "ec_sid")?.value ?? null;
}

/** A browser session at the given level (control: room PIN, technician: technician PIN). */
export async function sessionAt(app: FastifyInstance, level: "view" | "control" | "technician", remoteAddress = PHONE_IP): Promise<string> {
  const cookie = cookieOf(await call(app, "GET", "/api/session", { remoteAddress }));
  if (cookie === null) throw new Error("no cookie");
  if (level === "view") return cookie;
  const pin = level === "control" ? "1234" : "123456";
  const response = await call(app, "POST", "/api/session/login", { cookie, remoteAddress, payload: { level, pin, label: "phone" } });
  if (response.statusCode !== 200) throw new Error(`login failed: ${response.body}`);
  return cookie;
}

let seq = 0;
export const commandBody = (body: unknown): { client_cmd_id: string; body: unknown } => ({
  client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  body,
});
```
7. Create `apps/core-api/test/routes/read.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, startApp } from "./app-helpers.ts";

describe("read routes", () => {
  it("GET /api/state and /api/health need no session", async () => {
    const { app } = await startApp();
    const state = await call(app, "GET", "/api/state");
    expect(state.statusCode).toBe(200);
    expect(state.json()).toMatchObject({ room: { id: "R-101", status: { level: "normal" } }, connection: { hw: "up" } });
    expect((await call(app, "GET", "/api/health")).json()).toEqual({ ok: true, hw: "up", rev: state.json().rev });
    await app.close();
  });

  it("before hw reports, health says hw down and the room is in fault", async () => {
    const { app } = await startApp({}, { hwUp: false });
    expect((await call(app, "GET", "/api/health")).json()).toEqual({ ok: true, hw: "down", rev: 0 });
    expect((await call(app, "GET", "/api/state")).json()).toMatchObject({ room: { status: { level: "fault", text: "Hardware service offline" } } });
    await app.close();
  });

  it("an unknown /api path is a 404 ApiError", async () => {
    const { app } = await startApp();
    const response = await call(app, "GET", "/api/nope");
    expect([response.statusCode, response.json()]).toEqual([404, { code: "not_found", message: "Not found" }]);
    await app.close();
  });
});
```
8. Create `apps/core-api/test/routes/static.test.ts`:
```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOST, startApp } from "./app-helpers.ts";

describe("static SPA (§6.1)", () => {
  it("serves files, falls back to index.html for deep links, keeps /api 404 as JSON", async () => {
    const dist = mkdtempSync(join(tmpdir(), "kiosk-dist-"));
    writeFileSync(join(dist, "index.html"), "<!doctype html><title>Eduscope</title>");
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "assets", "app.js"), "console.log(1)");
    const { app } = await startApp({ KIOSK_DIST: dist });
    const deep = await app.inject({ url: "/devices", headers: { host: HOST } });
    expect([deep.statusCode, deep.headers["content-type"], deep.body]).toEqual([200, "text/html; charset=utf-8", "<!doctype html><title>Eduscope</title>"]);
    expect((await app.inject({ url: "/", headers: { host: HOST } })).body).toContain("Eduscope");
    const js = await app.inject({ url: "/assets/app.js", headers: { host: HOST } });
    expect(js.headers["content-type"]).toContain("javascript");
    const api = await app.inject({ url: "/api/nope", headers: { host: HOST } });
    expect([api.statusCode, api.json()]).toEqual([404, { code: "not_found", message: "Not found" }]);
    await app.close();
  });

  it("without KIOSK_DIST (dev: Vite serves the SPA) every unknown path is a 404 ApiError", async () => {
    const { app } = await startApp();
    expect((await app.inject({ url: "/devices", headers: { host: HOST } })).statusCode).toBe(404);
    await app.close();
  });
});
```

**Test:** `test/routes/read.test.ts`, `test/routes/static.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 180 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): buildApp with state, health and the SPA"` (includes this plan file with the box ticked)

### T25 — Access guard + session routes (GET/login/lock)
- [x] done

**Files:** `apps/core-api/src/plugins/auth.ts`, `apps/core-api/src/routes/session.ts`, `apps/core-api/src/app.ts`, `apps/core-api/test/routes/session.test.ts`

**Context:** ARCHITECTURE §5: `plugins/auth.ts` decorates `request.client`, enforces `config.access` (401 `unauthorized` "Enter the room PIN" for view, 403 `forbidden` "Technician PIN required"), and an `onRoute` hook **throws at startup** for a non-GET route without `config.access` (public exceptions: login, lock — declared `config.public`). Cookie `ec_sid` signed with `COOKIE_SECRET`, `HttpOnly; SameSite=Strict; Path=/`, no `Secure` (D-12). `request.ip` is the socket peer because `trustProxy` is false (D20; it also works for `injectWS`). Login: throttle (T22) → scrypt verify → 200 ClientSession | 401 PinError `wrong` | 429 PinError `locked` (the kiosk http adapter accepts a PinError with any status). Login and lock are the only public mutations (§5), so they have no 401 test; they are protected by the origin check (T26) and the throttle. Sessions are not pushed over WS until T28.

**Do:**
1. Create `apps/core-api/src/plugins/auth.ts`:
```ts
import type { AccessLevel, ApiError } from "@eduscope/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import "@fastify/cookie"; // request.cookies / reply.setCookie typings
import type { ResolvedClient, SessionRow, SessionService } from "../auth/sessions.ts";
import { hasAccess, isKioskRequest } from "../domain/session-rules.ts";

// ARCHITECTURE §5 guard. Resolves `request.client` from the signed `ec_sid` cookie and the socket
// address (never a header, trustProxy is false), enforces `config.access`, and refuses to start
// when a mutating route forgets to declare it.

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
});
```
2. Create `apps/core-api/src/routes/session.ts`:
```ts
import { LoginRequest } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { verifyPin } from "../auth/pin-hash.ts";
import type { PinThrottle } from "../auth/pin-throttle.ts";
import type { SessionService } from "../auth/sessions.ts";
import type { Db } from "../db/client.ts";
import type { EventLogger } from "../db/event-log.ts";
import { readSetting } from "../db/settings.ts";
import { ensureSession } from "../plugins/auth.ts";

// ARCHITECTURE §3.3 api/session.ts: GET /api/session, POST /api/session/login, POST /api/session/lock.
// login and lock are the two public mutations (§5); both still pass the origin check.

export async function sessionRoutes(app: FastifyInstance, options: { db: Db; sessions: SessionService; throttle: PinThrottle; log: EventLogger }) {
  const { db, sessions, throttle } = options;
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/session", async (request, reply) => sessions.toClientSession(ensureSession(sessions, request, reply)));

  api.post("/session/login", { config: { public: true }, schema: { body: LoginRequest } }, async (request, reply) => {
    const client = ensureSession(sessions, request, reply);
    const { level, pin, label } = request.body;
    const ip = request.client.ip;
    const blocked = throttle.check(ip, level);
    if (blocked !== null) return reply.status(429).send(blocked);
    const hash = readSetting(db, level === "control" ? "room_pin_hash" : "technician_pin_hash", z.string());
    if (hash === null || !(await verifyPin(pin, hash))) {
      const error = throttle.fail(ip, level);
      options.log({ type: "pin_failure", actor: client.label, public_id: client.row.public_id, subject: level, result: error.reason });
      return reply.status(error.reason === "locked" ? 429 : 401).send(error);
    }
    throttle.succeed(ip, level);
    return sessions.login(client, level, label);
  });

  api.post("/session/lock", { config: { public: true } }, async (request, reply) => sessions.lock(ensureSession(sessions, request, reply)));
}
```
3. Replace the whole file `apps/core-api/src/app.ts`:
```ts
import { DeviceKind, Transport } from "@eduscope/contracts";
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
import { createEventLogger } from "./db/event-log.ts";
import { devices } from "./db/schema.ts";
import { seed } from "./db/seed.ts";
import { readSetting, writeSetting } from "./db/settings.ts";
import { initialModel } from "./domain/initial.ts";
import type { DeviceInfo, KwhBaseline } from "./domain/model.ts";
import { createStateStore, type StateStore } from "./domain/state-store.ts";
import type { HwClient, HwTimeouts } from "./hw/client.ts";
import { createIngest, type Ingest } from "./hw/ingest.ts";
import { authPlugin } from "./plugins/auth.ts";
import { errorsPlugin } from "./plugins/errors.ts";
import { staticPlugin } from "./plugins/static.ts";
import { healthRoutes } from "./routes/health.ts";
import { sessionRoutes } from "./routes/session.ts";
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
}

/** What tests and main.ts reach into. */
export interface Room {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  ingest: Ingest;
  sessions: SessionService;
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
    hdmiMs: config.TIMEOUT_HDMI_MS,
    mixerMs: config.TIMEOUT_MIXER_MS,
    screenMs: config.TIMEOUT_SCREEN_MS,
  };
}

const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });

function loadRegistry(db: Db): DeviceInfo[] {
  return db
    .select()
    .from(devices)
    .orderBy(devices.sort)
    .all()
    .map((row) => ({
      id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
      brand: row.brand, model: row.model, hw_ref: row.hw_ref,
    }));
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, clock } = deps;
  const { db, close: closeDb } = openDb(deps.db);
  await seed(db, config, clock.now().toISOString());

  const log = createEventLogger(db, clock);
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
    store, hw: deps.hw, ir: createIrCodeLookup(db), timeouts: hwTimeouts(config), clock, emit: () => undefined, log,
  });
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const ingest = createIngest({
    store, dispatcher, log,
    emit: () => undefined,
    persistBaseline: (baseline: KwhBaseline) => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString()),
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
    onChange: () => undefined,
  });

  const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("room", { db, store, dispatcher, ingest, sessions });

  await app.register(errorsPlugin);
  await app.register(cookie, { secret: config.COOKIE_SECRET });
  await app.register(authPlugin, { sessions, localhostIsKiosk: config.LOCALHOST_IS_KIOSK });
  await app.register(
    async (api) => {
      await api.register(sessionRoutes, { db, sessions, throttle: createPinThrottle(clock), log });
      await api.register(stateRoutes, { store });
      await api.register(healthRoutes, { store });
    },
    { prefix: "/api" },
  );
  await app.register(staticPlugin, { kioskDist: config.KIOSK_DIST });

  app.addHook("onReady", async () => {
    timers.add(setInterval(() => store.tick(), TICK_MS));
    timers.add(setInterval(() => sessions.sweep(), SESSION_SWEEP_MS));
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
```
4. Create `apps/core-api/test/routes/session.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.ts";
import { fixedClock } from "../../src/clock.ts";
import { assertRouteAccess } from "../../src/plugins/auth.ts";
import { fakeHw, T0, testConfig } from "../helpers.ts";
import { call, cookieOf, PHONE_IP, sessionAt, startApp } from "./app-helpers.ts";

const ROOM_PIN = { level: "control", pin: "1234", label: "phone" };

describe("startup guard (§5)", () => {
  it("a mutating route without config.access is refused", () => {
    expect(() => assertRouteAccess({ method: "POST", url: "/api/x" })).toThrow("Route POST /api/x must declare config.access");
    expect(() => assertRouteAccess({ method: "DELETE", url: "/api/x", config: { access: "technician" } })).not.toThrow();
    expect(() => assertRouteAccess({ method: "POST", url: "/api/session/lock", config: { public: true } })).not.toThrow();
    expect(() => assertRouteAccess({ method: ["GET", "HEAD"], url: "/api/state" })).not.toThrow();
  });
  it("the app refuses such a route the moment it is added", async () => {
    const app = await buildApp({ db: ":memory:", hw: fakeHw(), clock: fixedClock(T0), config: testConfig() });
    expect(() => app.post("/api/naked", async () => ({}))).toThrow("Route POST /api/naked must declare config.access");
    expect(() => app.post("/api/guarded", { config: { access: "control" } }, async () => ({}))).not.toThrow();
    await app.close();
  });
});

describe("GET /api/session", () => {
  it("issues a view session and an HttpOnly, SameSite=Strict, signed cookie on the first visit", async () => {
    const { app } = await startApp();
    const first = await call(app, "GET", "/api/session");
    expect(first.json()).toMatchObject({ client_type: "remote", label: "laptop", access: "view", expires_at: null });
    const cookie = first.cookies.find((c) => c.name === "ec_sid");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/" });
    const again = await call(app, "GET", "/api/session", { cookie: cookie?.value ?? null });
    expect(again.json().public_id).toBe(first.json().public_id);
    expect(cookieOf(again)).toBeNull();
    await app.close();
  });
});

describe("PIN login, throttle, lock", () => {
  it("room PIN → control session with a 2 h expiry; lock → view in place", async () => {
    const { app } = await startApp();
    const first = await call(app, "POST", "/api/session/login", { payload: ROOM_PIN });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ client_type: "remote", label: "phone", access: "control", expires_at: "2026-10-05T12:42:00.000Z" });
    const cookie = cookieOf(first);
    const locked = await call(app, "POST", "/api/session/lock", { cookie });
    expect(locked.json()).toMatchObject({ access: "view", public_id: first.json().public_id, expires_at: null });
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "view" });
    await app.close();
  });

  it("H17: 5 wrong → locked 60 s (429); the right PIN is refused while locked", async () => {
    const { app, clock } = await startApp();
    const wrong = { level: "control", pin: "0000", label: "phone" };
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) codes.push((await call(app, "POST", "/api/session/login", { payload: wrong })).statusCode);
    expect(codes).toEqual([401, 401, 401, 401, 429, 429]);
    const right = await call(app, "POST", "/api/session/login", { payload: ROOM_PIN });
    expect([right.statusCode, right.json()]).toEqual([429, { reason: "locked", retry_after_s: 60, attempts_left: 0 }]);
    clock.advance(60_000);
    expect((await call(app, "POST", "/api/session/login", { payload: ROOM_PIN })).statusCode).toBe(200);
    await app.close();
  });

  it("a wrong PIN answers attempts_left; a PIN of the wrong length is a 400", async () => {
    const { app } = await startApp();
    const wrong = await call(app, "POST", "/api/session/login", { payload: { level: "technician", pin: "000000", label: "laptop" } });
    expect([wrong.statusCode, wrong.json()]).toEqual([401, { reason: "wrong", retry_after_s: null, attempts_left: 4 }]);
    const short = await call(app, "POST", "/api/session/login", { payload: { level: "control", pin: "12345", label: "phone" } });
    expect([short.statusCode, short.json().code]).toEqual([400, "validation"]);
    await app.close();
  });

  it("technician ends after 15 min idle; the 15 s sweep downgrades without a request", async () => {
    const { app, clock } = await startApp();
    const cookie = await sessionAt(app, "technician");
    clock.advance(15 * 60_000);
    app.room.sessions.sweep();
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "view" });
    await app.close();
  });
});

describe("kiosk exemption (D-09)", () => {
  it("LOCALHOST_IS_KIOSK=true: loopback is kiosk/control without a PIN; LAN is view", async () => {
    const { app } = await startApp({ LOCALHOST_IS_KIOSK: "true" });
    const kiosk = await call(app, "GET", "/api/session", { remoteAddress: "127.0.0.1" });
    expect(kiosk.json()).toMatchObject({ client_type: "kiosk", label: "room screen", access: "control", expires_at: null });
    expect((await call(app, "GET", "/api/session", { remoteAddress: PHONE_IP })).json()).toMatchObject({ client_type: "remote", access: "view" });
    await app.close();
  });

  it("LOCALHOST_IS_KIOSK=false: loopback is an ordinary remote view client", async () => {
    const { app } = await startApp({ LOCALHOST_IS_KIOSK: "false" });
    expect((await call(app, "GET", "/api/session", { remoteAddress: "127.0.0.1" })).json()).toMatchObject({ client_type: "remote", access: "view" });
    await app.close();
  });

  it("a kiosk session cookie is refused from a LAN address; kiosk technician lasts 2 min; kiosk lock keeps control", async () => {
    const { app, clock } = await startApp({ LOCALHOST_IS_KIOSK: "true" });
    const cookie = await sessionAt(app, "technician", "127.0.0.1");
    expect((await call(app, "GET", "/api/session", { cookie, remoteAddress: "127.0.0.1" })).json()).toMatchObject({ client_type: "kiosk", access: "technician" });
    expect((await call(app, "GET", "/api/session", { cookie, remoteAddress: PHONE_IP })).json()).toMatchObject({ client_type: "remote", access: "view" });
    clock.advance(2 * 60_000);
    expect((await call(app, "GET", "/api/session", { cookie, remoteAddress: "127.0.0.1" })).json()).toMatchObject({ access: "control" });
    const locked = await call(app, "POST", "/api/session/lock", { cookie, remoteAddress: "127.0.0.1" });
    expect(locked.json()).toMatchObject({ client_type: "kiosk", access: "control" });
    await app.close();
  });
});
```

**Test:** `apps/core-api/test/routes/session.test.ts` (above): startup failure on a route missing `access`; cookie attributes; login/lock; throttle 401×4 → 429; wrong length 400; technician expiry via the sweep; kiosk exemption on/off; a kiosk cookie from a LAN address is view; kiosk technician 2 min; kiosk lock keeps control.

**Verify:** `pnpm --filter @eduscope/core-api test` → 190 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): PIN sessions and the access guard"` (includes this plan file with the box ticked)

### T26 — Origin check (CSRF)
- [x] done

**Files:** `apps/core-api/src/plugins/origin-check.ts`, `apps/core-api/src/app.ts`, `apps/core-api/test/routes/origin.test.ts`

**Context:** ARCHITECTURE §5 CSRF / D-12: mutations require an `Origin` whose host (with port) equals `Host`, and `Content-Type: application/json` for bodies (POST/PUT/PATCH; M09's DELETEs send no body); the WS upgrade checks `Origin` the same way. Public routes (login, lock) are checked too. AC4: a foreign origin with a valid cookie → 403. Missing Origin → 403 (browsers always send it on POST/WS; curl must add it).

**Do:**
1. Create `apps/core-api/src/plugins/origin-check.ts`:
```ts
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
```
2. Replace the whole file `apps/core-api/src/app.ts`:
```ts
import { DeviceKind, Transport } from "@eduscope/contracts";
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
import { createEventLogger } from "./db/event-log.ts";
import { devices } from "./db/schema.ts";
import { seed } from "./db/seed.ts";
import { readSetting, writeSetting } from "./db/settings.ts";
import { initialModel } from "./domain/initial.ts";
import type { DeviceInfo, KwhBaseline } from "./domain/model.ts";
import { createStateStore, type StateStore } from "./domain/state-store.ts";
import type { HwClient, HwTimeouts } from "./hw/client.ts";
import { createIngest, type Ingest } from "./hw/ingest.ts";
import { authPlugin } from "./plugins/auth.ts";
import { errorsPlugin } from "./plugins/errors.ts";
import { originCheckPlugin } from "./plugins/origin-check.ts";
import { staticPlugin } from "./plugins/static.ts";
import { healthRoutes } from "./routes/health.ts";
import { sessionRoutes } from "./routes/session.ts";
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
}

/** What tests and main.ts reach into. */
export interface Room {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  ingest: Ingest;
  sessions: SessionService;
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
    hdmiMs: config.TIMEOUT_HDMI_MS,
    mixerMs: config.TIMEOUT_MIXER_MS,
    screenMs: config.TIMEOUT_SCREEN_MS,
  };
}

const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });

function loadRegistry(db: Db): DeviceInfo[] {
  return db
    .select()
    .from(devices)
    .orderBy(devices.sort)
    .all()
    .map((row) => ({
      id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
      brand: row.brand, model: row.model, hw_ref: row.hw_ref,
    }));
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, clock } = deps;
  const { db, close: closeDb } = openDb(deps.db);
  await seed(db, config, clock.now().toISOString());

  const log = createEventLogger(db, clock);
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
    store, hw: deps.hw, ir: createIrCodeLookup(db), timeouts: hwTimeouts(config), clock, emit: () => undefined, log,
  });
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const ingest = createIngest({
    store, dispatcher, log,
    emit: () => undefined,
    persistBaseline: (baseline: KwhBaseline) => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString()),
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
    onChange: () => undefined,
  });

  const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("room", { db, store, dispatcher, ingest, sessions });

  await app.register(errorsPlugin);
  await app.register(cookie, { secret: config.COOKIE_SECRET });
  await app.register(authPlugin, { sessions, localhostIsKiosk: config.LOCALHOST_IS_KIOSK });
  await app.register(originCheckPlugin);
  await app.register(
    async (api) => {
      await api.register(sessionRoutes, { db, sessions, throttle: createPinThrottle(clock), log });
      await api.register(stateRoutes, { store });
      await api.register(healthRoutes, { store });
    },
    { prefix: "/api" },
  );
  await app.register(staticPlugin, { kioskDist: config.KIOSK_DIST });

  app.addHook("onReady", async () => {
    timers.add(setInterval(() => store.tick(), TICK_MS));
    timers.add(setInterval(() => sessions.sweep(), SESSION_SWEEP_MS));
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
```
3. Create `apps/core-api/test/routes/origin.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, startApp } from "./app-helpers.ts";

const ROOM_PIN = { level: "control", pin: "1234", label: "phone" };

describe("origin check (CSRF, §5)", () => {
  it("missing or foreign Origin → 403 on every mutation, public ones included", async () => {
    const { app } = await startApp();
    const missing = await call(app, "POST", "/api/session/login", { origin: null, payload: ROOM_PIN });
    expect([missing.statusCode, missing.json()]).toEqual([403, { code: "forbidden", message: "Cross-origin request refused" }]);
    expect((await call(app, "POST", "/api/session/login", { origin: "http://evil.example", payload: ROOM_PIN })).statusCode).toBe(403);
    expect((await call(app, "POST", "/api/session/lock", { origin: "http://r-101.local:8080" })).statusCode).toBe(403); // port is part of the host
    await app.close();
  });

  it("a non-JSON body → 415; same origin + JSON passes; GETs are never checked", async () => {
    const { app } = await startApp();
    const text = await call(app, "POST", "/api/session/login", { contentType: "text/plain", payload: ROOM_PIN });
    expect([text.statusCode, text.json()]).toEqual([415, { code: "validation", message: "Content-Type must be application/json" }]);
    expect((await call(app, "POST", "/api/session/login", { payload: ROOM_PIN })).statusCode).toBe(200);
    expect((await call(app, "GET", "/api/state", { origin: "http://evil.example" })).statusCode).toBe(200);
    await app.close();
  });
});
```

**Test:** `apps/core-api/test/routes/origin.test.ts` (above).

**Verify:** `pnpm --filter @eduscope/core-api test` → 192 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): origin check"` (includes this plan file with the box ticked)

### T27 — `POST /api/commands`
- [x] done

**Files:** `apps/core-api/src/routes/commands.ts`, `apps/core-api/src/app.ts`, `apps/core-api/test/routes/commands.test.ts`

**Context:** ARCHITECTURE §3.3 `api/commands.ts`: `CommandRequest` → 202 `Command`. Route `config.access: "control"`; `projector.mains` needs technician (checked per kind in the dispatcher → 403). A successful command is session activity (resets the idle timer, §5). The kiosk (loopback + flag) commands without a PIN.

**Do:**
1. Create `apps/core-api/src/routes/commands.ts`:
```ts
import { CommandRequest } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { SessionService } from "../auth/sessions.ts";
import type { Dispatcher } from "../commands/dispatcher.ts";
import { ensureSession } from "../plugins/auth.ts";

/** POST /api/commands (control; projector.mains needs technician, checked per kind) → 202 Command. */
export async function commandRoutes(app: FastifyInstance, options: { dispatcher: Dispatcher; sessions: SessionService }) {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.post("/commands", { config: { access: "control" }, schema: { body: CommandRequest } }, async (request, reply) => {
    const client = ensureSession(options.sessions, request, reply);
    const command = options.dispatcher.dispatch(request.body, { public_id: client.row.public_id, label: client.label, access: client.access });
    options.sessions.touch(client);
    return reply.status(202).send(command);
  });
}
```
2. Replace the whole file `apps/core-api/src/app.ts`:
```ts
import { DeviceKind, Transport } from "@eduscope/contracts";
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
import { createEventLogger } from "./db/event-log.ts";
import { devices } from "./db/schema.ts";
import { seed } from "./db/seed.ts";
import { readSetting, writeSetting } from "./db/settings.ts";
import { initialModel } from "./domain/initial.ts";
import type { DeviceInfo, KwhBaseline } from "./domain/model.ts";
import { createStateStore, type StateStore } from "./domain/state-store.ts";
import type { HwClient, HwTimeouts } from "./hw/client.ts";
import { createIngest, type Ingest } from "./hw/ingest.ts";
import { authPlugin } from "./plugins/auth.ts";
import { errorsPlugin } from "./plugins/errors.ts";
import { originCheckPlugin } from "./plugins/origin-check.ts";
import { staticPlugin } from "./plugins/static.ts";
import { commandRoutes } from "./routes/commands.ts";
import { healthRoutes } from "./routes/health.ts";
import { sessionRoutes } from "./routes/session.ts";
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
}

/** What tests and main.ts reach into. */
export interface Room {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  ingest: Ingest;
  sessions: SessionService;
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
    hdmiMs: config.TIMEOUT_HDMI_MS,
    mixerMs: config.TIMEOUT_MIXER_MS,
    screenMs: config.TIMEOUT_SCREEN_MS,
  };
}

const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });

function loadRegistry(db: Db): DeviceInfo[] {
  return db
    .select()
    .from(devices)
    .orderBy(devices.sort)
    .all()
    .map((row) => ({
      id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
      brand: row.brand, model: row.model, hw_ref: row.hw_ref,
    }));
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, clock } = deps;
  const { db, close: closeDb } = openDb(deps.db);
  await seed(db, config, clock.now().toISOString());

  const log = createEventLogger(db, clock);
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
    store, hw: deps.hw, ir: createIrCodeLookup(db), timeouts: hwTimeouts(config), clock, emit: () => undefined, log,
  });
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const ingest = createIngest({
    store, dispatcher, log,
    emit: () => undefined,
    persistBaseline: (baseline: KwhBaseline) => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString()),
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
    onChange: () => undefined,
  });

  const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("room", { db, store, dispatcher, ingest, sessions });

  await app.register(errorsPlugin);
  await app.register(cookie, { secret: config.COOKIE_SECRET });
  await app.register(authPlugin, { sessions, localhostIsKiosk: config.LOCALHOST_IS_KIOSK });
  await app.register(originCheckPlugin);
  await app.register(
    async (api) => {
      await api.register(sessionRoutes, { db, sessions, throttle: createPinThrottle(clock), log });
      await api.register(stateRoutes, { store });
      await api.register(commandRoutes, { dispatcher, sessions });
      await api.register(healthRoutes, { store });
    },
    { prefix: "/api" },
  );
  await app.register(staticPlugin, { kioskDist: config.KIOSK_DIST });

  app.addHook("onReady", async () => {
    timers.add(setInterval(() => store.tick(), TICK_MS));
    timers.add(setInterval(() => sessions.sweep(), SESSION_SWEEP_MS));
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
```
3. Create `apps/core-api/test/routes/commands.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { call, commandBody, PHONE_IP, sessionAt, startApp } from "./app-helpers.ts";

const LIGHTS = { kind: "lights.set", gang: "rear", on: true };

describe("POST /api/commands by level", () => {
  it("no cookie → 401; view → 401; control → 202; technician kind as control → 403", async () => {
    const { app } = await startApp();
    expect((await call(app, "POST", "/api/commands", { payload: commandBody(LIGHTS) })).statusCode).toBe(401);
    const view = await sessionAt(app, "view");
    const viewed = await call(app, "POST", "/api/commands", { cookie: view, payload: commandBody(LIGHTS) });
    expect([viewed.statusCode, viewed.json()]).toEqual([401, { code: "unauthorized", message: "Enter the room PIN" }]);
    const control = await sessionAt(app, "control");
    const accepted = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody(LIGHTS) });
    expect(accepted.statusCode).toBe(202);
    expect(accepted.json()).toMatchObject({ status: "pending", issued_by: { label: "phone" }, body: LIGHTS });
    const mains = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody({ kind: "projector.mains", on: false }) });
    expect([mains.statusCode, mains.json()]).toEqual([403, { code: "forbidden", message: "Technician PIN required" }]);
    const tech = await sessionAt(app, "technician");
    const held = await call(app, "POST", "/api/commands", { cookie: tech, payload: commandBody({ kind: "projector.mains", on: false }) });
    expect(held.statusCode).toBe(409); // allowed, but the interlock holds (R11)
    await app.close();
  });

  it("a foreign Origin is refused before the session is even looked at", async () => {
    const { app } = await startApp();
    const control = await sessionAt(app, "control");
    const foreign = await call(app, "POST", "/api/commands", { cookie: control, origin: "http://evil.example", payload: commandBody(LIGHTS) });
    expect(foreign.statusCode).toBe(403);
    await app.close();
  });

  it("an invalid body is a 400 validation ApiError", async () => {
    const { app } = await startApp();
    const control = await sessionAt(app, "control");
    const response = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody({ kind: "lights.set", gang: "middle", on: true }) });
    expect([response.statusCode, response.json().code]).toEqual([400, "validation"]);
    await app.close();
  });

  it("hw down → 503 hw_unavailable", async () => {
    const { app } = await startApp();
    const control = await sessionAt(app, "control");
    app.room.ingest.down();
    const response = await call(app, "POST", "/api/commands", { cookie: control, payload: commandBody(LIGHTS) });
    expect([response.statusCode, response.json()]).toEqual([503, { code: "hw_unavailable", message: "Hardware service offline" }]);
    await app.close();
  });

  it("control ends after 2 h idle; a command resets the idle timer", async () => {
    const { app, clock } = await startApp();
    const cookie = await sessionAt(app, "control");
    clock.advance(90 * 60_000);
    expect((await call(app, "POST", "/api/commands", { cookie, payload: commandBody(LIGHTS) })).statusCode).toBe(202);
    clock.advance(90 * 60_000); // 3 h after login, 1.5 h after the command
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "control" });
    clock.advance(31 * 60_000);
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ access: "view", expires_at: null });
    await app.close();
  });

  it("kiosk (loopback, flag on) commands without a PIN; with the flag off loopback is refused", async () => {
    const kiosk = await startApp({ LOCALHOST_IS_KIOSK: "true" });
    expect((await call(kiosk.app, "POST", "/api/commands", { remoteAddress: "127.0.0.1", payload: commandBody(LIGHTS) })).statusCode).toBe(202);
    expect((await call(kiosk.app, "POST", "/api/commands", { remoteAddress: PHONE_IP, payload: commandBody(LIGHTS) })).statusCode).toBe(401);
    await kiosk.app.close();
    const dev = await startApp({ LOCALHOST_IS_KIOSK: "false" });
    expect((await call(dev.app, "POST", "/api/commands", { remoteAddress: "127.0.0.1", payload: commandBody(LIGHTS) })).statusCode).toBe(401);
    await dev.app.close();
  });
});
```

**Test:** `apps/core-api/test/routes/commands.test.ts` (above): 401 without a session, 401 view, 202 control, 403 technician kind, 409 interlock as technician, 403 foreign origin, 400 invalid body, 503 hw down, idle reset by a command, kiosk on/off.

**Verify:** `pnpm --filter @eduscope/core-api test` → 198 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): POST /api/commands"` (includes this plan file with the box ticked)

### T28 — WebSocket hub: snapshot on connect, fan-out, session pushes, ping
- [ ] done

**Files:** `apps/core-api/src/plugins/realtime.ts`, `apps/core-api/src/app.ts`, `apps/core-api/test/routes/app-helpers.ts`, `apps/core-api/test/routes/realtime.test.ts`

**Context:** ARCHITECTURE §6.6: a `Set` of sockets with `{public_id|null, label, access}` resolved from the cookie at upgrade; `snapshot` on connect; every store broadcast → `state` (full RoomState) to all; `command`, `activity` to all; `session` only to that session's sockets; `ping` every 10 s, 2 missed pongs ⇒ terminate; `hello` sets the label (and the remote row's label); frames other than hello/pong dropped; > 4 KB closes (1009). Never IR codes or PIN data (milestone note). The client list feeds M09's S3b. This is the final `app.ts`.

**Do:**
1. Create `apps/core-api/src/plugins/realtime.ts`:
```ts
import { ClientMessage, type ClientLabel, type ConnectedClient, type ServerEvent } from "@eduscope/contracts";
import websocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { WebSocket } from "ws";
import type { SessionService } from "../auth/sessions.ts";
import type { StateStore } from "../domain/state-store.ts";

// ARCHITECTURE §6.6 WS hub: snapshot on connect, `state` + command/activity to all, `session` only
// to that session's sockets, ping every 10 s (2 missed pongs ⇒ terminate). Receive-only (D-03):
// inbound frames other than hello/pong are dropped, > 4 KB closes the socket. Never IR codes or PINs.

export const PING_MS = 10_000;
export const MAX_FRAME_BYTES = 4096;
const MAX_MISSED_PONGS = 2;

interface HubClient {
  socket: WebSocket;
  publicId: string | null;
  label: ClientLabel;
  info: Omit<ConnectedClient, "label" | "public_id">;
  missedPongs: number;
}

export interface Hub {
  add(client: HubClient): void;
  remove(client: HubClient): void;
  broadcast(event: ServerEvent): void;
  sendToSession(publicId: string, event: ServerEvent): void;
  /** S3b connected clients (used by M09's network route). */
  clients(): ConnectedClient[];
  /** One ping round: terminate silent sockets, ping the rest. */
  ping(): void;
  size(): number;
}

export function createHub(): Hub {
  const clients = new Set<HubClient>();
  const send = (client: HubClient, event: ServerEvent): void => {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(JSON.stringify(event));
  };
  return {
    add: (client) => clients.add(client),
    remove: (client) => clients.delete(client),
    broadcast(event) {
      for (const client of clients) send(client, event);
    },
    sendToSession(publicId, event) {
      for (const client of clients) if (client.publicId === publicId) send(client, event);
    },
    clients: () => [...clients].map((client) => ({ public_id: client.publicId, label: client.label, ...client.info })),
    ping() {
      for (const client of clients) {
        if (client.missedPongs >= MAX_MISSED_PONGS) {
          client.socket.terminate();
          clients.delete(client);
          continue;
        }
        client.missedPongs += 1;
        send(client, { type: "ping" });
      }
    },
    size: () => clients.size,
  };
}

export const realtimePlugin = fp(async (app: FastifyInstance, options: { hub: Hub; store: StateStore; sessions: SessionService }) => {
  const { hub, store, sessions } = options;
  await app.register(websocket, { options: { maxPayload: MAX_FRAME_BYTES } });

  app.get("/ws", { websocket: true }, (socket, request) => {
    const resolved = request.client;
    const client: HubClient = {
      socket,
      publicId: resolved.row?.public_id ?? null,
      label: resolved.label,
      info: { client_type: resolved.clientType, access: resolved.access },
      missedPongs: 0,
    };
    hub.add(client);
    socket.send(JSON.stringify({ type: "snapshot", state: store.get() } satisfies ServerEvent));

    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      let raw: unknown;
      try {
        raw = JSON.parse(String(data));
      } catch {
        return;
      }
      const message = ClientMessage.safeParse(raw);
      if (!message.success) return;
      client.missedPongs = 0;
      if (message.data.type === "hello" && resolved.clientType === "remote") {
        client.label = message.data.label;
        if (client.publicId !== null) sessions.setLabel(client.publicId, message.data.label);
      }
    });
    socket.on("close", () => hub.remove(client));
  });
});
```
2. Replace the whole file `apps/core-api/src/app.ts`:
```ts
import { DeviceKind, Transport } from "@eduscope/contracts";
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
import { createEventLogger } from "./db/event-log.ts";
import { devices } from "./db/schema.ts";
import { seed } from "./db/seed.ts";
import { readSetting, writeSetting } from "./db/settings.ts";
import { initialModel } from "./domain/initial.ts";
import type { DeviceInfo, KwhBaseline } from "./domain/model.ts";
import { createStateStore, type StateStore } from "./domain/state-store.ts";
import type { HwClient, HwTimeouts } from "./hw/client.ts";
import { createIngest, type Ingest } from "./hw/ingest.ts";
import { authPlugin } from "./plugins/auth.ts";
import { errorsPlugin } from "./plugins/errors.ts";
import { originCheckPlugin } from "./plugins/origin-check.ts";
import { createHub, PING_MS, realtimePlugin, type Hub } from "./plugins/realtime.ts";
import { staticPlugin } from "./plugins/static.ts";
import { commandRoutes } from "./routes/commands.ts";
import { healthRoutes } from "./routes/health.ts";
import { sessionRoutes } from "./routes/session.ts";
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
}

/** What tests and main.ts reach into. */
export interface Room {
  db: Db;
  store: StateStore;
  dispatcher: Dispatcher;
  ingest: Ingest;
  sessions: SessionService;
  hub: Hub;
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
    hdmiMs: config.TIMEOUT_HDMI_MS,
    mixerMs: config.TIMEOUT_MIXER_MS,
    screenMs: config.TIMEOUT_SCREEN_MS,
  };
}

const KwhBaselineSchema = z.object({ date: z.string(), kwh_total: z.number() });

function loadRegistry(db: Db): DeviceInfo[] {
  return db
    .select()
    .from(devices)
    .orderBy(devices.sort)
    .all()
    .map((row) => ({
      id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
      brand: row.brand, model: row.model, hw_ref: row.hw_ref,
    }));
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, clock } = deps;
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
  const ingest = createIngest({
    store, dispatcher, log,
    emit: (event) => hub.broadcast(event),
    persistBaseline: (baseline: KwhBaseline) => writeSetting(db, "kwh_baseline", baseline, clock.now().toISOString()),
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
    onChange: (session) => hub.sendToSession(session.public_id, { type: "session", session }),
  });
  store.subscribe((state) => hub.broadcast({ type: "state", state }));

  const app = Fastify({ logger: deps.logger ?? false, trustProxy: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("room", { db, store, dispatcher, ingest, sessions, hub });

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
    },
    { prefix: "/api" },
  );
  await app.register(staticPlugin, { kioskDist: config.KIOSK_DIST });

  app.addHook("onReady", async () => {
    timers.add(setInterval(() => store.tick(), TICK_MS));
    timers.add(setInterval(() => sessions.sweep(), SESSION_SWEEP_MS));
    timers.add(setInterval(() => hub.ping(), PING_MS));
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
```
3. Replace the whole file `apps/core-api/test/routes/app-helpers.ts`:
```ts
import { ServerEvent } from "@eduscope/contracts";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { WebSocket } from "ws";
import { buildApp } from "../../src/app.ts";
import { fixedClock, type FixedClock } from "../../src/clock.ts";
import type { Config } from "../../src/config.ts";
import { fakeHw, snapshotEvent, T0, testConfig, type FakeHw } from "../helpers.ts";

export const HOST = "r-101.local";
export const ORIGIN = `http://${HOST}`;
/** A phone on the room Wi-Fi (not loopback). */
export const PHONE_IP = "192.168.1.50";

export interface TestApp {
  app: FastifyInstance;
  clock: FixedClock;
  hw: FakeHw;
}

/** buildApp with `:memory:`, a fake hw client, a fixed clock; hw reported up (fixture snapshot) unless `hwUp: false`. */
export async function startApp(overrides: Partial<Record<keyof Config, string>> = {}, options: { hwUp?: boolean } = {}): Promise<TestApp> {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const app = await buildApp({ db: ":memory:", hw, clock, config: testConfig(overrides) });
  await app.ready();
  if (options.hwUp !== false) app.room.ingest.handle(snapshotEvent());
  return { app, clock, hw };
}

export interface Call {
  cookie?: string | null;
  payload?: unknown;
  origin?: string | null;
  contentType?: string;
  remoteAddress?: string;
}

export function call(app: FastifyInstance, method: "GET" | "POST", url: string, options: Call = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { host: HOST };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  if (method === "POST") headers["content-type"] = options.contentType ?? "application/json";
  return app.inject({
    method, url, headers, remoteAddress: options.remoteAddress ?? PHONE_IP,
    ...(method === "POST" ? { payload: JSON.stringify(options.payload ?? {}) } : {}),
  });
}

/** The signed `ec_sid` value a response set, if any. */
export function cookieOf(response: LightMyRequestResponse): string | null {
  return response.cookies.find((c) => c.name === "ec_sid")?.value ?? null;
}

/** A browser session at the given level (control: room PIN, technician: technician PIN). */
export async function sessionAt(app: FastifyInstance, level: "view" | "control" | "technician", remoteAddress = PHONE_IP): Promise<string> {
  const cookie = cookieOf(await call(app, "GET", "/api/session", { remoteAddress }));
  if (cookie === null) throw new Error("no cookie");
  if (level === "view") return cookie;
  const pin = level === "control" ? "1234" : "123456";
  const response = await call(app, "POST", "/api/session/login", { cookie, remoteAddress, payload: { level, pin, label: "phone" } });
  if (response.statusCode !== 200) throw new Error(`login failed: ${response.body}`);
  return cookie;
}

let seq = 0;
export const commandBody = (body: unknown): { client_cmd_id: string; body: unknown } => ({
  client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  body,
});

const isType =
  <T extends ServerEvent["type"]>(type: T) =>
  (frame: ServerEvent): frame is Extract<ServerEvent, { type: T }> =>
    frame.type === type;

export interface TestSocket {
  ws: WebSocket;
  frames: ServerEvent[];
  /** Resolves with the next frame of `type` (already received ones count). */
  next<T extends ServerEvent["type"]>(type: T, after?: number): Promise<Extract<ServerEvent, { type: T }>>;
}

export async function openSocket(app: FastifyInstance, options: { cookie?: string | null; origin?: string } = {}): Promise<TestSocket> {
  const frames: ServerEvent[] = [];
  const headers: Record<string, string> = { host: HOST, origin: options.origin ?? ORIGIN };
  if (options.cookie) headers.cookie = `ec_sid=${options.cookie}`;
  const ws = await app.injectWS("/ws", { headers }, {
    onInit: (socket) => socket.on("message", (data) => frames.push(ServerEvent.parse(JSON.parse(String(data))))),
  });
  return {
    ws,
    frames,
    async next(type, after = 0) {
      for (let i = 0; i < 100; i += 1) {
        const found = frames.slice(after).find(isType(type));
        if (found !== undefined) return found;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`no ${type} frame`);
    },
  };
}
```
4. Create `apps/core-api/test/routes/realtime.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FAKE_PROJECTOR_CODES } from "../../src/db/seed.ts";
import { hwEvent } from "../helpers.ts";
import { call, cookieOf, openSocket, sessionAt, startApp } from "./app-helpers.ts";

describe("WS hub (§6.6)", () => {
  it("sends the full snapshot on connect", async () => {
    const { app } = await startApp();
    const socket = await openSocket(app);
    const snapshot = await socket.next("snapshot");
    expect(snapshot.state).toMatchObject({ room: { id: "R-101" }, connection: { hw: "up" } });
    expect(snapshot.state.rev).toBe(app.room.store.get().rev);
    socket.ws.terminate();
    await app.close();
  });

  it("fans every state change out to N sockets with a monotonic rev", async () => {
    const { app } = await startApp();
    const sockets = await Promise.all([openSocket(app), openSocket(app), openSocket(app)]);
    await Promise.all(sockets.map((s) => s.next("snapshot")));
    app.room.ingest.handle(hwEvent("lights.state", { gang: "rear", on: true }));
    app.room.ingest.handle(hwEvent("hdmi.state", { input: "smart_board" }));
    for (const socket of sockets) {
      const state = await socket.next("state");
      expect(state.state.environment.lights.rear.value).toBe(true);
      const activity = await socket.next("activity");
      expect(activity).toEqual({ type: "activity", text: "Rear of room turned on", by: "by hand", public_id: null });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
    for (const socket of sockets) {
      const revs = socket.frames.flatMap((f) => (f.type === "snapshot" || f.type === "state" ? [f.state.rev] : []));
      expect(revs.length).toBeGreaterThanOrEqual(2);
      expect(revs).toEqual([...revs].sort((a, b) => a - b));
      expect(new Set(revs).size).toBe(revs.length);
    }
    for (const socket of sockets) socket.ws.terminate();
    await app.close();
  });

  it("`session` goes only to that session's sockets (login, lock, expiry)", async () => {
    const { app, clock } = await startApp();
    const cookie = await sessionAt(app, "view");
    const mine = await openSocket(app, { cookie });
    const other = await openSocket(app);
    await call(app, "POST", "/api/session/login", { cookie, payload: { level: "control", pin: "1234", label: "phone" } });
    expect((await mine.next("session")).session).toMatchObject({ access: "control", label: "phone" });
    clock.advance(2 * 60 * 60_000);
    app.room.sessions.sweep();
    await expect.poll(() => mine.frames.filter((f) => f.type === "session").at(-1)).toMatchObject({ session: { access: "view" } });
    expect(other.frames.some((f) => f.type === "session")).toBe(false);
    mine.ws.terminate();
    other.ws.terminate();
    await app.close();
  });

  it("never carries IR codes or PIN data", async () => {
    const { app } = await startApp({ SEED_FAKE_IR_CODES: "true" });
    const socket = await openSocket(app);
    const text = JSON.stringify(await socket.next("snapshot"));
    expect(text).not.toContain(FAKE_PROJECTOR_CODES["projector.power_on"]);
    expect(text).not.toContain("scrypt$");
    socket.ws.terminate();
    await app.close();
  });

  it("refuses a foreign Origin at the upgrade", async () => {
    const { app } = await startApp();
    await expect(openSocket(app, { origin: "http://evil.example" })).rejects.toThrow("Unexpected server response: 403");
    await app.close();
  });

  it("hello names the client (S3b list, attribution); junk frames are dropped; > 4 KB closes", async () => {
    const { app } = await startApp();
    const cookie = cookieOf(await call(app, "GET", "/api/session"));
    const socket = await openSocket(app, { cookie });
    await socket.next("snapshot");
    socket.ws.send(JSON.stringify({ type: "hello", label: "tablet" }));
    socket.ws.send("not json");
    socket.ws.send(JSON.stringify({ type: "command", body: {} }));
    await expect.poll(() => app.room.hub.clients()).toEqual([{ public_id: expect.any(String), label: "tablet", client_type: "remote", access: "view" }]);
    expect((await call(app, "GET", "/api/session", { cookie })).json()).toMatchObject({ label: "tablet" });
    const closed = new Promise<number>((resolve) => socket.ws.on("close", (code) => resolve(code)));
    socket.ws.send("x".repeat(5000));
    expect(await closed).toBe(1009);
    await expect.poll(() => app.room.hub.size()).toBe(0);
    await app.close();
  });

  it("ping every round; a socket that misses 2 pongs is terminated", async () => {
    const { app } = await startApp();
    const socket = await openSocket(app);
    await socket.next("snapshot");
    app.room.hub.ping();
    await socket.next("ping");
    socket.ws.send(JSON.stringify({ type: "pong" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    app.room.hub.ping();
    app.room.hub.ping();
    expect(app.room.hub.size()).toBe(1); // one pong answered, so only 2 unanswered so far
    app.room.hub.ping();
    expect(app.room.hub.size()).toBe(0);
    await app.close();
  });
});
```

**Test:** `apps/core-api/test/routes/realtime.test.ts` (above; `app.injectWS`, no ports): snapshot on connect; 3 sockets get the state + by-hand activity with a strictly increasing `rev`; no IR code / scrypt hash on the wire; foreign origin → 403; `session` only to the owner (login and expiry); hello label, junk dropped, 5 KB → 1009; ping/pong termination.

**Verify:** `pnpm --filter @eduscope/core-api test` → 205 passed. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): WebSocket hub"` (includes this plan file with the box ticked)

### T29 — `main.ts`, the build, and `pnpm dev` starting core-api
- [ ] done

**Files:** `apps/core-api/src/main.ts`, `apps/core-api/scripts/build.ts`, `apps/core-api/package.json`

**Context:** ARCHITECTURE §6.1 boot: config → db migrate/seed → store → listen → hw stream; signals close cleanly. D9: `dev` = `tsx watch` with dev-only env inline (`LOCALHOST_IS_KIOSK=false` because the Vite proxy makes every browser look local; PINs 1234/123456 like the mock; `SEED_FAKE_IR_CODES=true`; DB in `apps/core-api/data/` — `*.db*` is git-ignored); `build` = esbuild bundle `dist/main.js` with `@eduscope/contracts` inlined and npm packages external (AC8: `node dist/main.js`). The root `pnpm dev` already runs every package's `dev` (`dev:apps`) plus `dev:hw`, so it now starts hw (fake) + core-api :3000 + kiosk :5173 — no root change.

**Do:**
1. Create `apps/core-api/src/main.ts`:
```ts
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
```
2. Create `apps/core-api/scripts/build.ts`:
```ts
import { build } from "esbuild";

// dist/main.js for `node dist/main.js` (M08 AC8, M10). @eduscope/contracts is TypeScript source, so
// it is bundled in; every npm dependency stays external and is loaded from node_modules at runtime.

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  plugins: [
    {
      name: "externalize-npm-packages",
      setup(builder) {
        builder.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith("@eduscope/") ? undefined : { path: args.path, external: true }));
      },
    },
  ],
});
console.log("built dist/main.js");
```
3. Replace the whole file `apps/core-api/package.json`:
```json
{
  "name": "@eduscope/core-api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "PORT=3000 HOST=0.0.0.0 DB_PATH=./data/dev.db HW_URL=http://127.0.0.1:8081 COOKIE_SECRET=dev-only-cookie-secret-never-used-on-the-pi LOCALHOST_IS_KIOSK=false INITIAL_ROOM_PIN=1234 INITIAL_TECH_PIN=123456 SEED_FAKE_IR_CODES=true tsx watch src/main.ts",
    "build": "tsx scripts/build.ts",
    "start": "node dist/main.js",
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@eduscope/contracts": "workspace:*",
    "@fastify/cookie": "^11.1.3",
    "@fastify/static": "^10.1.6",
    "@fastify/websocket": "^11.3.4",
    "better-sqlite3": "^13.0.3",
    "drizzle-orm": "^0.45.4",
    "eventsource-parser": "^4.1.2",
    "fastify": "^5.12.5",
    "fastify-plugin": "^6.0.1",
    "fastify-type-provider-zod": "^7.0.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^9.6.0",
    "@types/node": "^22.20.5",
    "@types/ws": "^8.18.2",
    "drizzle-kit": "^0.31.11",
    "esbuild": "^0.28.2",
    "tsx": "^4.23.15",
    "typescript": "~6.0.3",
    "vitest": "^5.0.3"
  }
}
```

**Test:** None (wiring; every part is tested). Manual check below.

**Verify:** 1. `pnpm --filter @eduscope/core-api build` → prints `built dist/main.js`.
2. Terminal A: `pnpm dev:hw`. Terminal B: `pnpm --filter @eduscope/core-api dev` → log line `Server listening at http://…:3000`; `curl -s localhost:3000/api/health` → `{"ok":true,"hw":"up","rev":…}` within 2 s. Ctrl+C both.
3. `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(core-api): main, build and pnpm dev"` (includes this plan file with the box ticked)

### T30 — Kiosk http adapter: open the WebSocket after `GET /api/session`
- [ ] done

**Files:** `apps/kiosk/src/data/adapters/http/http-client.ts`, `apps/kiosk/src/data/adapters/http/http-client.test.ts`

**Context:** D-21 point 3: the upgrade must carry the session cookie so core-api can push `session` events (H24) to this socket. `connect()` still returns synchronously; it now fetches `/api/session` (which issues the cookie on a first visit), then opens the socket. A failed fetch is reported once as `onClose` (the connection manager then backs off as for any drop, H3); `close()` before the answer never opens a socket. Everything else in the adapter is unchanged (the M02 comment "Exercised by tests only until M08" goes).

**Do:**
1. Replace the whole file `apps/kiosk/src/data/adapters/http/http-client.ts`:
```ts
import {
  ApiError, ClassBlock, ClassBlockInput, ClientMessage, CommandRequest, Device, DeviceList, DevicePatch,
  GetAboutResponse, GetNetworkResponse, GetScheduleResponse, GetSessionResponse, GetStateResponse, IrCommand,
  IrCommandCreate, IrDevice, IrDeviceCreate, IrDeviceList, IrTestResultRequest, LockResponse, LoginRequest,
  PermitJoinRequest, PinError, PostCommandResponse, RoomPinRequest, ServerEvent, TechnicianPinRequest, TimedAction,
  TimedActionInput,
} from "@eduscope/contracts";
import type { z } from "zod";
import { ApiRequestError, type ApiClient, type RealtimeConnection } from "@/data/api-client";

// fetch + WebSocket adapter (ARCHITECTURE §4.4). Every response and frame is zod-parsed.

/** The slice of the browser WebSocket this adapter uses (a fake implements it in tests). */
export interface SocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface HttpClientOptions {
  fetch?: typeof fetch;
  /** Prefix for `/api/...`; empty = same origin. */
  baseUrl?: string;
  /** Full WS URL, e.g. `ws://r-101.local/ws`. */
  wsUrl: string;
  createSocket?: (url: string) => SocketLike;
}

/** `ws(s)://<host>/ws` for the page's own origin. */
export function sameOriginWsUrl(location: Pick<Location, "protocol" | "host">): string {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

const sendJson = (method: "POST" | "PUT" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Request bodies are checked against the contract before anything is sent (CLAUDE.md: zod at every boundary). */
function checked<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiRequestError("validation", parsed.error.issues[0]?.message ?? "Invalid request", null);
  return parsed.data;
}

export function createHttpApiClient(options: HttpClientOptions): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? "";
  const createSocket = options.createSocket ?? ((url: string): SocketLike => new WebSocket(url));

  async function fetchJson(path: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, { credentials: "same-origin", ...init });
    } catch {
      throw new ApiRequestError("network", "Can't reach the controller", null);
    }
    const body: unknown = await response.json().catch(() => null);
    return { response, body };
  }

  function fail(response: Response, body: unknown): never {
    const error = ApiError.safeParse(body);
    if (error.success) throw new ApiRequestError(error.data.code, error.data.message, response.status);
    throw new ApiRequestError("bad_response", `HTTP ${response.status}`, response.status);
  }

  function parse<S extends z.ZodType>(schema: S, path: string, response: Response, body: unknown): z.infer<S> {
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiRequestError("bad_response", `Unexpected response from ${path}`, response.status);
    return parsed.data;
  }

  async function request<S extends z.ZodType>(schema: S, path: string, init?: RequestInit): Promise<z.infer<S>> {
    const { response, body } = await fetchJson(path, init);
    if (!response.ok) fail(response, body);
    return parse(schema, path, response, body);
  }

  const postJson = (body: unknown): RequestInit => sendJson("POST", body);

  /** A 2xx with no body we need (202 / 204). */
  async function requestVoid(path: string, init: RequestInit): Promise<void> {
    const { response, body } = await fetchJson(path, init);
    if (!response.ok) fail(response, body);
  }

  const id = (value: string): string => encodeURIComponent(value);

  return {
    getSession: () => request(GetSessionResponse, "/api/session"),
    async login(loginRequest) {
      const checked = LoginRequest.safeParse(loginRequest);
      if (!checked.success) throw new ApiRequestError("validation", "The PIN has the wrong number of digits", null);
      const path = "/api/session/login";
      const { response, body } = await fetchJson(path, postJson(checked.data));
      // A wrong or locked PIN is an answer, not a failure: a PinError body counts with any status.
      const pinError = PinError.safeParse(body);
      if (pinError.success) return pinError.data;
      if (!response.ok) fail(response, body);
      return parse(GetSessionResponse, path, response, body);
    },
    lock: () => request(LockResponse, "/api/session/lock", postJson({})),
    getState: () => request(GetStateResponse, "/api/state"),
    sendCommand: async (commandRequest) =>
      request(PostCommandResponse, "/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CommandRequest.parse(commandRequest)),
      }),
    ir: {
      listDevices: () => request(IrDeviceList, "/api/ir/devices"),
      createDevice: async (input) => request(IrDevice, "/api/ir/devices", postJson(checked(IrDeviceCreate, input))),
      createCommand: async (deviceId, input) =>
        request(IrCommand, `/api/ir/devices/${id(deviceId)}/commands`, postJson(checked(IrCommandCreate, input))),
      learn: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/learn`, postJson({})),
      cancelLearn: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/learn/cancel`, postJson({})),
      test: (commandId) => requestVoid(`/api/ir/commands/${id(commandId)}/test`, postJson({})),
      recordTest: async (commandId, reacted) =>
        request(IrCommand, `/api/ir/commands/${id(commandId)}/test-result`, postJson(checked(IrTestResultRequest, { reacted }))),
    },
    schedule: {
      get: () => request(GetScheduleResponse, "/api/schedule"),
      createBlock: async (input) => request(ClassBlock, "/api/schedule/blocks", postJson(checked(ClassBlockInput, input))),
      deleteBlock: (blockId) => requestVoid(`/api/schedule/blocks/${id(blockId)}`, { method: "DELETE" }),
      createAction: async (input) => request(TimedAction, "/api/schedule/actions", postJson(checked(TimedActionInput, input))),
      updateAction: async (actionId, input) =>
        request(TimedAction, `/api/schedule/actions/${id(actionId)}`, sendJson("PUT", checked(TimedActionInput, input))),
      deleteAction: (actionId) => requestVoid(`/api/schedule/actions/${id(actionId)}`, { method: "DELETE" }),
    },
    devices: {
      list: () => request(DeviceList, "/api/devices"),
      update: async (deviceId, patch) => request(Device, `/api/devices/${id(deviceId)}`, sendJson("PATCH", checked(DevicePatch, patch))),
      remove: (deviceId) => requestVoid(`/api/devices/${id(deviceId)}`, { method: "DELETE" }),
      permitJoin: async () => requestVoid("/api/zigbee/permit-join", postJson(checked(PermitJoinRequest, { seconds: 240 }))),
    },
    settings: {
      setRoomPin: async (pin) => requestVoid("/api/settings/pins/room", sendJson("PUT", checked(RoomPinRequest, { pin }))),
      setTechnicianPin: async (pin) =>
        requestVoid("/api/settings/pins/technician", sendJson("PUT", checked(TechnicianPinRequest, { pin }))),
    },
    system: {
      network: () => request(GetNetworkResponse, "/api/system/network"),
      about: () => request(GetAboutResponse, "/api/system/about"),
      restart: () => requestVoid("/api/system/restart", postJson({})),
    },
    connect(label, handlers): RealtimeConnection {
      let socket: SocketLike | null = null;
      let closed = false;
      const send = (message: ClientMessage): void => socket?.send(JSON.stringify(ClientMessage.parse(message)));
      const finish = (): void => {
        if (closed) return;
        closed = true;
        handlers.onClose();
      };
      const open = (): void => {
        if (closed) return; // close() came first
        const ws = createSocket(options.wsUrl);
        socket = ws;
        ws.onopen = () => {
          send({ type: "hello", label });
          handlers.onOpen();
        };
        ws.onmessage = (message) => {
          let raw: unknown;
          try {
            raw = JSON.parse(String(message.data));
          } catch {
            console.warn("ws: dropped a non-JSON frame");
            return;
          }
          const parsed = ServerEvent.safeParse(raw);
          if (!parsed.success) {
            console.warn("ws: dropped an invalid frame", parsed.error.issues);
            return;
          }
          if (parsed.data.type === "ping") send({ type: "pong" });
          handlers.onEvent(parsed.data);
        };
        ws.onclose = finish;
        ws.onerror = finish;
      };
      // The upgrade must carry the session cookie so core-api can push `session` events to this
      // socket (H24). GET /api/session issues the cookie on a first visit; its body is not needed.
      doFetch(`${baseUrl}/api/session`, { credentials: "same-origin" }).then(open, finish);
      return {
        close() {
          closed = true; // a deliberate close is not reported as a drop
          socket?.close();
        },
      };
    },
  };
}
```
2. In `apps/kiosk/src/data/adapters/http/http-client.test.ts` replace everything from the line `describe("http adapter: WebSocket", () => {` up to (not including) the line `describe("sameOriginWsUrl", () => {` with:
```ts
describe("http adapter: WebSocket", () => {
  async function connect(fetchImpl: typeof fetch = vi.fn(async () => json(200, {}))) {
    const socket = new FakeSocket();
    const createSocket = vi.fn(() => socket);
    const api = createHttpApiClient({ fetch: fetchImpl, wsUrl: "ws://r-101.local/ws", createSocket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    const connection = api.connect("phone", handlers);
    await vi.waitFor(() => expect(createSocket).toHaveBeenCalledWith("ws://r-101.local/ws"));
    return { socket, handlers, connection, fetchImpl };
  }

  it("GETs /api/session first so the upgrade carries the session cookie", async () => {
    const { fetchImpl } = await connect();
    expect(fetchImpl).toHaveBeenCalledWith("/api/session", { credentials: "same-origin" });
  });

  it("a failed session fetch is reported as a close and opens no socket", async () => {
    const createSocket = vi.fn(() => new FakeSocket());
    const api = createHttpApiClient({ fetch: vi.fn(async () => Promise.reject(new TypeError("offline"))), wsUrl: "ws://x/ws", createSocket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    api.connect("phone", handlers);
    await vi.waitFor(() => expect(handlers.onClose).toHaveBeenCalledTimes(1));
    expect(createSocket).not.toHaveBeenCalled();
  });

  it("close() before the session answer never opens the socket", async () => {
    const createSocket = vi.fn(() => new FakeSocket());
    const fetchImpl = vi.fn(async () => json(200, {}));
    const api = createHttpApiClient({ fetch: fetchImpl, wsUrl: "ws://x/ws", createSocket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    api.connect("phone", handlers).close();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createSocket).not.toHaveBeenCalled();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("sends hello with the client label on open", async () => {
    const { socket, handlers } = await connect();
    socket.onopen?.(new Event("open"));
    expect(socket.sent).toEqual([JSON.stringify({ type: "hello", label: "phone" })]);
    expect(handlers.onOpen).toHaveBeenCalled();
  });

  it("parses frames and forwards valid ServerEvents", async () => {
    const { socket, handlers } = await connect();
    const event: ServerEvent = { type: "activity", text: "Rear of room turned on", by: "phone", public_id: "x" };
    socket.emit(JSON.stringify(event));
    expect(handlers.onEvent).toHaveBeenCalledWith(event);
  });

  it("answers ping with pong", async () => {
    const { socket, handlers } = await connect();
    socket.emit(JSON.stringify({ type: "ping" }));
    expect(socket.sent).toContain(JSON.stringify({ type: "pong" }));
    expect(handlers.onEvent).toHaveBeenCalledWith({ type: "ping" });
  });

  it("drops non-JSON and invalid frames", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { socket, handlers } = await connect();
    socket.emit("not json");
    socket.emit(JSON.stringify({ type: "state", state: { rev: -1 } }));
    expect(handlers.onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("reports close once, and not after a deliberate close()", async () => {
    const first = await connect();
    first.socket.fireError();
    first.socket.fireClose();
    expect(first.handlers.onClose).toHaveBeenCalledTimes(1);

    const second = await connect();
    second.connection.close();
    second.socket.fireClose();
    expect(second.socket.closed).toBe(true);
    expect(second.handlers.onClose).not.toHaveBeenCalled();
  });
});
```

**Test:** `apps/kiosk/src/data/adapters/http/http-client.test.ts` — the WebSocket block above (3 new cases, 5 existing cases now `async`).

**Verify:** `pnpm --filter @eduscope/kiosk test` → 492 passed (3 new). `pnpm verify` → exit 0.

**Commit:** `git add -A && git commit -m "feat(kiosk): bind the WebSocket to the session cookie"` (includes this plan file with the box ticked)

### T31 — Kiosk talks to core-api in dev: `VITE_API_MODE=http` + Vite proxy
- [ ] done

**Files:** `apps/kiosk/.env.development`, `apps/kiosk/vite.config.ts`

**Context:** M08 scope: "`VITE_API_MODE=http` in `.env.development` from now on; `mock` still selectable", Vite proxy `/api` + `/ws` → `:3000` (ARCHITECTURE §2 dev topology). No `changeOrigin`: the browser's `Host` (`localhost:5173` or `<arch-ip>:5173`) must reach core-api unchanged for the origin check. Mock mode: `VITE_API_MODE=mock pnpm --filter @eduscope/kiosk dev` (a shell variable beats `.env.development`).

**Do:**
1. Replace the whole file `apps/kiosk/.env.development`:
```text
VITE_API_MODE=http
```
2. Replace the whole file `apps/kiosk/vite.config.ts`:
```ts
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: /api and /ws go to core-api on :3000 (ARCHITECTURE §2). No changeOrigin: core-api's origin
// check compares Origin with the Host the browser used (localhost:5173 or <arch-ip>:5173).
const CORE_API = "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: CORE_API },
      "/ws": { target: CORE_API, ws: true },
    },
  },
});
```

**Test:** None (config).

**Verify:** 1. `pnpm verify` → exit 0.
2. `pnpm dev`; open `http://localhost:5173`: S1 shows live values (Podium PC selected, projector "Standby · confirmed by draw" 3 W, AC "Unknown", "3 reporting"), status "All systems normal", padlocks on every card (view). DevTools → Network → WS `/ws`: frames `snapshot`, `state`, `ping` (every 10 s). Ctrl+C.
3. `VITE_API_MODE=mock pnpm --filter @eduscope/kiosk dev`; `http://localhost:5173` shows the mock room (mock panel with `?mock-panel`). Ctrl+C.

**Commit:** `git add -A && git commit -m "feat(kiosk): http mode with the Vite proxy"` (includes this plan file with the box ticked)

### T32 — Acceptance walk-through (M08 criteria)
- [ ] done

**Files:** this plan file only (tick the boxes; write any failure under `## Blockers` and stop).

**Context:** every M08 acceptance criterion with its exact check, in an order that avoids interference (AC5 locks
PIN entry for 127.0.0.1 — every dev browser goes through the Vite proxy — for 60 s, so it runs after AC1–AC4).
Write the observed result next to each item in your report. "Desktop" = Chromium on this machine, "phone" = a phone
on the same Wi-Fi. `<arch-ip>` = the `Network:` address Vite prints.

**Do:**
1. **AC1.** `HW_FAKE_TIME_SCALE=60 pnpm dev` (D13: the hw variable is `HW_FAKE_TIME_SCALE`, not `FAKE_TIME_SCALE`).
   Desktop: `http://localhost:5173`; phone: `http://<arch-ip>:5173`. Both show the same values (lights front on, rear
   off; Podium PC; mic 62 / PC 38; projector Standby 3 W). Phone: padlock on every S1 card header (view), no Lock
   button. `curl -s localhost:3000/api/health` → `"hw":"up"`.
2. **AC2.** Phone: tap "Rear of room" → S4 opens → room PIN `1234` → tap "Rear of room" again (the first tap is not
   replayed). Within 1 s the desktop toggle turns on and the desktop shows the toast "Rear of room turned on · from
   phone"; the phone shows no toast for its own command. Then `curl -s -XPOST http://127.0.0.1:8081/v1/_fake/lights/by_hand`
   → `{"ok":true}`; both clients show "Rear of room turned off · by hand".
3. **AC3.** Desktop: unlock with `1234` (tap any control). Projector **Power on**: the state line shows "Power on sent ·
   waiting for draw", then "Warming up" (amber, 12–48 W), then "On · confirmed by draw" 287 W, on both clients
   (scale 60 makes the ramp ~1 s; if you miss it, Power off and on again). Power off walks "Cooling down" → "Standby".
4. **AC4.** Run from the repo root:
```sh
B='{"client_cmd_id":"6f1c2a8e-1b2c-4d3e-8f90-123456789abc","body":{"kind":"lights.set","gang":"rear","on":true}}'
curl -s -w ' %{http_code}\n' -XPOST localhost:3000/api/commands -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d "$B"
curl -s -c /tmp/ec-m08.jar -XPOST localhost:3000/api/session/login -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{"level":"control","pin":"1234","label":"laptop"}'; echo
curl -s -b /tmp/ec-m08.jar -w ' %{http_code}\n' -XPOST localhost:3000/api/commands -H 'content-type: application/json' -H 'origin: http://evil.example' -d "$B"
curl -s -b /tmp/ec-m08.jar -w ' %{http_code}\n' -XPOST localhost:3000/api/commands -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d "$B"
```
   Expected, in order: `{"code":"unauthorized","message":"Enter the room PIN"} 401`; a ClientSession with
   `"access":"control"`; `{"code":"forbidden","message":"Cross-origin request refused"} 403`; a Command with
   `"status":"pending"` and ` 202`.
5. **AC5.**
```sh
for i in 1 2 3 4 5 6; do curl -s -w ' %{http_code}\n' -XPOST localhost:3000/api/session/login -H 'content-type: application/json' -H 'origin: http://localhost:3000' -d '{"level":"control","pin":"0000","label":"laptop"}'; done
```
   Expected: four `{"reason":"wrong",…,"attempts_left":4…1} 401`, then `{"reason":"locked","retry_after_s":60,"attempts_left":0} 429`
   twice. Wait 60 s before unlocking any dev browser again. Ctrl+C `pnpm dev`.
6. **AC6.** Three terminals: A `pnpm --filter @eduscope/kiosk dev`, B `pnpm --filter @eduscope/core-api dev`,
   C `HW_FAKE_TIME_SCALE=60 pnpm dev:hw`. Desktop + phone open, phone unlocked with `1234`. Ctrl+C in C: both clients
   show the red status "Hardware service offline" at once; a light toggle in the first 10 s shows the inline "Command
   failed"; after 10 s every card shows its offline state (Lights "Switch offline · last known state", values greyed)
   and controls are disabled. Restart C: within ~2 s status "All systems normal" and live values return, no reload.
7. **AC7.** Ctrl+C in B: both clients show the amber "Reconnecting…", after 10 s the red "Can't reach R-101 controller"
   with Retry. Restart B: "Back online" (green, 2 s) and fresh values. Ctrl+C A, B, C.
8. **AC8.** `pnpm --filter @eduscope/kiosk build && pnpm --filter @eduscope/core-api build`. Terminal C:
   `pnpm dev:hw`. Terminal B (repo root):
   `PORT=3000 DB_PATH=/tmp/eduscope-m08/eduscope.db COOKIE_SECRET=m08-acceptance-cookie-secret-0123456789 INITIAL_ROOM_PIN=1234 INITIAL_TECH_PIN=123456 KIOSK_DIST=apps/kiosk/dist node apps/core-api/dist/main.js`.
   `curl -s -o /dev/null -w '%{http_code} %{content_type}\n' localhost:3000/devices` → `200 text/html; charset=utf-8`.
   Desktop: `http://localhost:3000/` shows S1 live; typing `http://localhost:3000/devices` in the address bar loads S2
   directly; reload works.
9. **AC9.** Ctrl+C B; start it again with `LOCALHOST_IS_KIOSK=true` added in front. Desktop `http://localhost:3000`:
   no padlocks, no Lock button, controls work without a PIN; `curl -s localhost:3000/api/session` →
   `"client_type":"kiosk"`, `"label":"room screen"`, `"access":"control"`. Phone `http://<arch-ip>:3000` (and
   `curl -s http://<arch-ip>:3000/api/session` from this machine) → `"client_type":"remote"`, `"access":"view"`.
10. **AC10.** Ctrl+C B; `rm -f /tmp/eduscope-m08/eduscope.db*`; start B again (as in AC9), Ctrl+C, start again,
   Ctrl+C. Then:
```sh
pnpm --filter @eduscope/core-api exec node -e "const D=require('better-sqlite3');const d=new D('/tmp/eduscope-m08/eduscope.db',{readonly:true});console.log(d.prepare('select (select count(*) from devices) devices,(select count(*) from ir_commands) ir,(select count(*) from settings) settings').get())"
```
   → `{ devices: 12, ir: 16, settings: 4 }` (settings = 2 PIN hashes, interlock bypass, kWh baseline once the meter
   reported; 3 if hw was not running). Run it again after another restart: same numbers. Ctrl+C C.
11. **AC11.** `pnpm verify` → exit 0; core-api reports **205 passed**. Coverage map:
    every domain rule, table-driven with a fixed clock → `test/domain/*.test.ts`; auth (401/403 by level, startup
    failure, origin, throttle, expiry, kiosk on/off, kiosk row off-loopback) → `test/routes/{session,origin,commands}.test.ts`,
    `test/auth/*.test.ts`; dispatcher outcomes (confirmed, assumed, failed, timed_out, hw down, LWW) →
    `test/commands/{dispatcher,correlation}.test.ts`; all `fixtures/hw` events → `test/hw/stream.test.ts`; WS snapshot,
    fan-out to N sockets, monotonic `rev` → `test/routes/realtime.test.ts`.
12. **Scope check.** `git diff --stat m08-start -- services` → empty (no hw-service change);
    `git diff --stat m08-start -- apps/kiosk` → only `.env.development`, `vite.config.ts`, `http-client.ts`,
    `http-client.test.ts`.
13. Tick every T1–T32 box.

**Verify:** all items above as stated.

**Commit:** `git commit -am "docs: M08 acceptance walk-through"`


## Checkpoints

- After T14: the whole domain exists and is tested; nothing to look at. `pnpm --filter @eduscope/core-api test` → {core} passed.
- After T28: "Human: skim `apps/core-api/src/app.ts` — plugin order errors → cookie → auth → origin-check → websocket +
  realtime → `/api` routes → static (ARCHITECTURE §6.1)."
- After T29: "Human: `pnpm dev:hw` + `pnpm --filter @eduscope/core-api dev`; `curl -s localhost:3000/api/state | head -c 300`
  shows `"connection":{"hw":"up"}` and `"All systems normal"`."
- After T31: "Human: run `pnpm dev`, compare `http://localhost:5173` with screen 01 at 1280×800 and at 390×844 — same
  layout as the mock, now with live values (projector Standby 3 W, AC Unknown, padlocks while view)."

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- A `HW_FAKE_*` route to make the next hw ack fail, so H6a "Couldn't reach the blaster" can be seen in the browser
  without stopping the blaster (today: `/v1/_fake/ir/blaster_offline` gives the 409 path instead).
- Log the stream's `onInvalid` reasons into `event_log` (today only pino).
- Push a `session` event after each command so `expires_at` on the client tracks idle resets (nothing reads it yet).
- Rate-limit `GET /api/session` row creation per IP (a LAN script could create many view rows; they expire in 7 days).
- Mesh card: show online routers next to paired (M05-L2 follow-up in the UI, D7).
