# REVIEW-M09 — core-api: settings & scheduler

Reviewed: 2026-10-14 · Range: `git diff m09-start..HEAD` (67 files, +2480/−91; `apps/core-api` only, plus `services/hw` IR fake
and its tests) · Inputs: `docs/milestones/M09-core-api-settings.md`, `docs/plans/PLAN-M09-core-api-settings.md`, `CLAUDE.md`, `docs/SPEC.md`.
Method: Verify-all; every criterion run against an isolated stack (hw fake :18081, core-api :13000 serving the built kiosk, fresh DB,
real time) with curl and a `ws` client; headless Chromium (system `chromium`, Playwright 1.64) at 1280×800 and 390×844 for S3; read
of all of `apps/core-api/src` in the diff.

**Verdict: PASS.** AC1–AC11 pass (UI-only strings partly CAN'T VERIFY, see §2). **0 MUST-FIX**, 7 LATER.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | ✅ |
| Lint | `pnpm lint` (eslint) · `pnpm hw:lint` (ruff check + format) | ✅ · ✅ `All checks passed!`, 77 files formatted |
| Tests | contracts 136 · kiosk 492 · core-api **327** (51 files) · hw pytest **134** | ✅ |
| Build | `pnpm build` | ✅ (kiosk 500 kB chunk warning = M02-L1) |
| Scope | `git diff --stat m09-start..HEAD -- apps/kiosk packages apps/core-api/drizzle` | ✅ empty (no kiosk, contract or migration change) |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Remote config lists AC (14) / Projector (2) from DB; Re-learn → listening → captured; Test → Yes → "tested ✓"; persists | **PASS** | UI after login: AC and Projector from DB (AC shows 15 because AC3 had added 31°). Learn `202`; `ir_capture` listening then captured ≈3 s; `test` `202`; `test-result {reacted:true}` → `test:"reacted"`. Fresh page load shows "Tuya code · tested ✓ 8 min ago". Second learn while listening → `409 Another capture is running`; test during capture → 409. Countdown / "Captured · now test it" strings not observed in the browser (kiosk unchanged, covered by M05/M06 tests). |
| 2 | Hw "nothing received" → "Nothing received"; stored code unchanged | **PASS** | `ir_capture` listening → `timeout` exactly 20.0 s later (`deadline` + 20 s); `captured_at` unchanged (`14:12:31.002Z`). "Projector still powers on" not re-run (code column untouched). |
| 3 | + Add 31 °C, capture: S1's + goes to 31° | **PASS** | create `201`, duplicate 31° → `409 A 31° setpoint already exists`; learn → `captured`; `available_setpoints` `[18…30]` → `[18…31]` in the WS snapshot of both sockets. |
| 4 | Projector transport mcu → "Epson · via MCU" | **PASS** | `PATCH /api/devices/projector {"transport":"ir_mcu"}` `200`; `invalidate [["devices"],["ir","devices"]]` + `state` with `["Projector","Epson","ir_mcu"]` on both sockets; reverted. Non-IR device → `409 Only IR devices change transport`. |
| 5 | Timed action fires: toast "· by schedule", lights off | **PASS** | Action at 19:51 (+2 min): activity "Front of room turned off" / "Rear of room turned off" `by:"schedule"` at 19:51:01 on the phone socket; lights confirmed off. |
| 6 | Class block end → remote control session drops to `view`, "Locked · enter PIN to control" | **PASS** | Phone (control) → `session` event `access:"view"` at block end (19:50:01), `GET /api/session` view. Technician session untouched. |
| 7 | Room PIN change: old fails, new works, other control sessions locked | **PASS** | Phone unlocked → `PUT /settings/pins/room {"pin":"4321"}` `204` → phone `view`; login `1234` `401`, `4321` `200`; invalid PIN `400`; restored. Technician (caller) stays unlocked. |
| 8 | Permit joining → "Open · 4:00 left" on every client | **PASS** | `202`; both sockets receive `joining:{state:"open",until:+240 s}`; `seconds:60` → `400`. Countdown text itself not watched (kiosk M05 tests). |
| 9 | Network lists hostname, address, clients; About uptime + QR for `ROOM_HOSTNAME` | **PASS** | `archlinux.local`, `172.16.24.10`, `wifi` (SSID/signal via nmcli — the AP really is named "Loading…"), clients `[laptop technician, phone view]`; about `{room:"R-101",version:"0.0.0",uptime_s:607,pi_model:"unknown",url:"http://r-101.local"}`. QR not screenshotted. Restart: not executed (would kill the stack); unit-tested (`system/restart.test.ts`, `routes/system.test.ts`). |
| 10 | Every new route 401/403 for `view`/`control` | **PASS** | The plan's curl block against :13000: 50 lines, 25 × `none 401`, 25 × `control.jar 403`. `access.test.ts` covers the same 25 routes. |
| 11 | `pnpm verify` green with the listed Vitest coverage | **PASS** | §1. Learn/test transitions `ir/service.test.ts`, `routes/ir.test.ts`; setpoint rebuild `domain/ac`, `registry-sync`, `routes/devices`; due-calc `domain/schedule.test.ts`; block-end `scheduler/scheduler.test.ts`; PIN invalidation `routes/settings.test.ts`; access `routes/access.test.ts`. |

## 3 Visual diff (S3 Remote configuration, 1280×800 and 390×844, vs `reference/screens/03-settings-remote-config.png`)

No kiosk file changed in M09, so differences are inherited; M09 only made the screen real.
- Added vs reference: **Lock** button in the header (remote clients, by design M03).
- AC row count is amber (and "untested" amber) where the reference shows green 14 / plain "captured": state colouring of untested codes, from `state-styles`; the reference predates the untested state.
- Layout, type and copy otherwise match; side panels (Blaster, Fallback) identical.
- 390 px: no horizontal scroll (`scrollWidth ≤ innerWidth`), no console errors, tabs and list reachable. ≥48 px targets not re-measured (no kiosk change).
- Pending / assumed / failed / offline states and two-context propagation: pushes verified on two WS clients (§2); the mock-adapter state switches were not exercised, as M09 does not touch the adapter.

## 4 Code review of the diff

Checked: zod at boundaries (all bodies/params via contracts, hw learn result parsed with `HwIrLearnResult`), hex literals (none), tests for new logic (present), hw code outside the module pattern (only the fake driver, with tests), hard-coded secrets (only the pre-existing dev script values, M08-L5), Pi portability (`nmcli` and `/proc/device-tree/model` fail soft, no shell, `RESTART_COMMAND` split and spawned without a shell, paths via `paths.ts`), mutating routes without role check (every route declares `config.access: "technician"`; guard refuses to start otherwise), listeners (core-api default `0.0.0.0`; hw stays 127.0.0.1).

**MUST-FIX: none.**

LATER (appended to `docs/milestones/M00-index.md` → Backlog):

| ID | Finding |
|---|---|
| M09-L1 | `requireBlaster` comment says ir_mcu needs the ESP32 online, but only `ir_zs06` is checked: learn/test on an ir_mcu device is attempted blind. |
| M09-L2 | Class-block end drops **every** remote control session, even one unlocked outside that block, or when the next block starts at the same minute; SPEC §2.3 says "the *current* block". |
| M09-L3 | S3e Restart and the "Back online" banner were not driven in a browser; M08-L7 (HW fail-next-ack route + inline failed-command error) was not picked up by the M09 walk-through. |
| M09-L4 | The IR fake's re-learn stores a random code, so after AC1 the fake projector no longer reacts to S1 (AC2 must run first). Add `/v1/_fake/ir/next_code`. |
| M09-L5 | `DELETE /api/devices/:id` lets a technician remove devices S1 needs (projector, AC, lights); no confirmation or guard. |
| M09-L6 | After a PIN change or class-block end no `event_log` row records the sessions ended per client (only a count), and refused permit-join / failed restart are not logged. |
| M09-L7 | `touch` extends `expires_at` but no `session` event is pushed (M08-L4 still open; M09 widened the set of touching routes). |

Process note: while looking for the plan's AC10 script I ran `/tmp/ec-m09-ac10.sh` once as written, against the developer's own stack on :3000
(guard rejections only; it left one `control` "laptop" session row in that dev DB). The recorded results come from my isolated stack.
