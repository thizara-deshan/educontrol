# PLAN-H06 — Podium MCU: real audio levels and HDMI source
Milestone: none (owner request 2026-10-18) · Start tag: `h06-start` · Verify-all: `pnpm verify`
Status: **D1–D8 accepted by the owner 2026-10-18 (D5: option a).**

## Goal

The hardware engineer's ESP32 ("podium MCU", firmware `eduscope-podium-mcu 2.1`) drives two things S1 already shows
from fake drivers:

- **PC audio** and **Lecturer microphone** levels (S1.E21–E23) through four X9C103S digipots in two stereo pairs;
- the **2×1 HDMI switch** (S1.E11/E12): it presses the switch button through a PC817 and reads the switch's two input
  LEDs back.

At the end, `HW_DRIVERS` on the Pi includes `audio=real,hdmi=real`. Dragging a slider changes the real amplifier
level, Mute all silences both pairs, a source tile switches the real HDMI input and shows "Selected, confirmed" only
after the LEDs agree. Someone pressing the switch button by hand moves the tile on every client.

## What is true today

### The firmware (owner paste 2026-10-18; citations `fw:<function>`)

- **Link:** USB serial, 115200 8N1, one command per `\n`-terminated line, intended as `/dev/podium-mcu` (fw header).
  Each command gets exactly one final line, `ok` or `err <reason>`. Data lines come before it. Lines starting with
  `evt ` are unsolicited and can arrive at any time, **including between a command and its reply**
  (fw header, `fw:handle`, `fw:evt`). Input lines over 320 chars are cut short (`fw:loop`).
- **Boot:** prints `evt ready` about 50 ms after `setup()`. It does **not** touch the digipots at boot. Each X9C
  comes back at the wiper position saved in its own EEPROM, and the firmware counts both channels as "not homed"
  (`tap = -1`) until the host sets a level (`fw:setup`).
- **Host watchdog:** after 60 s with no command it sends `evt fault host_silent`, blinks the status LED fast and
  **changes nothing**. The next command sends `evt host back` (`fw:loop`, `fw:handle`).
- **Audio** (`fw:setTap`, `fw:volToTap`, `fw:x9cMove`, `fw:x9cStore`):
  - Channel `a` = CS A (GPIO 25) = U3+U4 = **PC stereo**; channel `b` = CS B (GPIO 26) = U5+U6 = **Mic stereo**
    (fw pin map; confirmed in code only).
  - `vol <a|b> <0-100>` maps the level to a wiper tap 0–99 on a power curve (`taper`, default 2.5). If the channel is
    not homed, it first sweeps 110 steps down to tap 0, then counts up from there. `vol <a|b> up|down [n]` returns
    `err not_homed` before homing. `tap <a|b> <0-99>` sets the tap directly.
  - `vol?` → `a=<n>` / `b=<n>` (`-1` = not homed) then `ok`. The value is calculated from the firmware's own tap
    count (`fw:tapToVol`). **The X9C has no read-back.**
  - Rounding: levels **1–12 all give tap 0** (the same as 0 or mute). 50 → tap 18, 62 → 30, 75 → 48. `vol?` turns a
    tap back into a level, so it does not return the exact level that was sent.
  - There is **no mute command**.
  - `volsave <a|b>` writes the current wiper to the X9C's EEPROM, which is rated for 100k writes. The firmware says:
    "The host must debounce, never call per step."
- **HDMI** (`fw:readSource`, `fw:setSource`, `fw:pressButton`):
  - `src <1|2>`: up to 4 times, reads the LEDs and presses the button if needed (120 ms press, 80 ms, then 600 ms
    settle). Prints `src=<0|1|2>` and then `ok`, or `err switch_did_not_confirm`.
  - Worst case is about 3.3 s, and the MCU handles no other command in that time.
  - `src?` → `src=<n>` and `ok`. `0` means the two LEDs don't agree on a valid state.
  - A press by hand sends `evt src changed <was> <now>` within about 500 ms (`fw:loop`; `was` can be `0`).
  - Whether an LED counts as lit depends on `thresh <t1> <t2>` and `pol <0|1>`, stored in the MCU's NVS. The defaults
    (800/800, lit = high) are not calibrated. Calibration is: run `cal` with the switch on each input and set each
    threshold halfway between the two readings (`fw:handle` "cal").
