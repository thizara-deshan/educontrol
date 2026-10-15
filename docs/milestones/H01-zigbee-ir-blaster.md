# H01 — Zigbee IR blaster (ZS06) live
Depends on: M10            Machine: Pi            Est: 1 day

## Goal
Make the ZS06 IR blaster real. hw-service gets the shared MQTT transport and a real `ir` driver
for `transport: ir_zs06` that sends, learns and cancels through zigbee2mqtt. The Pi setup for
mosquitto + zigbee2mqtt moves into `deploy/pi/`. At the end, the AC and projector IR controls in
S1 and the Test / Re-learn flow in S3 drive the real devices in R-101.

## Scope
- INTAKE-01 §2C (facts), §5B (driver design), §5C (Pi setup); ARCHITECTURE §3.4, §6.9, §7.1,
  §7.2 (`ir` row), §7.3.
- `services/hw/app/transports/mqtt.py`: one shared `aiomqtt` client (D-13), started in the
  lifespan only when a real zigbee driver is active; reconnect with backoff; `connected` flag.
- `services/hw/app/config.py`: `mqtt_host="127.0.0.1"`, `mqtt_port=1883`,
  `z2m_base_topic="zigbee2mqtt"`, reconnect bounds; `ir_node` stays `r101_ir`. Update
  `DEFAULT_COORDINATOR` only where INTAKE-01 §4 confirms (firmware revision, by-id port).
- `services/hw/app/modules/ir/driver_real.py`: ZS06 send / learn / cancel, `ir.blaster`
  online + LQI from availability, bridge state and `linkquality`; learn freshness from
  `learned_ir_timings.timestamp`; codes passed through unaltered; `ir_mcu` → `invalid`.
- Tests with an injected in-memory MQTT client (payload shapes copied from INTAKE-01 §2C):
  send publishes the right topic/payload; learn captures only a fresh code and ignores the
  repeated cached one; timeout publishes `learn_ir_code: OFF`; cancel resolves `cancelled`;
  offline → `device_offline`; MQTT down → `transport`; `ir.blaster` follows availability.
- `@pytest.mark.hardware` tests: blaster online within 5 s; learn with no press times out cleanly.
- `deploy/pi/`: mosquitto install + `eduscope-local.conf` (127.0.0.1:1883); zigbee2mqtt install
  into `/opt/zigbee2mqtt` (pinned release) with a `configuration.yaml` template (keys
  `GENERATE`, adapter `zstack`, coordinator port, channel 25, frontend 127.0.0.1:8080,
  availability on); `zigbee2mqtt.service` (one instance, `Restart=always`, after mosquitto, system
  Node); udev symlink for the coordinator; backup note for `/opt/zigbee2mqtt/data/`.
- `/etc/eduscope/hw.env` sets `HW_DRIVERS=ir=real` on the Pi.

## Out of scope
ESP32 / `ir_mcu`, amp digipots, `opto`/`in1`/`in2` (INTAKE-01 Part A — blocked on the USB link;
CR-A/B/C). M09-L1 (needs CR-C). `zigbee_status`, `lights`, `projector_power`, `sensors` real
drivers (later Hxx once those devices are paired). Any SPEC or UI copy change (e.g. a learn hint in
S3 — needs a decision record). Re-pairing or changing the Zigbee channel.

## Acceptance criteria
1. After `sudo reboot`, `systemctl is-active mosquitto zigbee2mqtt eduscope-hw eduscope-core` all
   `active`; `ss -ltn` shows 1883 and 8080 on 127.0.0.1 only; exactly one zigbee2mqtt process.
2. `curl 127.0.0.1:8081/v1/health` shows `ir: real`; the `/v1/events` snapshot contains
   `ir.blaster {"online":true,"lqi":<0–255 or null>}` and S3.E10 shows the blaster Online.
3. Unplugging the ZS06's power makes S3.E10 show Offline and disables Test/Re-learn (H25) within
   the zigbee2mqtt availability timeout; plugging it back makes it Online again without restarting
   anything.
4. S3 Re-learn on the AC "22°" command: with the remote set to 23°, one press of temperature-down
   within 20 s → "captured · untested"; S3 Test → the AC beeps and shows 22 °C; answering
   "reacted" → "tested ✓".
5. Re-learn with no press → "timeout" after 20 s, the previous code is untouched, and the blaster
   is no longer in learn mode (a press afterwards is not captured). Cancel during listening →
   "cancelled".
6. S1 AC Power on / setpoint − / + / Power off change the physical AC within 2 s of the tap and
   the UI shows them as assumed (IR); S1 projector Power on/off reaches the Epson projector via the
   ZS06 (projector power reading stays Unknown until the S60ZBTPG is paired).
7. `sudo systemctl restart zigbee2mqtt` and `sudo systemctl restart mosquitto` while hw-service
   runs: the blaster goes Offline, then Online again within 30 s, with no hw-service restart.
8. `uv run --directory services/hw pytest -m hardware` passes on the Pi; `pnpm verify` green.

## Notes for the planner
- zigbee2mqtt + mosquitto are already installed by hand on the R-101 Pi (INTAKE-01 Observed);
  the deploy task must be idempotent on top of that and must **never** overwrite
  `/opt/zigbee2mqtt/data/` (network key, paired `r101_ir`). The live `configuration.yaml` is not
  committed.
- zigbee2mqtt repeats the last `learned_ir_code` in later state messages; only a message whose
  `learned_ir_timings` is an object with a fresh `timestamp` is a capture.
- `learn_ir_code: OFF` stops learning; the device captures the first signal only.
- ZS06 sends are never acknowledged by the device; ack = MQTT publish accepted.
- Codes seen: 444–708 chars; no length cap in the contract; never trim or re-encode.
- The Node path in the hand-installed unit is nvm's; M10/CR-D decides the system Node.
- The coordinator currently sits on an external USB hub that dropped once during the reboot
  test (INTAKE-01 Observed, Q-B3); systemd recovered it.
