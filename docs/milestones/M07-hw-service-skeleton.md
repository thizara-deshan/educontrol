# M07 — hw-service skeleton (fake drivers)
Depends on: M01            Machine: Arch        Est: ½ day

## Goal
Stand up the FastAPI hw-service with the module pattern, all eight capability modules running on
fake drivers, the SSE event stream and fake-only simulation routes. At the end it runs on Arch,
answers every hw contract endpoint, streams a snapshot then events, and its pydantic models are
proven in sync with the zod contract fixtures.

## Scope
- ARCHITECTURE §3.4 (hw contract), §7.1, §7.2, §7.3.
- `services/hw`: `pyproject.toml` (uv; fastapi, uvicorn, pydantic v2, pydantic-settings,
  sse-starlette; dev: pytest, pytest-asyncio, httpx, ruff with `ANN` rules), `uv.lock`.
- `app/main.py` (`create_app`, lifespan, `/v1/health`, `/v1/snapshot`, `/v1/events`, refuses a
  non-loopback `HW_HOST`), `config.py`, `registry.py` (`HW_MODE` + `HW_DRIVERS` override),
  `events.py` (EventBus, per-subscriber bounded queue, 5 s heartbeat), `contracts.py`.
- Modules (`router.py`, `service.py` with `Protocol`, `schemas.py`, `driver_fake.py`,
  `driver_real.py` raising `NotImplementedError("hardware intake pending")`): `lights`,
  `projector_power`, `ir`, `hdmi`, `projection_screen`, `audio`, `sensors`, `zigbee_status`.
- Fake behaviour: lights/relay/hdmi/screen/audio state echoes as events; projector power ramps
  with `FAKE_TIME_SCALE` when an IR "power on/off" code is sent to the projector; IR learn returns
  a random opaque code after 3 s (scaled) or times out; sensors emit periodic readings; zigbee
  nodes from config with LQI/battery; permit join emits `joining_until`.
- `/v1/_fake/<module>/<event>` routes (fake mode only): by-hand light change, node offline,
  coordinator offline, sensor value, blaster offline, power-meter offline.
- `tests/`: one test file per module + `test_contract_fixtures.py` (every
  `packages/contracts/fixtures/hw/*.json` parses with its pydantic model and round-trips equal).
- Root `pnpm hw:check`, `hw:test`, `hw:lint` scripts wired into `pnpm verify`; `pnpm dev`
  starts hw-service alongside the kiosk.

## Out of scope
Real drivers (Hxx). MQTT client (`transports/mqtt.py` is an empty placeholder module with the
`[ASSUMED]` note). core-api integration (M08).

## Acceptance criteria
1. `uv run --directory services/hw uvicorn app.main:app --port 8081` starts; `curl
   127.0.0.1:8081/v1/health` → `{"ok":true,"mode":"fake","modules":{…8 modules: "fake"}}`.
2. `curl -N 127.0.0.1:8081/v1/events` prints a `snapshot` event first, then `heartbeat` every
   5 s and periodic `sensors.reading` events.
3. With the stream open in one terminal, `curl -XPOST 127.0.0.1:8081/v1/lights/set -d
   '{"gang":"rear","on":true}' -H 'content-type: application/json'` returns `{"ok":true}` and the
   stream shows `lights.state {"gang":"rear","on":true}`.
4. Sending the projector power-on code via `/v1/ir/send` with `FAKE_TIME_SCALE=60` produces
   `projector_power.reading` events rising through 5–50 W to ~287 W.
5. `POST /v1/_fake/lights/by_hand` emits a `lights.state` event without any command.
6. Starting with `HW_HOST=0.0.0.0` exits with an error message; `HW_DRIVERS=lights=real` shows
   `lights: real` in health and `POST /v1/lights/set` returns `{"ok":false,"error":{"code":
   "transport",…}}` rather than crashing.
7. Invalid body (`{"gang":"middle"}`) → 422.
8. `pnpm verify` green; it now includes ruff check, ruff format check and pytest; deleting a field
   from one pydantic schema makes `test_contract_fixtures.py` fail (then restore it).

## Notes for the planner
- The fixture filename → model mapping is defined in `packages/contracts/fixtures/README.md`
  (M01). Fixtures are read from `../../packages/contracts/fixtures/hw` relative to the test file.
- Every pydantic model uses `ConfigDict(extra="forbid")`; field names identical to zod.
- Friendly names, node list, coordinator info come from config (`app/config.py`), not literals in
  drivers.
- `sse-starlette` `EventSourceResponse`; a slow subscriber whose queue fills is disconnected.
- Keep the fake deterministic under a seed so tests are stable.