- **Expansion block:** RS232 on GPIO 16/17 (MAX3232, `evt rs232 <line>` inbound), SPI and two AUX GPIOs. The firmware
  has no IR: "IR is NOT here. It lives on the Zigbee blaster."

### This repo

- The `audio` and `hdmi` modules exist with fake drivers. `RealAudioDriver` and `RealHdmiDriver` are stubs
  (`NotImplementedError(INTAKE_PENDING)`). ARCHITECTURE §7.2 assumes ALSA `amixer` for audio and an unknown serial
  link for hdmi. Both are `[ASSUMED]`.
- Contracts: `POST /v1/audio/level {channel: mic|pc, level}`, `POST /v1/audio/mute {channel, muted}`,
  `POST /v1/hdmi/select {input: podium_pc|smart_board}`. Events: `audio.state {channel, level, muted}` and
  `hdmi.state {input}`, where `input` cannot be null. The snapshot can be `null` per channel or input.
- core-api confirms a command when the matching report arrives:
  - `audio.level` needs `level === requested` (`commands/policies.ts`);
  - `source.select` needs `input === requested`;
  - Mute all sends `mute(mic)`, `mute(pc)`, and on unmute also re-sends the saved levels (R9).
  - Timeouts: `TIMEOUT_MIXER_MS` 2 s, `TIMEOUT_HDMI_MS` 5 s.
- Devices `audio` and `hdmi_switch` use transport `local`. core-api treats them as online whenever hw-service is up
  (`domain/devices.ts`).
- INTAKE-01 Part A covered an **older** ESP32 drop (different protocol: `pot`, `opto`, `status …`, IR learn). Its
  CP2102 link was faulty on 2026-10-15 (Q-A2). Its §5A transport design (single owner of the port, one reader, one
  write lock, reopen with backoff) still applies. Its CR-A matches D3 below.
- On the Pi now (`lsusb`, 2026-10-18): a CP2102 `10c4:ea60`
  (`/dev/serial/by-id/usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0`) next to the coordinator's
  CH340 `1a86:7523`. It has not been probed yet `[ASSUMED]` to be the podium MCU.

### Conflicts with SPEC (decision records in T1)

- SPEC §1 hardware table says audio is the "system mixer, 0–100, read back". The digipots have no read-back. → D3.
- SPEC R8 and S3.E11 say "The ESP32 emitter heads on GPIO 16 and 17 stay wired" (`ir_mcu`). This firmware has no IR,
  and GPIO 16/17 are now RS232. → D7.

## Decisions (accepted by the owner 2026-10-18 — do not re-open them)

