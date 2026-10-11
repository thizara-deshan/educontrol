# M08 — core-api: live state & control
Depends on: M06, M07            Machine: Arch        Est: 1 day

## Goal
Build core-api as the single source of truth: Fastify serving the SPA, REST and WS on one
origin, SQLite via Drizzle, PIN sessions with server-enforced roles, the in-memory state store
with all domain rules, the hw-service client and event stream, the command dispatcher, and
WebSocket fan-out to every client. The kiosk switches to `VITE_API_MODE=http` and two browsers
stay in sync against fake hardware.

## Scope
- ARCHITECTURE §2, §5, §6.1–6.7.
- `apps/core-api`: `main.ts`, `app.ts` (`buildApp(deps)`), `config.ts` (zod env: `PORT`, `HOST`,
  `DB_PATH`, `HW_URL`, `COOKIE_SECRET`, `ROOM_ID`, `ROOM_HOSTNAME`, `LOCALHOST_IS_KIOSK`,
  `INITIAL_ROOM_PIN`, `INITIAL_TECH_PIN`, `KIOSK_DIST`, timeouts).
- `db/`: full Drizzle schema (all tables in §6.2, so M09 adds no tables), `drizzle-kit` config,
  first generated migration, `migrate()` on boot, idempotent `seed.ts` (R-101 devices, AC 13
  setpoint commands + projector 2 commands as `code: null`, PIN hashes from env on first boot).
- `plugins/`: `errors`, `auth` (cookie session, `requireAccess`, startup failure if a non-GET
  route lacks `config.access`), `origin-check`, `realtime` (WS hub, snapshot on connect, ping,
  hello label, per-session `session` events, client list), `static` (SPA + history fallback).
- Routes: `session` (get/login/lock), `state`, `commands`, `health`.
- PIN: scrypt hashes, per `(ip, level)` 5 wrong → 60 s, global 20/min, `retry_after_s`.
- Sessions: control 2 h idle, technician 15 min (kiosk 2 min), 15 s sweep, kiosk exemption from
  loopback when `LOCALHOST_IS_KIOSK=true`.
- `domain/`: state-store (rev, 50 ms coalesced broadcast, derived recompute) and every rule module
  (projector R1/R2/H7b, ac R3/R4, audio R9, lights R6, sensors R13 with 10 s staleness timer,
  interlock R11, status S1.E4, attribution H13), kWh today from midnight baseline.
- `hw/`: client (timeouts per transport), stream (`eventsource-parser`, backoff, 15 s dead
  detection), ingest; hw-down behaviour §6.7.
- `commands/`: dispatcher + policies for every `CommandBody` kind, LWW, correlation, `activity`.
- Kiosk: http adapter used for real (`VITE_API_MODE=http` in `.env.development` from now on;
  `mock` still selectable), Vite proxy `/api` + `/ws` → `:3000`.
- Root `pnpm dev` runs hw (fake) + core-api (`:3000`, `LOCALHOST_IS_KIOSK=false`) + kiosk.
- SPEC: §2.3–2.5 server side, S1.E2–E4, S1.E9, all S1 control behaviour, S2 data, S4 server side,
  H1–H19, H24, H25 (server), R1–R4, R6, R7, R9–R14.

## Out of scope
IR learn/test routes, schedule, device registry, PIN change, system routes, scheduler (M09). Pi
deployment (M10).

## Acceptance criteria
1. `pnpm dev`, open `http://localhost:5173` in Chromium and `http://<arch-ip>:5173` on a phone on
   the same Wi-Fi: both show the same live state; the phone is `view` with padlocks.
2. Phone enters room PIN (seeded from `INITIAL_ROOM_PIN`) → controls unlock; toggling "Rear of
   room" on the phone updates the desktop within 1 s with toast "Rear of room turned on · from
   phone". `curl -XPOST http://127.0.0.1:8081/v1/_fake/lights/by_hand` → both show "· by hand".
3. Projector Power on (with `FAKE_TIME_SCALE=60` on hw) walks waiting → warming up → "On ·
   confirmed by draw" on both clients.
4. `curl -XPOST localhost:3000/api/commands -H 'content-type: application/json' -H 'origin:
   http://localhost:3000' -d '{…lights.set…}'` without a cookie → 401; with a room-PIN cookie but a
   foreign `origin` header → 403; with a room-PIN cookie → 202.
5. Six wrong PINs via curl in a row → 429-style `PinError {reason:"locked", retry_after_s≈60}`.
6. Stop hw-service: within 10 s both clients show status red "Hardware service offline", devices
   offline with last values greyed, commands fail with an inline error. Restart it: state
   recovers without a page reload.
7. Stop core-api: clients show "Reconnecting…" then "Can't reach R-101 controller". Restart:
   "Back online" and fresh values.
8. `pnpm --filter @eduscope/core-api build && node dist/main.js` with `KIOSK_DIST` set serves the
   built SPA at `http://localhost:3000/` and deep links like `/devices` load directly.
9. `LOCALHOST_IS_KIOSK=true`: a browser on `http://localhost:3000` has `client_type: kiosk`, no
   padlocks, no Lock button; the same page from another machine is `view`.
10. Deleting the DB file and restarting recreates it via migrations + seed; restarting again does
    not duplicate seed rows.
11. `pnpm verify` green, with Vitest covering: every domain rule (table-driven, fixed clock); auth
    (every mutating route 401/403 by level, startup failure on a route missing `access`, origin
    check, throttle, expiry, kiosk exemption on/off, kiosk session rejected from non-loopback);
    dispatcher outcomes (confirmed, assumed, failed, timed_out, hw down, LWW supersede); hw stream
    parsing of all `fixtures/hw` events; WS: snapshot on connect, fan-out to N sockets, `rev`
    monotonic.

## Notes for the planner
- Add: `@fastify/static`, `@fastify/websocket`, `@fastify/cookie`, `fastify-type-provider-zod`,
  `eventsource-parser`, `drizzle-orm`, `drizzle-kit`, `better-sqlite3`.
- `trustProxy: false`. Loopback check uses `request.socket.remoteAddress`.
- Tests build the app with `buildApp({db: ":memory:", hw: fakeHwClient, clock: fixedClock})` and
  use `fastify.inject`; no ports opened.
- Domain rules are pure functions over `(state, event, now)`; the store composes them. Don't put
  rule logic in routes or ingest.
- Seed IR command rows exist but have no code; projector/AC commands therefore fail with
  "Command failed" until M09 learns codes — dispatcher precondition `ir_code_missing` with a
  clear message. For the projector demo in criterion 3, seed fake codes in dev only
  (`SEED_FAKE_IR_CODES=true`).
- WS never carries IR codes or PIN data.
