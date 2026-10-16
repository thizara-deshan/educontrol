# H03 — Zigbee climate sensor (SNZB-02P) live
Depends on: H01            Machine: Pi            Est: ½ day

## Goal
Make the room climate sensor real. hw-service gets a real `sensors` driver that reads the
SNZB-02P (`r101_temp`) through zigbee2mqtt over the shared MQTT transport from H01. At the end, the
S1 TEMPERATURE / HUMIDITY tiles and the S2 "Room climate" reading show the real values from R-101.

## Scope
- Facts: "Observed on the Pi" below (live capture 2026-10-16); ARCHITECTURE §7.1, §7.2
  (`sensors` row); H01 `transports/mqtt.py` (`MqttLink`).
- `services/hw/app/modules/sensors/driver_real.py`: subscribe to `<base>/<temp_node>`; each
  message with numeric `temperature` and `humidity` emits one `temperature` and one `humidity`
  `sensors.reading` for `temp_node`. Temperature rounded to 1 dp (SPEC S1.E42); humidity rounded
  half-up to an integer and clamped 0–100 (contract `HwHumidityReading.value: int`, SPEC S1.E43).
  A missing / non-numeric field emits nothing for that kind; other keys (`battery`, `linkquality`,
  `*_calibration`, `update`) are ignored. Never raises on a bad payload (log and drop).
- `services/hw/app/config.py`: `DEFAULT_NODES` entry `r101_temp` → confirmed `ieee`
  `0xb0e8e8fffe985dcd`; model `SNZB-02P` and `temp_node = "r101_temp"` are now confirmed (drop the
  `[ASSUMED]` for those two only). No other node changes.
- Tests with the in-memory MQTT client (`tests/fake_mqtt.py`), payloads copied from the capture
  below: one message → two readings with the right node/kind/value; `64.6` → `65`, `63.5` → `64`,
  `73` → `73`; temperature 1 dp; payload missing `humidity` → temperature only; non-JSON / non-dict
  / string values → nothing, no exception; messages for other nodes ignored; broker reconnect
  keeps the subscription (as in `test_ir_real.py`).
- `@pytest.mark.hardware` test: with `sensors=real`, `<base>/r101_temp/availability` is `online`
  within 5 s (no reading is required — the sensor only reports on change).
- `deploy/pi/env/hw.env.example`: `HW_DRIVERS=ir=real,sensors=real`, comment updated; the live
  `/etc/eduscope/hw.env` on the R-101 Pi is changed by hand (install.sh never rewrites it).

## Out of scope
SNZB-03P motion and SNZB-04PR2 door (not paired yet; later Hxx). Real `zigbee_status` driver —
S2 battery %, LQI, mesh counts, real permit join (S2 "Permit joining" still does not open the real
network). Sensor calibration options, OTA, zigbee2mqtt `retain` or reporting configuration, any
change to `/opt/zigbee2mqtt/data/`. Any SPEC, contract or UI copy change.

## Acceptance criteria
1. `curl 127.0.0.1:8081/v1/health` shows `sensors: real` (and still `ir: real`).
2. Breathing on the sensor changes S1 HUMIDITY within 60 s; the value equals the `humidity` in
   `mosquitto_sub -t zigbee2mqtt/r101_temp` rounded half-up. S1 TEMPERATURE equals `temperature`
   at 1 dp. S2 "Room climate" shows the same `° · %` and its last seen updates.
3. Both tiles show `SNZB-02P`, never the fake 26.4° / 61 %. Motion and door show "—" / "No reading
   yet" (H11) and S1.E41 reads "1 of 3 reporting" — see Notes, decision 1.
4. `sudo systemctl restart zigbee2mqtt` and `sudo systemctl restart mosquitto` while hw-service
   runs: the next sensor report after recovery reaches S1 with no hw-service restart.
5. Left untouched for 1 hour in a still room, record every report time (`mosquitto_sub -v` with
   timestamps) in the plan's walk-through — input for decision 2.
6. `uv run --directory services/hw pytest -m hardware` passes on the Pi; `pnpm verify` green.

## Notes for the planner

### Observed on the Pi (2026-10-16, zigbee2mqtt 2.14.2, channel 25)
- Paired with permit join via `bridge/request/permit_join {"time":254}`; interview `successful`,
  `definition.model` `SNZB-02P`, vendor `SONOFF`, `supported: true`. The device LED did **not**
  blink during pairing, though it joined fine.
- `ieee_address` `0xb0e8e8fffe985dcd`, renamed to `r101_temp` via `bridge/request/device/rename`.
- `zigbee2mqtt/r101_temp/availability` → `{"state":"online"}`.
- State topic `zigbee2mqtt/r101_temp` is **not retained** (nothing on subscribe until the next
  report). Every message carried both values; firmware `installed_version` 8704 = latest. Captured:
  ```json
  {"battery":100,"humidity":64.6,"humidity_calibration":0,"linkquality":182,"temperature":28.9,"temperature_calibration":0,"update":{"installed_version":8704,"latest_release_notes":null,"latest_source":"https://raw.githubusercontent.com/Koenkk/zigbee-OTA/master/images/Sonoff/snzb-02p_v2.2.0.ota","latest_version":8704,"state":"idle"}}
  {"battery":100,"humidity":63.5,"humidity_calibration":0,"linkquality":185,"temperature":28.9,"temperature_calibration":0,"update":{"installed_version":8704,"latest_release_notes":null,"latest_source":"https://raw.githubusercontent.com/Koenkk/zigbee-OTA/master/images/Sonoff/snzb-02p_v2.2.0.ota","latest_version":8704,"state":"idle"}}
  {"battery":100,"humidity":73,"humidity_calibration":0,"linkquality":98,"temperature":28.9,"temperature_calibration":0,"update":{"installed_version":8704,"latest_release_notes":null,"latest_source":"https://raw.githubusercontent.com/Koenkk/zigbee-OTA/master/images/Sonoff/snzb-02p_v2.2.0.ota","latest_version":8704,"state":"idle"}}
  ```
- Reports arrive on change (7 reports in ~2 min while breathed on); `humidity` is a float with
  1 dp, or an integer when whole (`73`). `linkquality` ranged 76–185.

### Decisions this milestone needs (planner: put in `## Blockers` if not settled)
1. **Partial sensors.** `sensors=real` drops the fake motion/door readings, so S1 shows them as
   "No reading yet" and S1.E41/S1.E4 report degraded ("1 of 3 reporting"). Recommended: accept —
   it is the truth for R-101 until those sensors are paired. Alternative: a per-node fake/real
   split (more scope, needs a decision record).
2. **Staleness interval.** core-api marks climate stale after 2 × `CLIMATE_REPORT_INTERVAL_S`
   (default 300 s → 10 min). The SNZB-02P reports on change; its maximum interval when nothing
   changes is unknown `[ASSUMED]` (SPEC Q12). If acceptance 5 shows gaps > 300 s, the tiles go
   stale (H10) in a still room. Options: raise `CLIMATE_REPORT_INTERVAL_S` in
   `/etc/eduscope/core.env` (config only), or configure reporting in zigbee2mqtt (out of scope here).
3. **After a restart** there is no retained state, so tiles stay "No reading yet" until the next
   report. Accepted for H03 unless decided otherwise.

- Follow `ir/driver_real.py` for subscription, payload decoding and helper-function style.
- The module is read-only: no router changes; `sensors` already in the MQTT-module set in
  `app/registry.py`, so the transport starts with `sensors=real`.
- S2 battery % and LQI for `r101_temp` keep coming from the fake `zigbee_status` config values
  until its real driver lands.
