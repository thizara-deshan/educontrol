# PLAN-H05 — Re-pair the Zigbee sensors and IR blaster from Settings
Milestone: none (owner request 2026-10-18) · Start tag: `h05-start` · Verify-all: `pnpm verify`
Status: **draft — the owner accepts D1–D6 before T1 starts.**

## Goal

R-101's four Zigbee devices (`r101_ir` ZS06/TS1201, `r101_temp` SNZB-02P, `r101_motion` SNZB-03P, `r101_door`
SNZB-04PR2) are shared with the Eduscope Unistream Radxa board, which has **its own** USB coordinator. A Zigbee device
belongs to one network at a time, so moving them to Central means factory-resetting each device and joining it to the
Pi's coordinator. Swaps are rare (demo/test). A technician must be able to do this from **Settings → Devices** in the
Central UI and see each device come back, with no SSH, no zigbee2mqtt frontend and no config edit.

## What is true today (checked on the Pi 2026-10-18)

- zigbee2mqtt 2.14.2 still lists all four devices with their friendly names (`configuration.yaml` `devices:` and
  `bridge/devices`). A device that rejoins with the same IEEE address gets its old friendly name back `[ASSUMED]`
  (zigbee2mqtt keeps per-IEEE settings in `configuration.yaml`; confirmed by T5). hw-service finds devices by friendly
  name (`HW_*_NODE`), so nothing else needs reconfiguring.
- **Settings → Devices already has "Permit joining"** (`features/settings/devices/PermitJoinCard.tsx` → core-api
  `POST /api/zigbee/permit-join` (technician) → hw `POST /v1/zigbee_status/permit_join`). But the Pi runs
  `HW_DRIVERS=ir=real,sensors=real`, so **`zigbee_status` is the fake driver**: the button shows a 4-min countdown and
  zigbee2mqtt never opens; S2's coordinator, mesh counts and node list are config data (they include
  `r101_lights` / `r101_proj_plug`, which do not exist). `RealZigbeeStatusDriver` is a stub (`NotImplementedError`).
- zigbee2mqtt bridge API (read from `/opt/zigbee2mqtt/dist/extension/bridge.js`): request
  `bridge/request/permit_join` `{"time": <s>}` → `bridge/response/permit_join` `{"status":"ok"|"error",…}`;
  `bridge/info` (retained: `permit_join`, `permit_join_end` ms epoch, `coordinator`, `network.channel`);
  `bridge/devices` (retained list); `bridge/event` `device_joined` / `device_interview` / `device_announce` /
  `device_leave`. `<node>/availability` `{"state":"online"|"offline"}` (availability is enabled). `advanced.last_seen`
  is `disable`.
- IR codes live in core-api's database (`ir_commands.code`), not in the blaster, so a reset ZS06 needs no re-learning.
- A factory reset puts the SNZB-03P's `motion_timeout` back to 60 s (owner set 15 s on 2026-10-16 by hand).

## Decisions (owner to accept)

- **D1 — Real `zigbee_status` on the Pi.** Implement `RealZigbeeStatusDriver` on zigbee2mqtt and switch the Pi to
  `HW_DRIVERS=ir=real,sensors=real,zigbee_status=real`. Consequence: S2 lists only devices zigbee2mqtt knows; the
  registry devices `lights` and `projector plug` (still fake modules) show link "unknown" instead of fake "online".
