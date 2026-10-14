# REVIEW-M08 — core-api: live state & control

Reviewed: 2026-10-14 · Range: `git diff m08-start..HEAD` (105 files, +6893/−92; `apps/core-api` new, 4 kiosk files, contracts
`health`, `docs/decisions/D-21`) · Inputs: `docs/milestones/M08-core-api-live.md`, `docs/plans/PLAN-M08-core-api-live.md`,
`CLAUDE.md`, `docs/SPEC.md`.
Method: Verify-all; every acceptance criterion run against a real stack (hw fake at `HW_FAKE_TIME_SCALE=60`, core-api, Vite) with
curl, a `ws` client and headless Chromium (system `chromium`, Playwright 1.64: 1280×800 desktop context + 390×844 touch context);
the built `dist/main.js` for AC8–AC10; greps and a read of all of `apps/core-api/src` plus the test list.

**Verdict: PASS.** AC1–AC11 pass (AC1 phone = emulated 390 px touch context on the same machine; AC7 "Back online" banner not
sampled, see §2). **0 MUST-FIX**, 7 LATER.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Whole gate | `pnpm verify` (typecheck + eslint + vitest + ruff + pytest) | ✅ exit 0 |
| Tests | contracts 136 · core-api **205** (34 files) · kiosk 492 (61 files) · hw pytest 133 | ✅ |
| hw lint | ruff check + format | ✅ `All checks passed!`, `77 files already formatted` |
| Build | `pnpm build` (contracts → kiosk → core-api) | ✅ exit 0 (kiosk chunk 730 kB warning = M02-L1) |
| Scope | `git diff --stat m08-start -- services` | ✅ empty; kiosk diff = `.env.development`, `vite.config.ts`, `http-client.ts` + test |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Desktop + phone show the same live state; phone is `view` with padlocks | **PASS** | Desktop 1280×800 and phone 390×844 contexts through `:5173` show identical values (Podium PC, mic 62 / PC 38, projector Standby 3 W, lights front on/rear off); phone has a padlock on every S1 header, no Lock button. LAN-IP origin works through the proxy: login via `http://192.168.1.5:5173` → 200, with a foreign origin → 403. A physical phone was not available. |
| 2 | Phone PIN → unlock; toggle shows on desktop < 1 s with "… from phone"; `by_hand` → "· by hand" | **PASS** | Phone tap → S4 PIN dialog → `1234` → tap; desktop toast "Rear of room turned on" arrived **46 ms** after the tap, phone showed no toast of its own. WS: `changed_by: "phone"` then after `POST /v1/_fake/lights/by_hand` `changed_by: "by hand"` + `activity "Rear of room turned off · by hand"`, on both sockets. |
| 3 | Projector Power on walks waiting → warming up → "On · confirmed by draw" | **PASS** | WS states: `standby` → (power on) `warming_up` ×4 (≈0.7 s) → `running` confirmed; power off walks `cooling_down` ×7 → `standby`. Same on the second (view) socket. |
| 4 | no cookie 401 · foreign origin 403 · cookie 202 | **PASS** | `{"code":"unauthorized",…} 401` · `{"code":"forbidden","message":"Cross-origin request refused"} 403` · Command `pending` `202`. Extras: no Origin 403, `text/plain` 415, `projector.mains` as control 403, bad body 400, `/api/session/lock` without Origin 403. |
| 5 | 6 wrong PINs → `locked`, `retry_after_s≈60` | **PASS** | `wrong` ×4 (`attempts_left` 4…1, 401), `locked` `retry_after_s:60` 429 ×2; correct PIN while locked → 429. See L6 for a burst bypass. |
| 6 | hw stopped: red "Hardware service offline" ≤ 10 s, devices offline greyed, commands fail; restart recovers | **PASS** | Status `fault` 0.5 s after the kill (WS log); command → `503 hw_unavailable "Hardware service offline"`; after 12 s all 12 devices `online:false`, UI shows "… offline · last known state", greyed, values kept. Restart: ~2 s to "All systems normal", live values, no reload. The inline error text in the browser was not exercised (the 503 body was checked with curl). |
| 7 | core-api stopped: "Reconnecting…" → "Can't reach R-101 controller"; restart: "Back online" + fresh values | **PASS** | Amber "Reconnecting…" banner at 3 s; "Can't reach R-101 controller" + Retry at 13 s. After restart the open page recovered to "All systems normal" on its own. The 2 s "Back online" banner was missed by my sampling (CAN'T VERIFY that one string; covered by kiosk M02 tests). |
| 8 | `node dist/main.js` with `KIOSK_DIST` serves SPA and deep links | **PASS** | `/` and `/devices` → `200 text/html; charset=utf-8`; Chromium loads `/devices` directly (Zigbee devices screen); `/api/zzz` → 404 JSON; works with `cwd=/` (migrations via `paths.ts`). See L1. |
| 9 | `LOCALHOST_IS_KIOSK=true`: localhost `kiosk`, no padlocks/Lock; other machine `view` | **PASS** | `localhost` → `client_type:"kiosk"`, `label:"room screen"`, `access:"control"`; same request to `192.168.1.5:3000` → `remote`/`view`; kiosk cookie replayed from the LAN address → fresh `remote` row; `X-Forwarded-For: 127.0.0.1` ignored. Chromium on `localhost:3000`: 0 padlock icons, 0 Lock buttons; command without PIN → 202. |
| 10 | DB deleted → recreated; restart doesn't duplicate | **PASS** | Three boots on a deleted DB: `{devices:12, ir:16, settings:4, sessions:0}` each time. |
| 11 | `pnpm verify` green with the listed Vitest coverage | **PASS** | §1. Mapped test by test: rules table-driven (`test/domain/*`); `assertRouteAccess` + app refusing a route without `access`, origin (`routes/origin`), throttle incl. global, expiry 2 h / 15 min / kiosk 2 min, kiosk on/off, kiosk row from a LAN address; dispatcher confirmed/assumed/failed/timed_out/hw down/LWW; all `fixtures/hw` events through the SSE decoder; WS snapshot, N-socket fan-out, monotonic `rev`. |

## 3 Visual diff (live S1 vs `reference/screens/01-control-page.png`)

Live data renders through the same components as the mock; differences are data or intentional:
- Values differ because the data is live: projector Standby 3 W (reference 287 W running), AC "Unknown" with "—" setpoint (reference
  "On · assumed 24°"), temperature 26.7°/62 % (26.4°/61 %), no "Selected" ring change, date Wed 14 Oct.
- Padlocks on every card header, because the browser is a `view` client (reference is unlocked). Unlocked/kiosk: none (AC9).
- Reference is a design-tool frame at 1883 px wide; the 1280×800 render keeps the three-column layout and **fits without scrolling**
  (`scrollHeight 800 = innerHeight`); header, section labels, cards, copy ("Commanded over IR · state read back from the S60 power
  meter", "Confirmed by the switch", "3 reporting") match.
- Missing/unrendered: nothing missing. Offline (AC6): greyed cards, "… offline · last known state", "IR blaster offline" on
  projector/AC, "No sensors reporting", red "Hardware service offline". Controller down (AC7): amber "Reconnecting…" band, then
  "Can't reach R-101 controller · Retry". Pending/assumed overlays arrive via the same push path as the mock (toast seen in AC2,
  "Power on sent · waiting" walk seen in AC3 states). The *failed* inline error was not rendered in the browser.

390×844: `scrollWidth 390` (no horizontal scroll), every button/switch/slider ≥ 48×48 (0 small targets measured), single column with
the bottom Display/Audio/Environment bar, all cards reachable. PIN dialog (S4) opens on a padlocked tap.

## 4 Code review (diff)

Checked and clean:
- **zod at every boundary:** `Config` (env), `CommandRequest`/`LoginRequest` route bodies via `fastify-type-provider-zod`, `HwEvent`
  on the SSE stream (invalid → dropped + logged), `HwAck` on every hw response, `ClientMessage` on WS frames, `ClientSession.parse`
  and `DeviceKind/Transport.parse` on DB rows, `readSetting(..., schema)` for settings JSON. `HealthResponse` is a contract.
- **Mutating routes:** only `POST /api/commands` (`access: control`; technician kind checked in the dispatcher), `POST
  /api/session/login` and `/lock` (`public: true`). `assertRouteAccess` fails startup for any other non-GET route; all three pass
  the origin check; WS upgrade checks origin too.
- **Listening:** core-api `0.0.0.0:3000` only; hw `127.0.0.1:8081`. (Vite dev `*:5173` is M02-L2/M06-L5, needed for AC1.)
- **Secrets/pins:** none in `src/`; PIN hashes are scrypt with random salt, constant-time compare; `INITIAL_*_PIN` only at first boot.
  See L5 for dev values in the `dev` script.
- **Hardware code** stays in `services/hw`; core-api only speaks HTTP/SSE to it. No `any`, no `as` casts (only `as const` and import
  aliases), no `@ts-ignore`, no raw colours in the diff. IR codes never leave the server (`realtime.test` asserts it).
- **Pi portability:** `better-sqlite3` prebuilt, `node:crypto` scrypt, esbuild bundle, paths resolved from the bundle, port/host from env.
- **Tests:** new logic has tests (205); no snapshot tests; kiosk change has its test.

## 5 Findings

| ID | Class | Finding |
|---|---|---|
| M08-L1 | LATER | History fallback answers `200 index.html` for any non-`/api` GET, including a missing asset (`/assets/nope.js` → `200 text/html`). A stale cached `index.html` after an update then fails with a confusing MIME/syntax error. Only fall back for paths without a file extension, 404 otherwise. `plugins/static.ts` |
| M08-L2 | LATER | `GET /api/session` (and login/lock) creates a `sessions` row + cookie for every cookieless request; a LAN script can add unbounded rows (swept after 7 days). Rate-limit row creation per IP or create the row lazily on first login. `routes/session.ts`, `plugins/auth.ts` |
| M08-L3 | LATER | Cookie is a browser-session cookie (no `maxAge`): after a browser restart the same browser gets a new row/`public_id`, and the old row lingers 7 days. Set `maxAge` ≥ the view-row TTL. `plugins/auth.ts` |
| M08-L4 | LATER | `touch` resets the idle timer in the DB after a command but nothing pushes the new `expires_at` to the client, so the client's copy of the session expiry goes stale (plan nice-to-have). Push `session` after `touch`. `routes/commands.ts` |
| M08-L5 | LATER | The `dev` script hardcodes the dev cookie secret and PINs `1234` / `123456` in `package.json`. Dev-only and plan-mandated, but move them to a git-ignored `.env`/`--env-file` so no PIN literal lives in tracked scripts, and keep `deploy/pi/` (M10) generating real ones. `apps/core-api/package.json` |
| M08-L6 | LATER | PIN throttle race: `check()` runs before the async scrypt verify and `fail()` after it, so a parallel burst slips past the lock. 60 concurrent wrong PINs → 16 evaluated (401) before the lock applied, instead of 5. Bounded by the global 20 failures/min lock, so ≈3× the intended rate, not unbounded. Count the attempt before verifying (reserve, refund on success). `routes/session.ts`, `auth/pin-throttle.ts` |
| M08-L7 | LATER | The failed-command inline error and the "Back online" banner were not seen in a real browser against core-api (checked at API/test level). Add an `HW_FAKE_*` route that fails the next ack (plan nice-to-have) and re-check in M09's walk-through. |

**MUST-FIX: none.**

## 6 Gate

AC1–AC11: **PASS** (AC1 phone emulated; AC7 "Back online" string and AC6 inline error text not sampled in the browser, L7).
**0 fix tasks.** 7 LATER items added to `docs/milestones/M00-index.md` → Backlog (M08-L1 … M08-L7).
