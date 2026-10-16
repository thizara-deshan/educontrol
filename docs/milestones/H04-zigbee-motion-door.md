# H04 — Zigbee motion (SNZB-03P) and door (SNZB-04PR2) sensors live
Depends on: H03            Machine: Pi            Est: ½ day

## Goal
Make the room's motion and door sensors real. The real `sensors` driver from H03 also reads the
SNZB-03P (`r101_motion`) and the SNZB-04PR2 (`r101_door`) through zigbee2mqtt. At the end, the S1
OCCUPANCY and DOOR tiles and the S2 "Motion" / "Door" rows show the real state of R-101, and S1.E41
reads "3 of 3 reporting".

## Scope
- Facts: "Observed on the Pi" below (live capture 2026-10-16); ARCHITECTURE §7.1, §7.2
  (`sensors` row); H03 `sensors/driver_real.py`; H01 `transports/mqtt.py` (`MqttLink`).
- `services/hw/app/modules/sensors/driver_real.py`: also subscribe to `<base>/<motion_node>` and
  `<base>/<door_node>`. Every message with a boolean `occupancy` emits one `occupancy`
  `sensors.reading` for `motion_node` (`true` → `detected`, `false` → `clear`). Every message with a
  boolean `contact` emits one `contact` reading for `door_node` (`true` → `closed`, `false` → `open`).
  A missing / non-boolean field emits nothing; other keys (`battery`, `battery_low`, `tamper`,
  `linkquality`, `motion_timeout`, `voltage`, `update`) are ignored. Never raises on a bad payload
  (log and drop). The climate behaviour from H03 is unchanged.
- `services/hw/app/config.py`: `DEFAULT_NODES` entries `r101_motion` → confirmed `ieee`
  `0x18690afffe1ca686`, `r101_door` → confirmed `ieee` `0xa4c138128a8fffff`; models and the
  `motion_node` / `door_node` friendly names are now confirmed (drop `[ASSUMED]` for those only).
- Tests with the in-memory MQTT client (`tests/fake_mqtt.py`), payloads copied from the capture
  below: subscribes to the three nodes; occupancy true/false → detected/clear; contact true/false →
  closed/open; a tamper-only report repeats the door state; missing / non-bool values → nothing;
  each topic parses only its own kind; non-object payloads on every topic → warning, nothing;
  snapshot keeps the latest of each kind; reconnect keeps all three subscriptions.
- `@pytest.mark.hardware` test: `<base>/r101_motion/availability` and `<base>/r101_door/availability`
  are `online` within 5 s (as H03 does for `r101_temp`).
- `deploy/pi/README.md` and the `deploy/pi/env/hw.env.example` comment: motion and door report since
  H04. `HW_DRIVERS` does **not** change (`sensors=real` since H03).

## Out of scope
Pairing (done 2026-10-16, see below). Real `zigbee_status` driver — S2 battery %, LQI, last seen
from zigbee2mqtt, real permit join. `tamper` and `battery_low` (no contract field). Changing the
SNZB-03P `motion_timeout`, OTA, zigbee2mqtt `retain` or reporting configuration, any change to
`/opt/zigbee2mqtt/data/`. Any automation from occupancy / door (SPEC Q26). Any SPEC, contract, UI
or core-api change.

## Acceptance criteria
1. `curl 127.0.0.1:8081/v1/health` shows `sensors: real` (and still `ir: real`).
2. Pulling the magnet away from the door sensor makes S1 DOOR read "Open" (amber) within 5 s;
   putting it back makes it "Closed". The value matches `contact` in
   `mosquitto_sub -t zigbee2mqtt/r101_door`. The S2 "Door" row shows the same and its last seen updates.
3. Waving at the motion sensor makes S1 OCCUPANCY read "Detected" (green) within 5 s; after nobody
   moves in its view for > 60 s it reads "Clear". The S2 "Motion" row shows the same.
