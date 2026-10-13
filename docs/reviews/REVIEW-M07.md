# REVIEW-M07 — hw-service skeleton (fake drivers)

Reviewed: 2026-10-14 · Range: `git diff m07-start..HEAD` (82 files, +4366/−24; 77 are under `services/hw`, plus `package.json` and
the plan) · Inputs: `docs/milestones/M07-hw-service-skeleton.md`, `docs/plans/PLAN-M07-hw-service-skeleton.md`, `CLAUDE.md`,
`docs/SPEC.md`.
Method: Verify-all; every acceptance curl run against a real uvicorn (fake mode, scripted, one server per scenario);
the AC8 mutation check; greps over the diff. No UI in this milestone, so no screenshots, no two-context check.

**Verdict: PASS.** AC1–AC8 pass. **0 MUST-FIX**, 1 LATER.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck | `pnpm -r typecheck` (inside `pnpm verify`) | ✅ |
| Tests | `pnpm -r test` | ✅ kiosk 489 tests; contracts green |
| hw lint | `pnpm hw:lint` | ✅ ruff `All checks passed!`, `77 files already formatted` |
| hw tests | `pnpm hw:test` | ✅ pytest `133 passed` (`-m "not hardware"`) |
| Whole gate | `pnpm verify` | ✅ exit 0 |
| Build | `pnpm build` | ✅ exit 0 (kiosk chunk warning is the known M02-L1) |
| Scope | `git diff --stat m07-start -- apps packages` | ✅ empty (no kiosk, core-api or contract change) |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Starts; `/v1/health` → `ok`, `mode: fake`, 8 modules `fake` | **PASS** | `{"ok":true,"mode":"fake","modules":{"lights":"fake","projector_power":"fake","ir":"fake","hdmi":"fake","projection_screen":"fake","audio":"fake","sensors":"fake","zigbee_status":"fake"}}` |
| 2 | `/v1/events`: `snapshot` first, `heartbeat` every 5 s, periodic `sensors.reading` | **PASS** | Stream over 13 s with `HW_FAKE_REPORT_INTERVAL_S=3`: first block `event: snapshot`; `heartbeat` ×2 (≈5 s apart); `sensors.reading` (×2 per tick) and `projector_power.reading` every 3 s. Listener: `127.0.0.1:8081` only. |
| 3 | `POST /v1/lights/set {"gang":"rear","on":true}` → `{"ok":true}` and a `lights.state` on the stream | **PASS** | Ack `{"ok":true}`; stream `{"type":"lights.state",…,"data":{"gang":"rear","on":true}}`. |
| 4 | IR power-on with `FAKE_TIME_SCALE=60` → `projector_power.reading` rising 5–50 W to ~287 W | **PASS** | Env name is `HW_FAKE_TIME_SCALE` (plan D5, CLAUDE.md prefix rule). Readings in 5 s: 12.0, 24.0, 36.0, 48.0, 160.0, 287.0 W. |
| 5 | `POST /v1/_fake/lights/by_hand` emits `lights.state` with no command | **PASS** | `{"ok":true}`; stream shows a second `lights.state` (rear flipped back to `false`). Route is 404 in real mode (`test_real_mode_has_no_fake_routes`). |
| 6 | `HW_HOST=0.0.0.0` exits with an error; `HW_DRIVERS=lights=real` → `lights: real`, `lights/set` → `transport` error, no crash | **PASS** | Prints `HW_HOST must be a loopback address (127.0.0.1), got '0.0.0.0'`, `exit=1`, no traceback. With `lights=real`: health shows `"lights":"real"`, others `fake`; set → `{"ok":false,"error":{"code":"transport","message":"lights: hardware intake pending"}}`; health still `200`. See L1 for the limit of the host guard. |
| 7 | `{"gang":"middle"}` → 422 | **PASS** | `422`. |
| 8 | `pnpm verify` green incl. ruff check, ruff format check, pytest; removing a pydantic field fails `test_contract_fixtures.py` | **PASS** | §1. Deleting `volts: NonNegative` from `projector_power/schemas.py` → `3 failed, 30 passed` (`event.projector_power.reading`, `event.snapshot`, `response.snapshot`; the line occurs in two models and `sed` removed both, so 3 not the plan's 1). Restored with `git checkout` → `33 passed`; `git status` clean. |

Not applicable: visual diff, 390px, two browser contexts, pending/assumed/failed/offline UI states (no UI). The hw-side offline states
(`blaster_offline`, `meter_offline`, `node_offline`, `coordinator_offline`) are covered by the module tests and reached through the
fake routes.

## 3 Code review (diff)

Checked and clean:
- **Contracts at the boundary:** every request body, response and event is a pydantic model with `extra="forbid"` (`HwModel`);
  all 33 zod fixtures parse and round-trip; no contract change on the zod side.
- **Module pattern:** all 8 modules have `schemas / service(Protocol) / driver_fake / driver_real / router`; services and routers
  never touch hardware; real drivers raise `NotImplementedError("hardware intake pending")` and are reported as `transport`.
- **Secrets / names / ports:** no PINs, secrets or hardcoded friendly names in drivers; names, nodes and coordinator come from
  `app/config.py` (`HW_` prefix). Port 8081 appears only in the `dev:hw` script.
- **No `reference/` imports, no `noqa`/`type: ignore`.** One `Any` (`FakeTasks.spawn`, `Coroutine[Any, Any, None]`) is the
  standard typing for a coroutine and does not hide an error.
- **Pi portability:** pure-Python deps, Python 3.11 pinned (`.python-version`), `uv.lock` committed, no arch-specific wheels,
  no absolute paths.
- **Listening:** only `127.0.0.1:8081`; nothing binds `0.0.0.0`.
- **Mutating routes / roles:** hw-service has no sessions by design (plan D12); its access control is the loopback bind. The
  mutating `/v1/_fake/*` routes are mounted only for modules running a fake driver.
- **Tests:** each module has a test file; events, config, registry, main and SSE-over-HTTP are covered. No snapshot tests.

## 4 Findings

| ID | Class | Finding |
|---|---|---|
| M07-L1 | LATER | The loopback guard validates the `HW_HOST` setting, not the socket uvicorn actually binds. `uvicorn app.main:app --host 0.0.0.0` (the CLI flag) passes the guard and listens on the LAN. Today every launcher passes `127.0.0.1` (`dev:hw`, default), so nothing is exposed. Make the bind and the guard one thing: M10's systemd unit must pin `--host 127.0.0.1`, or run uvicorn from `app/__main__.py` using `settings.host`. |

**MUST-FIX: none.**