- **D2 — No contract change.** Everything the UI needs fits `HwZigbeeNode` / `HwCoordinator` / `HwMeshData`:
  - `online` ← `<node>/availability`; `device_leave` → `false`.
  - `last_seen` ← time of the latest message on `<node>`, or a `device_joined` / `device_announce` /
    `device_interview successful` event for it (zigbee2mqtt's own last_seen is disabled).
  - `lqi` ← `linkquality`, `battery_pct` ← `battery` from `<node>` messages; `null` until seen.
  - `role` ← `type` (`Router` → `router`, `EndDevice` → `end_device`); `power_source` ← `power_source`
    (`Battery` → `battery`, else `mains`); `model` ← `definition.model` else `model_id`.
  - Coordinator: `firmware` ← `bridge/info` `coordinator.meta.revision`, `channel` ← `network.channel`, `status`
    online while MQTT is connected and `bridge/state` is `online`; `model`, `chipset`, `tx_power_dbm`, `port`,
    `antenna` from `HW_COORDINATOR` as today.
  - Mesh `joining_until` ← `bridge/info` `permit_join_end` (null when `permit_join` is false).
  - The Coordinator entry in `bridge/devices` is not a node.
- **D3 — "Pair devices" card in Settings → Devices** (technician, same gate as Permit joining). One row per registry
  device with transport `zigbee` or `ZS06` and an `hw_ref` that zigbee2mqtt reports, plus every configured
  `HW_*_NODE` it does not (shown as "Never heard"). Each row shows: name, model, the reset step for that model, and
  status "Heard just now" (≤ 60 s), "Last heard 3 h ago", "Never heard", or "Offline" (availability false). It lives
  next to the existing Permit joining button. Reset steps (static text in the kiosk view, `[ASSUMED]` until T5):
  - SNZB-02P, SNZB-03P, SNZB-04PR2: hold the button about 5 s until the LED flashes.
  - ZS06 / TS1201: hold the reset pin about 5 s until the LED flashes fast.
  Why "heard" rather than "online": a battery device that left for the Radxa stays `online` in zigbee2mqtt for up
  to 25 h (passive availability timeout), so only a fresh message proves it is back.
- **D4 — `motion_timeout` survives a re-pair.** New setting `HW_MOTION_TIMEOUT_S` (int 5–60, default 15). When a
  `<motion_node>` report carries a different `motion_timeout`, the sensors driver publishes
  `<motion_node>/set {"motion_timeout": <value>}`, at most once per 60 s. Removes the manual step after every swap.
- **D5 — Joining window unchanged:** 4 min (SPEC S3d), for all devices at once. No "close early" button (not asked).
- **D6 — The Radxa side is out of scope.** Moving the devices back to the Unistream uses that board's own pairing.
  This plan does not remove devices from zigbee2mqtt when they leave, so moving back to Central keeps the names.

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `services/hw/app/modules/zigbee_status/driver_real.py` | Replace | D1/D2 zigbee2mqtt bridge driver (T1) |
| `services/hw/app/registry.py` | Modify | pass `MqttLink` to `RealZigbeeStatusDriver` (T1) |
| `services/hw/tests/fixtures/z2m/*.json` | Create | `bridge/info`, `bridge/devices`, availability and event payloads captured on this Pi (T1) |
| `services/hw/tests/test_zigbee_status_real.py` | Create | driver against `FakeMqtt` (T1) |
| `services/hw/app/config.py`, `modules/sensors/driver_real.py`, `tests/test_sensors_real.py` | Modify | D4 (T2) |
| `apps/kiosk/src/features/settings/devices/{pairing.view.ts,pairing.view.test.ts,PairDevicesCard.tsx,DevicesTab.tsx}` | Create/Modify | D3 card (T3) |
| `apps/kiosk/src/data/adapters/mock/*` | Modify | mock nodes get `last_seen` updates during joining so the card works in `VITE_API_MODE=mock` (T3) |
| `deploy/pi/env/hw.env.example`, `deploy/pi/README.md` | Modify | `zigbee_status=real`, `HW_MOTION_TIMEOUT_S`; "Moving the sensors between Central and Unistream" (T4) |

## Executor notes

- Repo root `/home/eduscope/edcontrol` on the R-101 Pi. `git tag h05-start` on the commit that adds this plan.
- `[ON PI · HUMAN]` steps need root or a person at the devices: ask the owner to run the `!`-prefixed command or to
  press the device buttons. Never work around sudo. Never touch `/opt/zigbee2mqtt/data/` except reading it.
- After each task: its Verify, then `pnpm verify`; tick the box; one commit with the task's message.
- Never edit SPEC, ARCHITECTURE, milestones or other plans.

## Tasks

### T1 — hw: real zigbee_status driver on zigbee2mqtt
- [ ] done

**Do:**
1. Capture fixtures on the Pi (read-only): `mosquitto_sub -C 1` of `zigbee2mqtt/bridge/info`,
   `zigbee2mqtt/bridge/devices`, `zigbee2mqtt/r101_ir/availability`; one `bridge/response/permit_join` (send
   `{"time": 0}`, which keeps joining closed). Strip `network_key` and `config` from `bridge/info`.
2. `RealZigbeeStatusDriver(settings, mqtt)`: in `start()` subscribe `bridge/info`, `bridge/devices`, `bridge/event`,
   `bridge/state`, `bridge/response/permit_join`, and `<node>` + `<node>/availability` for every configured
   `HW_*_NODE` that is real hardware (ir, temp, motion, door). Map per D2 and emit `zigbee.node` /
   `zigbee.coordinator` / `zigbee.mesh` only on change. `permit_join(seconds)`: publish
   `bridge/request/permit_join {"time": seconds}`, wait ≤ `mqtt_publish_timeout_s` + 1 s for the response; `ok` →
   `ACK_OK` (the mesh event follows from `bridge/info`); error / timeout / not connected →
   `ack_error("device_offline", …)` as the fake does.
3. Registry builds it with the shared `MqttTransport` (as sensors/ir do).
4. Tests (`FakeMqtt`, fixtures): node mapping incl. Coordinator skipped; availability → online; `device_leave` →
   offline; message/`device_joined` → `last_seen`; `linkquality`/`battery` picked up; `permit_join_end` → mesh;
   permit_join publishes `{"time": 240}` and maps ok / error / timeout / disconnected.

**Verify:** `uv run --directory services/hw pytest -m "not hardware" tests/test_zigbee_status_real.py`
**Commit:** `feat(hw): real zigbee_status driver on zigbee2mqtt (H05 T1)`

### T2 — hw: re-apply the motion timeout after a re-pair
- [ ] done

**Do:** `HW_MOTION_TIMEOUT_S: int = Field(default=15, ge=5, le=60)` in `config.py`; in the sensors driver, a motion
report whose `motion_timeout` is an int ≠ the setting publishes `<motion_node>/set {"motion_timeout": N}`, not more than
once per 60 s (monotonic clock, injectable for tests). A publish failure logs a warning and never drops the reading.
Tests: differs → one publish; equals → none; two reports within 60 s → one publish; missing key → none.
**Verify:** `uv run --directory services/hw pytest -m "not hardware" tests/test_sensors_real.py`
**Commit:** `feat(hw): keep the SNZB-03P motion timeout at HW_MOTION_TIMEOUT_S (H05 T2)`

### T3 — kiosk: "Pair devices" card in Settings → Devices
- [ ] done

**Do:** `pairing.view.ts` (pure): registry devices + `zigbee.nodes` + server now → rows per D3 (status thresholds,
reset text by model, unknown model → "See the device manual"). `PairDevicesCard.tsx` renders the rows under the
existing Permit joining card, uses tokens and `components/` only, rows ≥ 48 px, works at 390 px and 1280×800. Mock
adapter: while joining is open, a mock node's `last_seen` updates a few seconds after open so the card can be tried in
mock mode. Tests: `pairing.view.test.ts` (each status, thresholds, unknown model, node missing from z2m).
**Verify:** `pnpm --filter @eduscope/kiosk test -- pairing`
**Commit:** `feat(kiosk): pair devices card in Settings › Devices (H05 T3)`

### T4 — deploy: switch on the real driver and document the swap
- [ ] done

**Do:** `hw.env.example`: `HW_DRIVERS=ir=real,sensors=real,zigbee_status=real`, `# HW_MOTION_TIMEOUT_S=15`.
README: new section "Moving the sensors between Central and Unistream": (1) Settings → Devices → Permit joining,
(2) reset each device per the card, (3) wait for "Heard just now" on all four, (4) S3 IR → Test one AC and one
projector code. Note that `/etc/eduscope/hw.env` is not rewritten by install.sh (needs the T5 edit).
**Verify:** `pnpm pi:lint && pnpm pi:test`
**Commit:** `docs(deploy): zigbee_status real on R-101; moving devices between boards (H05 T4)`

### T5 — `[ON PI · HUMAN]` acceptance: pair all four from the UI
- [ ] done

1. Owner: `! sudo sed -i 's/^HW_DRIVERS=.*/HW_DRIVERS=ir=real,sensors=real,zigbee_status=real/' /etc/eduscope/hw.env`
   then `! sudo deploy/pi/install.sh --kiosk`.
2. S2 shows the real coordinator (ZStack3x0, channel 25) and the zigbee2mqtt nodes only.
3. Settings → Devices → Permit joining: `bridge/info` shows `permit_join: true`; the countdown runs on every client.
4. Owner resets `r101_ir`, `r101_temp`, `r101_motion`, `r101_door` one by one; each row turns "Heard just now";
   zigbee2mqtt keeps each friendly name (record whether the reset steps in D3 were right).
5. S1: climate, occupancy and door tiles update; AC Power on works with no re-learning.
6. Motion: zigbee2mqtt reports `motion_timeout: 15` within a minute of the first motion report.
7. Record the result under "Acceptance" below.
**Commit:** `docs: H05 acceptance`

## Acceptance

(filled by T5)

## Blockers

(none)

## Until this is built

Joining can be opened by hand on the Pi (4 min): `mosquitto_pub -h 127.0.0.1 -t zigbee2mqtt/bridge/request/permit_join
-m '{"time": 240}'`, then reset each device. Afterwards set the motion timeout again:
`mosquitto_pub -h 127.0.0.1 -t zigbee2mqtt/r101_motion/set -m '{"motion_timeout": 15}'`.