4. With all three sensors fresh, S1.E41 reads "3 of 3 reporting"; both tiles show their model
   (`SNZB-03P`, `SNZB-04PR2`), never the fake values.
5. `sudo systemctl restart zigbee2mqtt` and `sudo systemctl restart mosquitto` while hw-service
   runs: the next door report after recovery reaches S1 with no hw-service restart.
6. Door closed and nobody in the room for 70 min (> the 60 min rule): record every `r101_motion` / `r101_door` report
   time and whether the OCCUPANCY / DOOR tiles go stale (R13, 60 min) — input for decision 2.
7. `uv run --directory services/hw pytest -m hardware` passes on the Pi; `pnpm verify` green.

## Notes for the planner

### Observed on the Pi (2026-10-16, zigbee2mqtt 2.14.2, channel 25)
- Paired with permit join via `bridge/request/permit_join {"time":254}` (two windows, 11:42 and
  11:48); both interviews `successful`, vendor `SONOFF`, `supported: true`. Each device left and
  re-joined once during pairing (second button press); harmless. Renamed via
  `bridge/request/device/rename`. Permit join closed afterwards (`{"time":0}`).
- SNZB-04PR2: `ieee_address` `0xa4c138128a8fffff` → `r101_door`.
  SNZB-03P: `ieee_address` `0x18690afffe1ca686` → `r101_motion`, firmware `installed_version` 8705.
- `zigbee2mqtt/<node>/availability` → `{"state":"online"}` for both.
- State topics are **not retained** (nothing on subscribe), as for `r101_temp`.
- Door, captured (each message carries the full state; `tamper` toggles produce reports with an
  unchanged `contact`; `true` = magnet at the body = closed):
  ```json
  {"battery":100,"battery_low":false,"contact":false,"linkquality":189,"tamper":false}
  {"battery":100,"battery_low":false,"contact":false,"linkquality":185,"tamper":true}
  {"battery":100,"battery_low":false,"contact":true,"linkquality":189,"tamper":true}
  {"battery":100,"battery_low":false,"contact":false,"linkquality":196,"tamper":true}
  ```
  `tamper: true` = back cover not fully closed.
- Motion, captured (`motion_timeout` 60 s; detected at 11:49:09, clear only at 11:58:16 — the sensor
  stays "detected" while it keeps seeing movement and sends nothing in between):
  ```json
  {"battery":100,"linkquality":182,"motion_timeout":60,"occupancy":true,"update":{"installed_version":8705,"latest_release_notes":null,"latest_source":null,"latest_version":8705,"state":"idle"},"voltage":3100}
  {"battery":100,"linkquality":182,"motion_timeout":60,"occupancy":false,"voltage":3100}
  ```
- Raw capture: `~/h04-pairing-capture.log` on the Pi.

### Decisions this milestone needs (planner: put in `## Blockers` if not settled)
1. **Repeated readings.** A tamper-only (or battery) report repeats `contact`/`occupancy`.
   Recommended: emit the reading every time — it refreshes "last seen" (R13), and the kiosk wakes
   only on the transition to `detected` (H23), so repeats are harmless.
2. **Event-sensor staleness.** core-api marks occupancy / door stale when the node was last seen
   > 60 min ago (R13, `EVENT_SENSOR_STALE_MS`). Until a real `zigbee_status` driver lands, last seen
   only moves on a reading, and both sensors report only on change; a shut door in an empty room
   may send nothing for hours, so the tile would go stale (H10) while correct. Options: accept and
   measure (acceptance 6), fixed later by a real `zigbee_status` driver; or change the 60 min rule
   (SPEC R13, needs a decision record). Recommended: accept and measure.
3. **After a restart** there is no retained state: tiles stay "No reading yet" until the next
   report (as H03 decision 3). Recommended: accept.

- Follow the H03 driver: one subscription per node, `parse(node, payload)` helpers, same logging.
- The module is read-only: no router changes; `sensors` is already in the MQTT-module set.
- S2 battery %, LQI for both nodes keep coming from the fake `zigbee_status` config values.