- **D1 — One serial transport owns the MCU.** New `services/hw/app/transports/podium_mcu.py` is the only code that
  opens `HW_PODIUM_PORT` (default `/dev/podium-mcu`):
  - One reader task.
  - One command in flight at a time, behind an async lock.
  - Lines starting `evt ` go to subscribers. Every other line belongs to the command in flight until `ok` or
    `err …`. A non-`evt` line with no command in flight is logged and dropped.
  - Per-command timeouts: `HW_PODIUM_CMD_TIMEOUT_S` = 1.0, `src` uses `HW_PODIUM_SRC_TIMEOUT_S` = 4.5 (under
    core-api's 5 s).
  - `evt ready` while a command is in flight fails that command (the MCU reset).
  - Keepalive `ping` every `HW_PODIUM_PING_S` = 20 s, so `host_silent` never fires.
  - The port opens with DTR/RTS deasserted, so opening does not reset the board `[ASSUMED]`, checked in T0.
  - Reopen with backoff 1 → 30 s, the same numbers as MQTT.
  - The registry builds it once if `audio` or `hdmi` is real, the same way it builds `MqttTransport`.
  - New deps: `pyserial`, `pyserial-asyncio-fast`.
- **D2 — No hw contract change.** Both modules fit the existing requests and events. An MCU that is unplugged or
  silent shows up as `ack_error("device_offline", …)` on commands. S1 keeps its last values. Showing "Podium MCU
  offline" on S1/S2 needs a link-state field in the contract (INTAKE-01 CR-C). Out of scope here.
- **D3 — Audio is the digipots, and the MCU's `ok` counts as read-back.**
  - `mic` → channel `b`, `pc` → channel `a` (`HW_PODIUM_MIC_CH`, `HW_PODIUM_PC_CH`; from the firmware pin map,
    `[ASSUMED]` until AC3).
  - `level` sends `vol <ch> <level>`. On `ok` the driver emits `audio.state` with the **requested** level, not
    `vol?`'s rounded value, so core-api confirms the command and the slider doesn't jump.
  - Decision record **D-30**: audio = X9C digipots through the podium MCU (not ALSA). "Confirmed" means the MCU
    accepted the move; no physical read-back exists.
- **D4 — Mute is done in the driver.**
  - `mute(ch, true)` remembers the channel's level, sends `vol <ch> 0` and emits `{level: <remembered>, muted: true}`.
  - `mute(ch, false)` sends `vol <ch> <remembered>` and emits `muted: false`.
  - A `level` while muted only updates the remembered level. It moves no wiper and emits `{level, muted: true}`.
  - `[ASSUMED]` tap 0 is silent. Checked in AC4.
- **D5 — Levels after a restart.** hw-service stores nothing across restarts. When the MCU reports `-1` (after its
  boot or `evt ready`), the driver needs a starting level. Options:
  - (a) Set `HW_AUDIO_START_MIC` / `HW_AUDIO_START_PC` (default 60 / 40, `[ASSUMED]`). This homes the pots at hw
    start, which happens at boot when nobody is teaching.
  - (b) Leave the channel unreported (S1 shows no reading) until someone moves its slider.

  **Chosen: (a)**, so S1 never opens with empty audio cards. If hw-service restarts and the MCU is already homed,
  the driver uses `vol?` and reports those values, unmuted.
- **D6 — Never call `volsave`.**
  - With D5(a), the wiper position stored in EEPROM only matters between MCU power-up and hw-service start, so
    wearing the EEPROM gains nothing.
  - `tap`, `taper`, `thresh` and `pol` are technician-only commands, used through the console in T6. They are never
    sent by hw-service.
- **D7 — `ir_mcu` has no hardware.** Decision record **D-31**: this firmware has no IR, and GPIO 16/17 are now RS232,
  so R8/S3.E11's MCU fallback does not exist. This plan changes no code for it. A follow-up plan removes or relabels
  the "MCU" transport option and the S3.E11 Fallback card. Alternative: ask the engineer to add IR back.
- **D8 — HDMI mapping and confirmation.**
  - `podium_pc` → input `1`, `smart_board` → `2` (`HW_HDMI_PODIUM_PC_INPUT` = 1, `[ASSUMED]` until AC5).
  - `select` sends `src <n>`:
    - `src=<n>` with `ok` → emit `hdmi.state` with that input, ack ok.
    - `err switch_did_not_confirm` → ack `transport`. If the `src=` line before it was 1 or 2, emit that real input.
    - `src=0` → no event; S1 keeps its last confirmed tile.
  - `evt src changed <was> <now>` with `now` 1 or 2 → emit `hdmi.state`.
  - On start and every reconnect: `src?`.
  - `evt rs232 …` and `evt gpio …` are logged at debug level and dropped (expansion block out of scope).

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `docs/decisions/D-30-audio-digipots-via-podium-mcu.md`, `D-31-no-mcu-ir.md` | Create | D3, D7 (T1) |
| `services/hw/pyproject.toml`, `uv.lock` | Modify | `pyserial`, `pyserial-asyncio-fast` (T2) |
| `services/hw/app/config.py` | Modify | `HW_PODIUM_*`, `HW_AUDIO_START_*`, `HW_HDMI_PODIUM_PC_INPUT` (T2–T4) |
| `services/hw/app/transports/podium_mcu.py` | Create | D1 line protocol, evt fan-out, keepalive, reconnect (T2) |
| `services/hw/tests/fake_podium_mcu.py` | Create | in-memory MCU that speaks the fw protocol (data lines, `ok`/`err`, `evt` between command and reply, slow `src`, reset) (T2) |
| `services/hw/tests/test_podium_mcu.py` | Create | transport tests (T2) |
| `services/hw/app/registry.py` | Modify | build the transport if audio or hdmi is real; pass it to both real drivers; start/stop (T2–T4) |
| `services/hw/app/modules/hdmi/driver_real.py`, `tests/test_hdmi_real.py` | Replace/Create | D8 (T3) |
| `services/hw/app/modules/audio/driver_real.py`, `tests/test_audio_real.py` | Replace/Create | D3–D5 (T4) |
| `services/hw/tests/test_podium_hardware.py` | Create | `@pytest.mark.hardware`: ping, `ver` prefix `eduscope-podium-mcu 2.`, `src?`, `vol?` (T4) |
| `deploy/pi/podium/99-eduscope-podium.rules`, `deploy/pi/steps/55-podium.sh` | Create | `/dev/podium-mcu` udev link (T5) |
| `deploy/pi/env/hw.env.example`, `deploy/pi/README.md` | Modify | `audio=real,hdmi=real`, port, start levels, calibration and console how-to (T5) |

No change to contracts, core-api or kiosk.

## Executor notes

- Repo root `/home/eduscope/edcontrol` on the R-101 Pi. `git tag h06-start` on the commit that accepts D1–D8.
- Steps marked `[ON PI · HUMAN]` need root or a person at the podium. Ask the owner to run the `!`-prefixed command
  or to press the switch or listen to the speakers. Never work around sudo.
- While hw-service has `audio` or `hdmi` real, **it is the only process that may open the port**. To use the
  console, stop it first: `sudo systemctl stop eduscope-hw`.
- Write Python from the protocol above. Comments cite `fw:<function>` from the firmware drop, never `reference/`
  imports.
- After each task: its Verify, then `pnpm verify`; tick the box; one commit with the task's message.
- Never edit SPEC, ARCHITECTURE, milestones or other plans.

## Tasks

### T0 — `[ON PI · HUMAN]` intake: firmware drop and first contact
- [x] done

1. Owner saves the firmware as `reference/hardware-drops/2026-10-18-podium-mcu/podium_mcu.ino`, with a `NOTES.txt`
   giving the engineer, date and board.
2. Read-only checks:
   - `udevadm info -q property -n /dev/ttyUSB*`: record vendor, product and serial for the CP2102.
   - Confirm the CP2102 is the podium MCU and not something else.
3. With `python -m serial.tools.miniterm` (DTR/RTS off), send `ping`, `ver`, `help`, `status`, `src?`, `vol?`.
   - Record every line exactly.
   - Record whether opening the port resets the board (an `evt ready` on open).
4. If no readable line arrives (INTAKE-01 Q-A2 again): write a Blocker and stop.

Record under "Observed on the Pi" below. **Commit:** `docs: H06 podium MCU observed on the Pi`

### T1 — decision records D-30, D-31
- [x] done

**Do:** Write D-30 (D3 + D4 + D6) and D-31 (D7) in the format of D-29, citing this plan and the firmware drop.
**Verify:** `pnpm verify`
**Commit:** `docs: D-30 audio via podium MCU digipots, D-31 no MCU IR (H06 T1)`

### T2 — hw: podium MCU serial transport
- [x] done

**Do:**
1. Build `PodiumMcuTransport` per D1. API:
   - `command(line, timeout) -> list[str]` (data lines). Raises `McuError(reason)` on `err`, `McuTimeout`,
     `McuOffline`.
   - `subscribe(prefix, callback)` for `evt` lines.
   - `on_ready(callback)`, called on open and on `evt ready`.
2. Build `fake_podium_mcu.py` against the firmware's behaviour, wired to the transport through an injected stream
   pair (no real port in tests).
3. Tests:
   - data lines then `ok`;
   - `err x` → `McuError("x")`;
   - an `evt` between a command and its reply goes to subscribers and not into the reply;
   - a timeout frees the lock for the next command;
   - `evt ready` during a command fails it and fires `on_ready`;
   - a keepalive `ping` goes out after an idle period (injectable clock);
   - after a disconnect, commands fail `McuOffline` and the reopen backoff grows;
   - a stray non-`evt` line is dropped with a warning.

**Verify:** `uv run --directory services/hw pytest -m "not hardware" tests/test_podium_mcu.py`
**Commit:** `feat(hw): podium MCU serial transport (H06 T2)`

### T3 — hw: real hdmi driver on the podium MCU
- [x] done

**Do:** `RealHdmiDriver(settings, mcu)` per D8. The registry passes the transport.
Tests with the fake MCU:
- select each input → `src n` sent, `hdmi.state` emitted, ack ok;
- `switch_did_not_confirm` with `src=1` → event for input 1 and ack `transport`;
- `src=0` → no event;
- `evt src changed 1 2` → `smart_board`;
- `evt src changed 2 0` → nothing;
- start and reconnect query `src?`;
- MCU offline → `device_offline`;
- the mapping follows `HW_HDMI_PODIUM_PC_INPUT=2`.

**Verify:** `uv run --directory services/hw pytest -m "not hardware" tests/test_hdmi_real.py`
**Commit:** `feat(hw): real HDMI switch driver on the podium MCU (H06 T3)`

### T4 — hw: real audio driver on the podium MCU
- [ ] done

**Do:** `RealAudioDriver(settings, mcu)` per D3–D5 (D5 option a: start levels). It never sends `volsave`.
Add the hardware test from the file map.
Tests with the fake MCU:
- level → `vol b 62` for mic and the event carries 62 (not the rounded value);
- mute saves the level, sends `vol <ch> 0` and emits `muted: true`; unmute restores it;
- a level while muted only updates the remembered level (no `vol` sent);
- `vol?` = `-1` on start → D5 behaviour;
- `vol?` ≥ 0 on start → reported unmuted;
- `evt ready` → D5 behaviour again;
- `err not_homed` / offline / timeout → the matching ack codes;
- the channel mapping follows config.

**Verify:** `uv run --directory services/hw pytest -m "not hardware" tests/test_audio_real.py`
**Commit:** `feat(hw): real audio levels and mute on the podium MCU digipots (H06 T4)`

### T5 — deploy: udev link, env, README
- [ ] done

**Do:**
- udev rule `SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", SYMLINK+="podium-mcu"`. Use the
  T0 values; add `ATTRS{serial}` only if it is not the generic `0001`. Installed by `55-podium.sh` the same way
  `50-zigbee.sh` installs its rule.
- `hw.env.example`: `HW_DRIVERS=ir=real,sensors=real,zigbee_status=real,audio=real,hdmi=real`, plus commented
  `HW_PODIUM_PORT`, `HW_AUDIO_START_*`, `HW_HDMI_PODIUM_PC_INPUT`.
- README section "Podium MCU": what it drives, the console procedure (stop hw-service, miniterm, `cal`/`thresh`/`pol`,
  start hw-service), and "never run the engineer's tools while hw-service runs".

**Verify:** `pnpm pi:lint && pnpm pi:test`
**Commit:** `feat(deploy): podium MCU udev link; audio and hdmi real on R-101 (H06 T5)`

### T6 — `[ON PI · HUMAN]` calibration and acceptance
- [ ] done

1. **Calibrate:** with hw-service stopped:
   - `cal` with the switch on input 1, then on input 2;
   - `thresh` halfway between the readings, and `pol` if lit reads low;
   - `src?` now matches the lit LED on both inputs.
2. **Switch on:** owner adds `audio=real,hdmi=real` to `HW_DRIVERS` in `/etc/eduscope/hw.env`, then runs
   `! sudo deploy/pi/install.sh --kiosk`. `curl 127.0.0.1:8081/v1/health` shows `audio: real, hdmi: real`.
3. **AC1:** S1 opens with both audio cards showing a level (D5a) and the active source tile "Selected, confirmed".
4. **AC2:** PC audio slider 0 → 100 → 40: the room level follows, the value doesn't jump back, and there is no
   "timed out" toast. Note the lowest level you can hear (levels 1–12 are tap 0).
5. **AC3:** the mic slider moves the mic, not the PC (confirms D3's mapping).
6. **AC4:** Mute all → both pairs silent and S1 shows "Muted". Unmute → the earlier levels come back.
7. **AC5:** tap Smart board, then Podium PC: the projector input follows and each tile turns "Selected, confirmed"
   within 5 s (confirms D8's mapping).
8. **AC6:** press the switch button by hand: every client's tile follows within 2 s.
9. **AC7:** unplug the MCU's USB: a source tap fails with an inline error and hw-service keeps running. Plug it back
   in: the next tap works with no restart, and the levels are re-applied (D5).
10. **AC8:** `uv run --directory services/hw pytest -m hardware` passes; `pnpm verify` is green.
11. Record the results under "Acceptance".

**Commit:** `docs: H06 acceptance`

## Observed on the Pi

**2026-10-18 (T0)**, with a throwaway pyserial 3.5 probe (system Python; not yet a hw-service dependency). Port
opened at 115200 8N1 with `dtr = rts = False` set before `open()`. Only `ping`, `ver`, `help`, `status`, `src?` and
`vol?` were sent. Nothing moved: no `vol`, `tap`, `src <n>` or settings commands.

- **Device:** `/dev/ttyUSB1` = CP2102 `10c4:ea60`, `ID_SERIAL_SHORT=0001` (generic, so the T5 rule must not match
  on it). Path `platform-xhci-hcd.0-usb-0:1:1.0`, by-id
  `usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0`. The coordinator is `/dev/ttyUSB0`, CH340
  `1a86:7523`, path `usb-0:2:1.0`, held by zigbee2mqtt; no clash. Nothing had `/dev/ttyUSB1` open.
- **The link is healthy.** 1000 bytes, all readable, no garbage and no kernel errors. INTAKE-01 Q-A2 no longer
  applies.
- **Opening the port resets the ESP32, even with DTR/RTS off** (contradicts D1's `[ASSUMED]`). On open:
  ```
  [0.056s] ets Jul 29 2019 12:21:46
  [0.056s] rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
           … 8 more ROM boot lines (configsip, clk_drv, mode:DIO, load…, entry 0x400805b4) …
  [0.257s] evt ready
  [0.757s] evt src changed 0 2
  ```
  What this means for the build (no decision changes):
  - **T2:** treat every open as an MCU boot. Discard non-`evt` lines quietly (debug log, not warning) until
    `evt ready`, and send no command before it (allow ≤ 2 s).
  - **T4:** with D5(a), every hw-service start and every reconnect re-homes the pots to the start levels. The "MCU
    already homed, use `vol?`" branch of D5 can only happen if the port stays open, i.e. never in practice. Keep it;
    it costs nothing.
  - **T3:** the first poll after boot sends `evt src changed 0 <n>`, which gives the source without asking.
- **Replies** (exactly as the firmware describes; each arrived within the probe's 100 ms read slice):
  ```
  > ping      < ok
  > ver       < eduscope-podium-mcu 2.1 · ok
  > help      < the 7 lines of fw:printHelp · ok
  > status    < gain a=-1 tap=-1 · gain b=-1 tap=-1 · src=2 · led1=0 led2=1916
              · thr1=800 thr2=800 pol=1 taper=2.50 · rs232 baud=9600 eol=1
              · spi ready=0 hz=1000000 mode=0 hold=0 · gpio1 mode=0 val=0 · gpio2 mode=0 val=0 · ok
  > src?      < src=2 · ok
  > vol?      < a=-1 · b=-1 · ok
  ```
- **HDMI LEDs with the switch on input 2:** led1 = 0, led2 = 1916. The default threshold 800 with lit = high already
  reads `src=2` correctly. Input 1's readings and the input → device mapping (D8) still need T6.
- **NVS settings are factory defaults** (thresholds, polarity, taper 2.5, RS232 9600/CR). Nobody has calibrated
  them yet.

## Acceptance

(filled by T6)

## Blockers

(none)

## Questions for the hardware engineer (not blocking)

- **Q-P1** Is tap 0 fully silent on both pairs, or does the amp need a separate mute (D4)?
- **Q-P2** Levels 1–12 all round to tap 0 at taper 2.5. Is 2.5 the value you tuned on the amp?
- **Q-P3** Does the board's auto-reset circuit reset the ESP32 when the port opens with DTR/RTS off?
- **Q-P4** IR fallback (SPEC R8): gone for good, or planned for another board (D7)?
- **Q-P5** What is the RS232 port meant for first (projector model and protocol)? That is a later plan.

## Until this is built

S1 audio and source tiles stay on the fake drivers (`audio`, `hdmi` fake). The MCU can be driven by hand from the
console, with hw-service unaffected while those modules are fake: `python -m serial.tools.miniterm /dev/ttyUSB0
115200`, then `vol a 40`, `src 2`, and so on.
