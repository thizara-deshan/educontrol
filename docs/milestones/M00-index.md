# M00 — Milestone index

Inputs: `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md` · Status: v1, 2026-10-11

| ID | Title | Depends on | Machine | Est | Status |
|---|---|---|---|---|---|
| [M01](M01-foundation.md) | Foundation | — | Arch | ½ day | todo |
| [M02](M02-shell-data-layer.md) | App shell & data layer | M01 | Arch | 1 day | todo |
| [M03](M03-access-kiosk.md) | Access & kiosk behaviour | M02 | Arch | ½ day | todo |
| [M04](M04-control-page.md) | Control page (S1) | M03 | Arch | 1 day | todo |
| [M05](M05-devices-page.md) | Devices page (S2) | M04 | Arch | ½ day | todo |
| [M06](M06-settings.md) | Settings (S3, S3b–S3e) | M05 | Arch | 1 day | todo |
| | **── FRONTEND COMPLETE GATE ──** click through every screen with `VITE_API_MODE=mock` at 1280×800 in `chromium --kiosk` and at 390px | | | | |
| [M07](M07-hw-service-skeleton.md) | hw-service skeleton (fake drivers) | M01 | Arch | ½ day | todo |
| [M08](M08-core-api-live.md) | core-api: live state & control | M06, M07 | Arch | 1 day | todo |
| [M09](M09-core-api-settings.md) | core-api: settings & scheduler | M08 | Arch | ½ day | todo |
| [M10](M10-pi-deploy.md) | Pi deploy | M09 | Pi | ½ day | todo |
| Hxx | *(reserved — created by hardware intake, prompt 07)* | M10 | Pi | — | — |
| [M99](M99-hardening.md) | Hardening & final acceptance | M10, all Hxx done | Pi | ½ day | todo |

**Schedule fit:** Day 1 M01 + start M02 · Day 2 M02, M03, M04 · Day 3 M05, M06 (frontend
gate) · Day 4 M07–M10 · Days 5–6 Hxx · Day 7 M99. Days 2 and 4 are tight; overflow uses the
Day 7 buffer.

Status values: `todo` · `planned` (PLAN exists) · `in progress` · `review` · `done`.

---

## Coverage check: every SPEC element → milestone

UI milestones build the element against the mock; server milestones make it real. "Hxx" = the
real hardware driver arrives through intake. No SPEC element is unassigned.

### Cross-cutting sections

| SPEC | Milestone(s) |
|---|---|
| §1 core principle (server truth + confidence) | M02 (data layer, `state-styles`), M08 (server) |
| §2.1 client types, URL | M03 (kiosk vs remote), M08 (localhost detection), M10 (`r-101.local`) |
| §2.2 breakpoints, phone layouts | M02 (frame, Header), M04 (S1 phone), M05 (S2 phone), M06 (S3 phone), M03 (S4 phone) |
| §2.3 access levels, session ends | M03 (UI), M08 (enforcement, expiry), M09 (class-block end) |
| §2.4 multi-client, LWW, slider rules | M02 (pending, toasts), M04 (LevelSlider), M08 (fan-out, LWW) |
| §2.5 connection states | M02 (UI), M08 (real WS), M99 (end-to-end) |
| §2.6 kiosk specifics | M03 (app), M10 (Chromium flags, OS blanking) |
| §3.1–3.3 tokens, typography, shape | M01 (tokens.css), M02 (components) |
| §3.4 state language | M02 (`state-styles`, StateDot, ObservedLine) |
| §6 domain model | M01 (zod), M08/M09 (DB + store) |

### S1 Control

| ID | Milestone(s) | | ID | Milestone(s) |
|---|---|---|---|---|
| S1.E1 | M02 | | S1.E23 | M04, M08 |
| S1.E2 | M02, M08 (server time) | | S1.E30 | M04 |
| S1.E3 | M02, M08 | | S1.E31 | M04, M08, Hxx |
| S1.E4 | M02 (header slot), M04 (tap → S2), M08 (status) | | S1.E32 | M04, M08, Hxx |
| S1.E5 | M02 | | S1.E33 | M04, M08, Hxx |
| S1.E6 | M02 | | S1.E34 | M04, M08 |
| S1.E7 | M02 (button), M03 (technician gate) | | S1.E35 | M04, M08, Hxx |
| S1.E8 | M03, M08 | | S1.E36 | M04, M08, Hxx |
| S1.E9 | M02, M08 | | S1.E37 | M04 |
| S1.E10 | M04 | | S1.E38 | M04, M08 |
| S1.E11 | M04, M08, Hxx (Q1) | | S1.E39 | M04, M08 |
| S1.E12 | M04, M08, Hxx (Q1) | | S1.E40 | M04, M08 |
| S1.E13 | M04, M08, Hxx | | S1.E41 | M04, M08 |
| S1.E14 | M04, M08, Hxx | | S1.E42 | M04, M08, Hxx |
| S1.E15 | M04, M08, Hxx | | S1.E43 | M04, M08, Hxx |
| S1.E16 | M04 | | S1.E44 | M04, M08, Hxx |
| S1.E17 | M04, M08, Hxx (Q2) | | S1.E45 | M04, M08, Hxx |
| S1.E18 | M04, M08, Hxx (Q2) | | S1 view-only presentation | M03 (padlocks), M04 (per card) |
| S1.E20 | M04 | | S1 phone BottomNav | M04 |
| S1.E21 | M04, M08, Hxx (Q8) | | | |
| S1.E22 | M04, M08, Hxx (Q8) | | | |

### S2 Zigbee devices

| ID | Milestone(s) | | ID | Milestone(s) |
|---|---|---|---|---|
| S2.E1 | M05 | | S2.E13 | M05 |
| S2.E2 | M05 | | S2.E14 | M05 |
| S2.E3 | M05, M08, Hxx | | S2.E15 | M05 |
| S2.E4 | M05 (reuses M03 gate) | | S2.E16 | M05, M08, Hxx |
| S2.E5 | M05 | | S2.E17 | M05, M08, Hxx |
| S2.E6 | M05, M08, Hxx | | S2.E18 | M05, M08, Hxx |
| S2.E7 | M05, M08 | | S2.E19 | M05 |
| S2.E8 | M05, M08 | | S2.E20 | M05, M08, Hxx |
| S2.E9 | M05 | | S2.E21 | M05, M08, M09 (permit join), Hxx (Q4) |
| S2.E10 | M05, M08, Hxx | | S2.E22 | M05, M08 (R7) |
| S2.E11 | M05, M08, Hxx | | S2.E23 | M05, M08 (R11), Hxx (Q7) |
| S2.E12 | M05, M08 (kWh today), Hxx | | | |

### S3 Settings, S4 PIN, S5 banner

| ID | Milestone(s) | | ID | Milestone(s) |
|---|---|---|---|---|
| S3.E1 | M06 | | S3.E12 | M06, M09 |
| S3.E2 | M06 | | S3.E13 | M06 |
| S3.E3 | M06 (+ M03 Lock) | | S3.E14 | M06, M09, Hxx |
| S3.E4 | M06 | | S3.E15 | M06, M09, Hxx |
| S3.E5 | M06 | | S3.E16 | M06, M09 |
| S3.E6 | M06 | | S3.E17 | M06 |
| S3.E7 | M06, M09 | | S3b Network | M06, M09 |
| S3.E8 | M06, M09 | | S3c Schedule | M06, M09 |
| S3.E9 | M06, M09 | | S3d Devices + PINs | M06, M09 |
| S3.E10 | M06, M08 (blaster state), Hxx | | S3e About | M06, M09, M10 (restart unit) |
| S3.E11 | M06 | | S5 banner | M02, M08 |
| S4.E1–E5 | M03, M08 (login, throttle) | | | |

### Hidden states

| ID | Milestone(s) | | ID | Milestone(s) |
|---|---|---|---|---|
| H1 | M02, M08 | | H13 | M02, M08 |
| H2 | M02, M08, M99 | | H14 | M04, M08 |
| H3 | M02, M08, M99 | | H15 | M04, M05, M08 |
| H4 | M02, M08, M99 | | H16 | M05, M08 |
| H5 | M02, M08 | | H17 | M03, M08 |
| H6a | M02, M08 | | H18 | M04, M08 |
| H6b | M02, M08 | | H19 | M04, M08 |
| H7 | M04, M08 | | H20 | M06, M09 |
| H7b | M04, M08 | | H21 | M06, M09, Hxx |
| H8 | M04, M05, M08, M99 | | H22 | M06, M09 |
| H9 | M04, M05, M08, M99 | | H23 | M03, M10 |
| H10 | M04, M05, M08 | | H24 | M03, M08 |
| H11 | M04, M05, M08 | | H25 | M04, M06, M08, M09 |
| H12 | M03, M04 | | | |

### Rules

| ID | Milestone(s) | | ID | Milestone(s) |
|---|---|---|---|---|
| R1 | M04 (mock), M08 | | R9 | M04 (mock), M08 |
| R2 | M04, M08, Hxx | | R10 | M04, M08 |
| R3 | M04, M08 | | R11 | M05, M08, Hxx (Q7) |
| R4 | M04, M08, M09 (setpoint data) | | R12 | M02, M08 |
| R5 | M06, M09 | | R13 | M04, M05, M08 |
| R6 | M04, M08, Hxx | | R14 | M03, M08 |
| R7 | M05, M08 | | R15 | M03 |
| R8 | M06, M09, Hxx | | | |

### Provisional (assigned, but blocked on an open question)

| Element | Question | Built as | Settled in |
|---|---|---|---|
| S1.E11/E12 read-back | Q1 | confirmed + assumed variants both supported | Hxx |
| S1.E17/E18 screen | Q2 | two-state, confirmed | Hxx |
| S2.E21 mesh count | Q4 | whatever the coordinator reports | Hxx |
| AC −/+ while off | Q5 | disabled | decision record if changed |
| S2.E23, R11 interlock | Q7 | ARCHITECTURE §6.4 guess | Hxx |
| Slider while muted | Q8b | unmute all | decision record if changed |
| Timeouts, staleness | Q12 | ARCHITECTURE §6.3 defaults | Hxx |
| Client labels | Q19 | auto form factor + `?podium=1` | — |
| AC setpoints | Q23 | 13 setpoints, cool, auto fan (seed) | Hxx |
| H23 real backlight | D-16 | in-app overlay only | future Hxx if wanted |

---

## Backlog

LATER items from reviews. Not scheduled; a milestone plan picks one up only by listing it as a task.

| ID | From | Item | Where |
|---|---|---|---|
| M01-L1 | REVIEW-M01 | `engines.node` is `>=22`, not a Node 22 pin; pin to `22.x` (+ `engine-strict`) or record a decision allowing newer majors | `package.json` |
| M01-L2 | REVIEW-M01 | Contracts `src/` gets Node types from `tsconfig.json`; split so only `test/`, `scripts/` see `types: ["node"]` (contracts are bundled into the browser) | `packages/contracts/tsconfig.json` |
| M01-L3 | REVIEW-M01 | "No hex outside `tokens.css`" is only a manual grep; enforce it in `pnpm verify` (ESLint `no-restricted-syntax` or a `check:tokens` script) | root scripts / `eslint.config.js` |
| M01-L4 | REVIEW-M01 | Radius demo on the temporary swatch page can't show 10/8/6px at 360px width (moot once M02 replaces the page) | `apps/kiosk/src/app/TokenSwatches.tsx` |
| M01-L5 | REVIEW-M01 | `--radius: 8px` duplicates `--radius-btn`; use `var(--radius-btn)` | `apps/kiosk/src/styles/tokens.css` |
| M02-L1 | REVIEW-M02 | Mock adapter + mock panel are in the production bundle (582 kB chunk); code-split behind `VITE_API_MODE` | `apps/kiosk/src/data/create-api-client.ts`, `app/dev/` |
| M02-L2 | REVIEW-M02 | Kiosk Vite dev server binds 0.0.0.0 (`server.host: true`); make LAN exposure opt-in | `apps/kiosk/vite.config.ts` |
| M02-L3 | REVIEW-M02 | Mock tabs don't share state, so two-browser sync can't be checked before M08; optionally share `FakeRoom` via `BroadcastChannel` | `apps/kiosk/src/data/adapters/mock/` |
| M02-L4 | REVIEW-M02 | Floating mock panel covers gallery content at 1280 and 390; start collapsed or dock to the bottom | `apps/kiosk/src/app/dev/MockPanel.tsx` |
| M02-L5 | REVIEW-M02 | Sheet close button keeps shadcn `hover:` styling and a 16px target (unused today) | `apps/kiosk/src/ui/sheet.tsx` |
| M02-L6 | REVIEW-M02 | `sendCommand` throws a `ZodError` on an invalid request instead of `ApiRequestError("bad_response")` | `apps/kiosk/src/data/adapters/http/http-client.ts` |
| M03-L1 | REVIEW-M03 | Mock panel is open by default and sits above the PIN overlay, so at 390 it covers the lower-right keypad keys; start collapsed or collapse while S4 is open (extends M02-L4) | `apps/kiosk/src/app/dev/MockPanel.tsx` |
| M03-L2 | REVIEW-M03 | Mock PINs `1234` / `123456` ship in the production bundle with the mock adapter; keep them out of the Pi build with the M02-L1 code-split | `apps/kiosk/src/data/adapters/mock/fake-room.ts` |
| M03-L3 | REVIEW-M03 | `/favicon.ico` 404 (console error) on every load | `apps/kiosk/index.html` |
| M03-L4 | REVIEW-M03 | `LockButton` duplicates the `HEADER_BUTTON_CLASS` string from `Header.tsx`; share one class from `components/` | `components/LockButton.tsx`, `app/Header.tsx` |
| M03-L5 | REVIEW-M03 | (Not reproduced, from code reading) `computeControlGate` returns `locked` while the session is still loading, so a padlock badge may flash before `/api/session` answers | `apps/kiosk/src/data/gate.ts` |
| M04-L1 | REVIEW-M04 | At 390 the collapsed mock panel still covers the bottom bar's Audio/Environment segments; dock it above the bar below `sm` or start it hidden (extends M02-L4, M03-L1) | `apps/kiosk/src/app/dev/MockPanel.tsx` |
| M04-L2 | REVIEW-M04 | While dragging a level slider the big number shows the server value; only the thumb follows the finger. Show the dragged level in the number too | `features/control/audio/LevelCard.tsx`, `components/LevelSlider.tsx` |
| M04-L3 | REVIEW-M04 | Quick AC −/+ taps are dropped while one is pending (H5, correct), so manual and scripted step tests need ≥1.5 s between taps; document it in the mock panel or in the plan's walk-through | `data/commands/command-sender.ts` |
| M05-L1 | REVIEW-M05 | The collapsed mock panel covers the Shutdown interlock card at 1280×800 and the first battery card at 390; dock it or start it hidden (extends M02-L4, M03-L1, M04-L1) | `apps/kiosk/src/app/dev/MockPanel.tsx` |
| M05-L2 | REVIEW-M05 | With one router offline, Mesh shows "Routers 2" (accent) beside the amber "ONE ROUTER LEFT" callout; decide in M08 whether `mesh.routers` means paired or online and show it consistently | `features/devices/side/side.view.ts` |
| M06-L1 | REVIEW-M06 | Mock seeds every AC setpoint 18–30 °C, so adding "25°" creates a duplicate; nothing rejects a duplicate setpoint/name. Decide the rule in M09 and mirror it in the sheet validation and the mock | `data/adapters/mock/fake-ir.ts`, `features/settings/remote/forms.ts` |
| M06-L2 | REVIEW-M06 | Overlapping class blocks are accepted (10:00–11:30 beside 10:15–12:15); SPEC has no rule. Add one in M09 (and the sheet) or document it | `features/settings/schedule/schedule-form.ts` |
| M06-L3 | REVIEW-M06 | Mock panel "Fail/Time out next command" only affects room commands; settings mutations can't be made to fail, so their inline error states can't be seen | `data/adapters/mock/fake-room-settings.ts`, `app/dev/MockPanel.tsx` |
| M06-L4 | REVIEW-M06 | Collapsed mock panel still covers the lower right of Settings at 1280 and the page bottom at 390 (extends M02-L4, M03-L1, M04-L1, M05-L1) | `app/dev/MockPanel.tsx` |
| M06-L5 | REVIEW-M06 | `vite preview` (like dev, M02-L2) listens on all interfaces; only core-api may bind 0.0.0.0. Make LAN exposure opt-in for both | `apps/kiosk/vite.config.ts` |
| M06-L6 | REVIEW-M06 | Mock restart takes ~9 s to "Back online" (plan says 6–8 s); BLASTER offline caption wraps in the 22% column. Cosmetic | `data/adapters/mock/fake-room-settings.ts`, `features/settings/remote/BlasterCard.tsx` |
| M07-L1 | REVIEW-M07 | The loopback guard checks `HW_HOST`, not the socket uvicorn binds; `uvicorn app.main:app --host 0.0.0.0` passes it and listens on the LAN. Pin `--host 127.0.0.1` in the M10 systemd unit, or launch uvicorn from `app/__main__.py` with `settings.host` | `services/hw/app/main.py`, `deploy/pi/` |
| M08-L1 | REVIEW-M08 | History fallback answers `200 index.html` for missing assets (`/assets/nope.js`); fall back only for paths without a file extension, 404 otherwise | `apps/core-api/src/plugins/static.ts` |
| M08-L2 | REVIEW-M08 | `GET /api/session` creates a `sessions` row + cookie per cookieless request; a LAN script can add unbounded rows (7-day sweep). Rate-limit per IP or create the row lazily at login | `routes/session.ts`, `plugins/auth.ts` |
| M08-L3 | REVIEW-M08 | `ec_sid` has no `maxAge`: a browser restart gets a new row/`public_id` and the old row lingers 7 days; set `maxAge` ≥ the view-row TTL | `plugins/auth.ts` |
| M08-L4 | REVIEW-M08 | `touch` extends `expires_at` in the DB but no `session` event is pushed, so the client's expiry goes stale; push after `touch` | `routes/commands.ts` |
| M08-L5 | REVIEW-M08 | The `dev` script hardcodes the dev cookie secret and PINs 1234/123456 in tracked `package.json`; move to a git-ignored env file | `apps/core-api/package.json` |
| M08-L6 | REVIEW-M08 | PIN throttle race: `check()` precedes the async scrypt verify and `fail()` follows it; 60 parallel wrong PINs → 16 evaluated before the lock (not 5). Bounded by the global 20/min lock. Reserve the attempt before verifying | `routes/session.ts`, `auth/pin-throttle.ts` |
| M08-L7 | REVIEW-M08 | Failed-command inline error and the "Back online" banner not seen in a real browser against core-api; add an `HW_FAKE_*` "fail next ack" route and re-check in M09's walk-through | `services/hw/app/` fake routes, M09 walk-through |
| M09-L1 | REVIEW-M09 | `requireBlaster` only checks the ZS06; an `ir_mcu` device's learn/test is attempted without checking the ESP32 is online | `ir/service.ts` |
| M09-L2 | REVIEW-M09 | Class-block end drops every remote control session, not only those of the current block (SPEC §2.3); back-to-back blocks also drop sessions at the boundary | `scheduler/scheduler.ts`, `domain/schedule.ts` |
| M09-L3 | REVIEW-M09 | S3e Restart and "Back online" not driven in a browser; M08-L7 (HW fail-next-ack route, failed-command inline error) not picked up by the M09 walk-through | `services/hw/app/` fake routes, M10 walk-through |
| M09-L4 | REVIEW-M09 | IR fake re-learn stores a random code so the fake projector stops reacting after AC1; add `/v1/_fake/ir/next_code` | `services/hw/app/modules/ir/driver_fake.py` |
| M09-L5 | REVIEW-M09 | `DELETE /api/devices/:id` removes any device (projector, AC, lights) with no guard | `routes/devices.ts` |
| M09-L6 | REVIEW-M09 | Sessions ended by PIN change / block end are logged only as a count; refused permit-join and failed restart are not in `event_log` | `routes/settings.ts`, `routes/devices.ts`, `routes/system.ts` |
| M09-L7 | REVIEW-M09 | `touch` extends `expires_at` without pushing `session` (M08-L4 still open, now reached by more routes) | `plugins/auth.ts` |
