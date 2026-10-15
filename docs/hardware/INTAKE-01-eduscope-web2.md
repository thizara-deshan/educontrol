# INTAKE-01 — eduscope-web2 drop + Zigbee IR on the Pi

Status: v1, 2026-10-15 · Prompt 07 · Drop: `reference/hardware-drops/2026-10-14-eduscope-web2/`
· Machine: R-101 Raspberry Pi · Milestone created: [H01](../milestones/H01-zigbee-ir-blaster.md)

Citations: `web2:N` = `reference/hardware-drops/2026-10-14-eduscope-web2/eduscope_web2.py` line N,
`NOTES` = the drop's `NOTES.txt`. Every fact is marked **confirmed in code**, **confirmed on
hardware** or **guessed**.

**Scope of this intake.** The drop is the engineer's ESP32 + audio-mixer code. On the Pi the
ESP32's USB link turned out to be faulty, and the engineer then asked to do Zigbee first
("ESP32 not needed right now"). So this intake has two parts:

- **Part A — ESP32 + pub_audio (the drop).** Facts extracted, link observed, **parked** until the
  USB link works. No milestone yet.
- **Part B — Zigbee IR blaster (ZS06), observed on the Pi.** Not in the drop (NOTES: "Not
  included: … anything Zigbee"); confirmed end-to-end on real hardware on 2026-10-15. This is
  what H01 builds.

---

## 1 Inventory

| File | What it does | Relevant? | Hardware touched | Deps | Problems |
|---|---|---|---|---|---|
| `NOTES.txt` | Engineer's note: runs on a Radxa at 172.16.65.15; relevant = ESP32 serial protocol + pub_audio mixer API; not included = pub_audio.py, ESP32 firmware, Zigbee | yes | — | — | — |
| `eduscope_web2.py` (1071 lines) | Flask panel: ~25 lecture-capture services (record/preview/stream/OCR/STT), audio-mixer proxy, ESP32 serial hub | partly (~20 %) | ESP32 over USB serial; pub_audio HTTP 127.0.0.1:8090 | flask, stdlib termios/fcntl | 2 `while True` daemon threads (web2:233, web2:330); global state (`procs`, `SETTINGS`, `esp32`); all exceptions swallowed (web2:117, web2:340, web2:1005); hardcoded LAN IP (web2:4, web2:648); Flask on `0.0.0.0` (web2:1071); placeholder stream key `"test"` (web2:75 — not ours, env key if ever needed); raw ESP32 console exposed to the LAN (web2:1024); magic timings 2.0/5/8/20/1.0 s |

Relevant blocks: `_Serial` (web2:85–166), `ESP32` hub (web2:173–318), pot follow loop
(web2:324–342), mixer proxy (web2:986–1015), ESP32 routes (web2:1018–1035), UI JS that shows the
command syntax (web2:840–938). Everything else → §6.

---

## 2 Extracted facts

### 2A ESP32 serial link (drop)

| Fact | Value | Source | Status |
|---|---|---|---|
| Port, baud | `ESP32_PORT=/dev/ttyUSB0`, `ESP32_BAUD=115200` | web2:65–66 | confirmed in code |
| Line settings | raw 8N1, `CREAD\|CLOCAL`, no flow control, VMIN=0, VTIME=10 (1 s read timeout) | web2:88–101 | confirmed in code |
| Reset modes | `ESP32_RESET=none` (default: leave DTR/RTS as the OS set them) · `run` (RTS set → EN low, DTR clear → GPIO0 high, 50 ms, RTS clear) · `off` (clear both) | web2:70, web2:102–118 | confirmed in code; "forcing them parked this board in reset" is guessed |
| Open sequence | flush, wait 2.0 s ("opening resets the ESP32; let it boot"), flush, send `status` | web2:119, web2:237–245 | confirmed in code; "opening resets" guessed |
| Watchdog | reopen when quiet > 5 s (nothing heard since open) / > 8 s (heard before) / > 20 s (learn active); 1.0 s settle before reopen | web2:260–269, web2:281 | confirmed in code |
| Writes | one `\n`-terminated line per command; write loops until complete ("a full raw-AC IR command is a few KB") | web2:137–145, web2:291 | confirmed in code |
| On disconnect | `connected=false`, `opto=false` | web2:271–274 | confirmed in code |

**Board → host lines**

| Line | Meaning | Source | Status |
|---|---|---|---|
| `status enabled=0\|1 opto=0\|1 in1=0\|1 in2=0\|1 pot1=<n> pot2=<n>` | board state; pots parsed `int(float(v))` | web2:207–224 | confirmed in code |
| periodic `status` | sent unprompted; muted "for a few seconds" during learn; interval never stated | web2:263–264 (comment) | guessed — **not seen on hardware** |
| `ir proto=… code=… bits=…` | IR received (key=value) | web2:225–231; key names from UI web2:929 | confirmed in code (keys guessed) |
| `raw …` / `irsend …` | learned code, possibly several lines, joined with `\n` | web2:197–199 | confirmed in code |
| `ir ac <info>` | decoded AC info during learn | web2:200–201 | confirmed in code |
| `ok learn done` | learn terminator | web2:202 | confirmed in code |

No learn timeout and no cancel command exist in the code.

**Host → board commands**

| Command | Format / meaning | Source | Status |
|---|---|---|---|
| `status` | request a status line | web2:245 | confirmed in code |
| `learn` | arm one capture | web2:308 | confirmed in code |
| `irsend <PROTO> <hex> <bits>` | PROTO ∈ NEC SONY RC5 RC6 SAMSUNG PANASONIC JVC LG; example `irsend NEC 0x20DF10EF 32` | web2:717–718, web2:736, web2:863 | confirmed in code |
| `raw 38 9000,4500,560,…` | raw timings; `38` = carrier kHz | web2:736–737 | format confirmed in code; "kHz" guessed |
| captured-code replay | text sent verbatim; a multi-line paste becomes several commands | web2:887–889, web2:1027 | confirmed in code |
| `pot <1\|2> <0..100>` | X9C digipot on the amp board; clamped, rounded int | web2:297–299 | confirmed in code |
| `opto hold` / `opto release` | press-and-hold "Button" | web2:845–846, web2:706 | confirmed in code; what it presses: unknown |
| `enable` / `disable` | meaning not stated | web2:854–855 | confirmed in code; meaning unknown |
| `blink` | "Test LED" | web2:856 | confirmed in code |

No captured IR codes are in the drop; only UI placeholders (`0x20DF10EF`, `raw 38 9000,4500,…`).

### 2B Audio (drop)

| Fact | Value | Source | Status |
|---|---|---|---|
| Mixer URL | `AUDIO_CTRL=http://127.0.0.1:8090`, 0.5 s timeout | web2:62, web2:332, web2:1012 | confirmed in code |
| `GET /levels` | `{running, bomge:{vol 0..1, peak dB}, ums:{vol, peak}}`; `peak` may be null; meter maps −60..0 dB | web2:334–336, web2:794–798, web2:820–836 | confirmed in code |
| `POST /volume` | `{ch: "bomge"\|"ums", value: 0..1}`; response body unknown | web2:800–803, web2:1009–1013 | confirmed in code |
| Sources | card 7 = BOMGE, card 8 = UMS, mixed into `/tmp/audio.sock` (feeds recording/streaming) | web2:17–18, web2:682–683 | confirmed in code |
| Digipots | `POT_FOR = {bomge: 1, ums: 2}`; pot 1 = "BMG22 phone out", pot 2 = "HDMI extracted"; "their mixed output feeds the classroom amplifier" | web2:71–72, web2:692–703 | confirmed in code |
| Linkage | fader move sets the pot directly (web2:999–1006); a 1 s loop re-pushes a pot when the mixer `vol` changes (web2:324–342) | — | confirmed in code |
| Mute | none in the mixer API or the ESP32 protocol | (absence) | confirmed in code |
| Where it runs | the Radxa (NOTES, web2:3–4); the engineer says only the ESP32 is connected to the Pi | NOTES; engineer | confirmed (engineer) |

### 2C Zigbee + ZS06 (observed on the Pi; not in the drop)

| Fact | Value | Status |
|---|---|---|
| Coordinator | ZG-808Z (engineer), USB-serial CH340 `1a86:7523`, `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0` (no USB serial number) | confirmed on hardware |
| Radio / firmware | TI CC2652/CC1352 family ("Skip bootloader for CC2652/CC1352"), Z-Stack `ZStack3x0` revision `20250321` (majorrel 2, minorrel 7, maintrel 1, transportrev 2); coordinator IEEE `0x00124b003929c1ad` (TI OUI) | confirmed on hardware |
| zigbee2mqtt | 2.14.2 (zigbee-herdsman 10.10.0), adapter `zstack`, 115200 baud, channel 25, `/opt/zigbee2mqtt`, data in `/opt/zigbee2mqtt/data/` (network key there — never in git) | confirmed on hardware |
| Broker | mosquitto 2.0.21, `listener 1883 127.0.0.1`, anonymous (local only) | confirmed on hardware |
| IR blaster | friendly name `r101_ir`, IEEE `0x70d07efffe966e17`, model `TS1201`, manufacturer `_TZ3290_nba3knpsarkawgnt`, identified as "Tuya Universal smart IR remote control (ZS06)"; `Mains (single phase)`, **Router** | confirmed on hardware |
| Exposes | `learn_ir_code` (write, `ON`/`OFF`: "turn off to stop learning"), `learned_ir_code` (read), `learned_ir_timings` (read), `ir_code_to_send` (write: "the IR code or timings to send"), `ir_emitter` (write), `linkquality` (read) | confirmed on hardware |
| Topics | state `zigbee2mqtt/r101_ir`; commands `zigbee2mqtt/r101_ir/set` with `{"learn_ir_code":"ON"}` / `{"ir_code_to_send":"<code>"}`; `zigbee2mqtt/r101_ir/availability` → `{"state":"online"}` (retained); `zigbee2mqtt/bridge/state` → `{"state":"online"}`; `bridge/request/permit_join {"time":N}`, `bridge/request/device/rename` | confirmed on hardware |
| Learn result | one state message with `learned_ir_code` (Tuya base64) + `learned_ir_timings` `{modulation: 38000, timestamp: <ms>, timings: [...]}`, then a second message with the same code and `learned_ir_timings: ""` | confirmed on hardware |
| Learn behaviour | captures **the first** signal only, then stops (a second press was not recorded); captures arrived 6–17 s after arming (human reaction time), all inside the 20 s window; no device-side learn timeout was observed | confirmed on hardware |
| Stale code | the cached `learned_ir_code` is repeated in later state messages → freshness must come from `learned_ir_timings.timestamp`, not from the code's presence | confirmed on hardware |
| Send | no device acknowledgement; zigbee2mqtt logs nothing at `info` on success and no error → result is **assumed** (matches SPEC: IR is always assumed) | confirmed on hardware |
| Code size | Tuya codes 444–708 chars in 5 captures | confirmed on hardware |
| Link quality | 167–174 at ~1 m from the coordinator | confirmed on hardware |

**AC captures** (Tuya codes were throwaway test data and are not kept; the real codes are learned
through S3). Frames decoded from `learned_ir_timings` (38 kHz; header ≈3.5 ms/−1.7 ms; bit mark
≈430 µs, space ≈430 µs = 0, ≈1310 µs = 1; LSB first; two frames per press, ≈10 ms gap).
Frame 1 is identical in all captures: `02 20 E0 04 00 00 00 06`.

| Capture | Time | Frame 2 (19 bytes, last = checksum) | Checksum | Decoded | Replay on the AC |
|---|---|---|---|---|---|
| "22°" (1st try) | 14:13:53 | `02 20 E0 04 00 39 3C 80 73 00 00 0E E0 00 00 83 D0 02 B1` | ok | on, cool, **30 °C** | beep; value not confirmed |
| power off | 14:20:31 | `02 20 E0 04 00 38 32 80 73 00 00 0E E0 00 00 83 D0 02 A6` | ok | off, cool, 25 °C | **turned off** ✅ |
| power on (1st try) | 14:22:19 | 151 bits — last bit missing | **broken** | — | **no reaction** ❌ |
| swing | 14:23:07 | `02 20 E0 04 00 39 32 80 7F 00 00 0E E0 00 00 83 D0 02 B3` | ok | on, cool, 25 °C, swing nibble F | **swing started** ✅ |
| power on (2nd try) | 14:31:58 | (complete, 152 bits) | ok | on, cool, 25 °C, swing nibble 3 | **off → on** ✅ |
| 22° (2nd try) | 14:34:46 | (complete, 152 bits) | ok | on, cool, 22 °C, swing nibble 3 | **25 → 22** ✅ |

Decoding rules used (guessed from the frame signature `02 20 E0 04`, which is the **Panasonic AC**
protocol): byte 5 = mode (high nibble; 3 = cool) + power (bit 0); byte 6 bits 1–5 = °C; byte 8 low
nibble = vertical swing (F = auto); checksum = sum of bytes 0–17 mod 256. The checksums of all
complete captures validate, so the decoding is consistent.

Lessons (confirmed on hardware):
1. **Every AC code carries the whole state** (power, mode, temperature, swing), so swing and
   setpoint codes also switch the AC on (R4 holds).
2. **Learn catches only the first press.** The 30 °C capture was almost certainly a press taken
   while stepping the remote's temperature. The technician must set the remote one step away and
   press once.
3. **Captures can be truncated** (power-on 1st try lost its last bit and the AC ignored it). The
   R5 Test step ("did it react?") catches this; hw-service cannot judge opaque codes.

---

## Observed on the Pi (2026-10-15)

Read-only checks as user `eduscope`, except where marked (Zigbee setup was done with the user's
approval).

| Check | Exact output | Status |
|---|---|---|
| `cat /proc/device-tree/model` | `Raspberry Pi 5 Model B Rev 1.0` | confirmed on hardware |
| `cat /etc/os-release` | `PRETTY_NAME="Debian GNU/Linux 13 (trixie)"` … `DEBIAN_VERSION_FULL=13.7` | confirmed on hardware |
| `uname -m` | `aarch64` | confirmed on hardware |
| `lsusb` (relevant) | `Bus 001 Device 002: ID 10c4:ea60 Silicon Labs CP210x UART Bridge` (ESP32); later `Bus 003 Device 032: ID 1a86:7523 QinHeng Electronics CH340 serial converter` (ZG-808Z, behind hub `1a40:0101 Terminus Technology Inc. Hub`) | confirmed on hardware |
| `ls -l /dev/serial/by-id/ …` | `crw-rw---- 1 root dialout 188, 0 … /dev/ttyUSB0` · `usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0 -> ../../ttyUSB0` · `usb-1a86_USB_Serial-if00-port0 -> ../../ttyUSB1` · no `/dev/ttyACM*` | confirmed on hardware |
| `groups` | `eduscope adm dialout cdrom sudo audio video plugdev games users netdev lpadmin gpio i2c spi render input` | confirmed on hardware |
| `arecord -l` | `**** List of CAPTURE Hardware Devices ****` (none) | confirmed on hardware |
| `aplay -l` | `card 0: vc4hdmi0 [vc4-hdmi-0]`, `card 1: vc4hdmi1 [vc4-hdmi-1]` only | confirmed on hardware |
| `curl -s -m 2 http://127.0.0.1:8090/levels` | no output, exit 7 (connection refused) — pub_audio not running here | confirmed on hardware |
| `fuser -v /dev/ttyUSB0` (run by the user) | no output — nothing else holds the port | confirmed on hardware |
| Node | `v24.22.0` via nvm (`/home/eduscope/.nvm/…`) | confirmed on hardware |

### ESP32 probes (throwaway pyserial scripts in the session scratchpad, 115200 8N1)

Run 1 — no DTR/RTS change, wait 2 s, send `status\n`, listen 10 s:
```
opened /dev/serial/by-id/usb-Silicon_Labs_CP2102_…-port0; modem lines after open: CTS=False DSR=False RI=False CD=False
[  2.029s sent] b'status\n'
closed after 16.229s
```
Run 2 — no DTR/RTS change, listen only 15 s:
```
opened …; modem lines after open: CTS=False DSR=False RI=False CD=False
[ 17.039s] closing; out_waiting=0 in_waiting=0
closed after 22.239s
```
Run 3 — the drop's `ESP32_RESET=run` pulse (web2:112–116), listen 15 s:
```
[  0.063s] reset pulse done (RTS 50 ms, DTR clear)
[ 15.085s] total 0 bytes; closing
closed after 20.210s
```
Run 4 — listen only 30 s while the user pressed the board's reset button ~7 times:
```
0.029–0.794 s : 165,424 B, repeating b'p\x80\x8c|p\x00' (70 80 8C 7C 70 00)
6.2, 9.8, 11.1, 13.1, 17.2, 21.5, 27.4 s : 7 bursts of exactly 518 B, garbled
total 169050 bytes; no printable run ≥ 6 chars
```
Run 5 — listen-only sweep, 15 s per speed, user pressing reset every ~5 s:
```
=== 9600 baud: 2 B, 0% printable
=== 57600 baud: 368 B, 33% printable  (only b')),oZ!')
=== 74880 baud: 447427 B, 0% printable
=== 230400 baud: 1906336 B, 55% printable, 0 text runs>=6
=== 460800 baud: 1959 B, 34% printable
=== 921600 baud: 3853654 B, 19% printable
```
Received volume exceeds what the wire can carry (74880: 4.0×, 230400: 5.5×, 921600: 2.8×,
115200 first 0.8 s: 18×), so most bytes are not real UART data. Kernel log:
```
cp210x ttyUSB0: failed set request 0x12 status: -110        (×9; one per port close)
usb 1-1: USB disconnect, device number 2                     (5263 s)
usb 1-1: cp210x converter now attached to ttyUSB0            (5270 s)
```
`-110` = timeout; `0x12` = the CP210x purge request sent on close, which explains the ≈5 s
`close()` (USB control timeout). **Conclusion: the CP2102 USB-serial link is faulty** (cable,
power or chip — guessed). No readable byte was ever received; the ESP32 protocol is unconfirmed on
hardware. Not sent at any time: `learn`, `irsend`, `raw`, `pot`, `opto`, `enable`, `disable`,
`blink`.

### Zigbee setup and tests (with the user's approval)

- mosquitto from Debian; `/etc/mosquitto/conf.d/eduscope-local.conf` = `listener 1883 127.0.0.1`
  + `allow_anonymous true`; `ss` shows `127.0.0.1:1883` only.
- zigbee2mqtt cloned and built by the user into `/opt/zigbee2mqtt`; config: adapter `zstack`,
  port by-id, channel 25, frontend `127.0.0.1:8080`, availability on, keys `GENERATE`.
- First start collided with a second copy (`Cannot lock port`); the surviving copy failed with
  `SRSP - ZDO - simpleDescReq after 6000ms` and left a coordinator entry with `"endpoints":{}`
  in `database.db`, which made the next start log `Failed to start 'Bridge' (TypeError: …
  'deviceIeeeAddress')`. Fix: `database.db` moved to `database.db.broken-2026-10-15`; next start
  clean. **Only one zigbee2mqtt may run** (§5 deploy).
- Pairing: `permit_join {"time":180}` → `device_joined` → `Successfully interviewed … identified
  as: Tuya Universal smart IR remote control (ZS06)` (≈1 s interview); renamed to `r101_ir`;
  `permit_join {"time":0}`.
- Learn/send results: table in §2C.
- systemd unit `/etc/systemd/system/zigbee2mqtt.service` (User eduscope, `Restart=always`,
  `RestartSec=10`, `After=`/`Wants=mosquitto.service`, nvm Node path), enabled.
- Reboot test: both services came up unattended; `bridge` and `r101_ir` `online`. At 14:50:58 the
  external USB hub (`1a40:0101`, shared with keyboard and mouse) dropped 4× within 9 s while a
  keyboard was plugged in; zigbee2mqtt logged `Adapter disconnected, stopping`, systemd restarted
  it at 14:51:08 and it recovered by itself (`Currently 1 devices are joined`).

---

## 3 Map to capabilities

| Piece | hw module | SPEC elements | State |
|---|---|---|---|
| ZS06 send | `ir` (`transport: ir_zs06`) | S1.E31–E36 (projector power IR), S1.E35, E38–E45 (AC power + setpoints), S3.E14 Test | **ready for H01** |
| ZS06 learn / cancel | `ir` | S3.E14–E15 Re-learn, H20–H22 | **ready for H01** |
| ZS06 online + LQI | `ir` (`ir.blaster`) | S3.E10, H25 | **ready for H01** (availability + linkquality) |
| Shared MQTT client | `transports/mqtt.py` | all zigbee modules | **ready for H01** |
| Coordinator + nodes | `zigbee_status` | S2.E16–E21 | possible now (1 node); best done when more devices are paired (later Hxx) |
| ESP32 IR (`ir_mcu`) | `ir` via ESP32 transport | R8, S3.E11 | blocked — link faulty |
| Amp digipots `pot 1/2` | `audio` | S1.E21–E23 | blocked — link faulty; channel mapping open (Q-A7) |
| `opto`, `enable/disable`, `in1/in2` | `audio`? `hdmi`? | S1.E11/E12 (if `in1/in2` = HDMI LEDs) | blocked; meaning unknown (Q-A5, Q-A6) |
| pub_audio mixer | — | — | stays on the Radxa (engineer); not ours |

Still without hardware support: lights (ZBM5-2C-86W), projector power meter (S60ZBTPG), sensors
(SNZB-02P/03P/04PR2), HDMI switch (Q1), projection screen (Q2) — no devices paired or delivered.

---

## 4 Assumption check (ARCHITECTURE §7.2, §7.3, §9)

| Assumption | Verdict | Evidence |
|---|---|---|
| Zigbee via zigbee2mqtt + mosquitto on the Pi, localhost only | **confirmed** | §2C, Observed |
| ZS06 is the Zigbee Tuya blaster reached via zigbee2mqtt `ir_code_to_send` / `learn_ir_code` | **confirmed** | §2C exposes, tests |
| Tuya IR codes are opaque base64 strings (`code_format: "tuya"`) | **confirmed** for ZS06 | §2C (444–708 chars) |
| ZG-808Z = CC2652P1, Z-Stack 3.x.0, channel 25 (`config.py` `DEFAULT_COORDINATOR`) | **confirmed** except: chip variant only "CC2652/CC1352" (P1 unverified); port is the by-id path, not `zigbee-coord` | §2C |
| Q4: is the ZS06 counted in the mesh? | **answered: yes** — same network, role Router | §2C |
| `ir_mcu` = ESP32 on GPIO 16/17 via serial | **partly contradicted** — ESP32 over USB CP2102 (`/dev/ttyUSB0`), not Pi GPIO; 16/17 probably the ESP32's emitter pins (guessed) | §2A, Observed |
| ESP32 IR codes fit `code_format: "tuya"` | **contradicted** — `irsend …` / `raw 38 …` text, possibly multi-line, several KB | web2:138–139, web2:197–199, web2:736–737 |
| Audio = ALSA mixer via `amixer` (Q8) | **contradicted** — pub_audio HTTP mixer (on the Radxa) + X9C digipots via the ESP32 | §2B |
| Audio mixer local to the Pi | **contradicted** — mixer stays on the Radxa; on the Pi only the amp pots (via ESP32) are ours | §2B, engineer |
| `transports/` = `mqtt.py` only | **incomplete** — the ESP32 needs a shared serial transport | §5A |
| HDMI read-back (Q1), screen position (Q2) | still unknown | not in the drop |
| Report intervals (Q12) | still unknown (no sensors paired) | — |
| §9 "Bookworm"; M10 "Node 22" | **contradicted (minor)** — Debian 13 trixie on a Pi 5; Node v24.22.0 via nvm | Observed |

### Change records needed (prompt 08)

| CR | Subject | When |
|---|---|---|
| CR-A | Audio backend: amp digipots via ESP32 instead of ALSA; mic/pc ↔ pot mapping; mute emulation (no hardware mute); mixer is not ours | when the ESP32 link works |
| CR-B | IR `code_format` for `ir_mcu` (ESP32 command text, multi-line, max size); SPEC IrCommand | when the ESP32 link works |
| CR-C | Shared ESP32 serial transport + ESP32 link state in the hw contract / RoomState (closes M09-L1) | when the ESP32 link works |
| CR-D | Platform: Debian 13 trixie, Pi 5, Node 24 (ARCHITECTURE §9, M10) | before M10 is planned |

None is needed for H01: the ZS06 path matches ARCHITECTURE and the current contracts.

---

## 5 Integration design

### 5B `ir` real driver — ZS06 via zigbee2mqtt (→ H01)

- **Transport** `app/transports/mqtt.py`: one shared `aiomqtt` client (D-13), started in the
  lifespan when any real zigbee driver is active; subscribe by topic, publish JSON; reconnect with
  backoff (1 → 30 s); exposes `connected`. Config: `HW_MQTT_HOST=127.0.0.1`, `HW_MQTT_PORT=1883`,
  `HW_Z2M_BASE_TOPIC=zigbee2mqtt`, existing `HW_IR_NODE=r101_ir`.
- **Online:** `<base>/<ir_node>/availability` `{"state":"online"|"offline"}` (retained, so it
  arrives on subscribe) **and** `<base>/bridge/state` online **and** MQTT connected → emit
  `ir.blaster {online, lqi}`. `lqi` from `linkquality` in `<base>/<ir_node>` messages (null until
  the first one).
- **send:** publish `{"ir_code_to_send": code}` to `<base>/<ir_node>/set`. Ack `ok` when the
  publish succeeds; `device_offline` when the blaster is not online; `transport` when MQTT is down.
  No device ack exists (§2C) → core-api keeps IR `assumed`.
- **learn:** reject `ir_mcu` (`invalid` — Part A not done); publish `{"learn_ir_code":"ON"}`,
  remember the arm time, wait ≤ `timeout_s` for a `<base>/<ir_node>` message whose
  `learned_ir_timings` is an object with `timestamp` ≥ arm time; return
  `{status: captured, code_format: "tuya", code: learned_ir_code}` exactly as received (never
  altered). Ignore messages that only repeat the cached code. Timeout → publish
  `{"learn_ir_code":"OFF"}`, return `timeout`.
- **cancel:** publish `{"learn_ir_code":"OFF"}`, resolve the pending learn as `cancelled`.
- **One learn at a time** (core-api already enforces per transport); `ir_mcu` send → `invalid`.
- **Fake driver** unchanged; tests use an in-memory fake MQTT client injected into the real driver
  (`[ASSUMED]`-free; payloads copied from §2C).
- **Events:** `ir.blaster`, `ir.learn {listening|captured|timeout|cancelled}` (existing contract).
- **Contracts:** no change. Add fixtures only if a new shape appears (none expected).
- **Hardware tests** (`@pytest.mark.hardware`): blaster online within 5 s of start; learn times out
  cleanly with no press.

### 5C Pi setup (→ H01 `deploy/pi/`)

| Item | Class | Target |
|---|---|---|
| mosquitto install + `eduscope-local.conf` (127.0.0.1:1883) | (a) one-time setup | `deploy/pi/` |
| zigbee2mqtt install into `/opt/zigbee2mqtt` (pinned release), `configuration.yaml` template with `GENERATE` keys, adapter/port/channel, frontend 127.0.0.1 | (a) | `deploy/pi/zigbee/` |
| `zigbee2mqtt.service` (as installed by hand; replace the nvm Node path with the system Node from M10/CR-D) | (a) | `deploy/pi/systemd/` |
| udev symlink for the coordinator (CH340 has no serial number; by-id collides if a second CH340 is plugged) | (a) | `deploy/pi/` |
| Backup of `/opt/zigbee2mqtt/data/` (network key) — documented, never in git | (a) doc | `deploy/pi/README` |

### 5A ESP32 + audio (parked; design kept for CR-A/B/C)

- `services/hw/app/transports/esp32_serial.py`: the **only** opener of the ESP32 port; one
  reader task; writes behind one async lock; line subscribers by prefix (`status`, `ir `,
  `raw `/`irsend `/`ir ac `/`ok learn done`); exclusive learn session (raises the quiet limit);
  state `connected`, `last_rx`, last status; reopen with backoff (not a fixed 1 s: close costs
  ≈5 s on this CP2102 and a silent board would reopen forever).
- Config: `HW_ESP32_PORT` (by-id path or udev symlink; CP2102 serial `0001` is generic),
  `HW_ESP32_BAUD=115200`, `HW_ESP32_RESET=none|run|off`, `HW_ESP32_BOOT_WAIT_S=2.0`,
  `HW_ESP32_QUIET_S=5`/`8`, `HW_ESP32_LEARN_QUIET_S=20`, `HW_ESP32_REOPEN_MAX_S`,
  `HW_AUDIO_MIC_POT`, `HW_AUDIO_PC_POT`.
- Users: `ir` (`ir_mcu`), `audio` (pots), `hdmi` only if `in1/in2` turn out to be its LEDs.
- **Owner of `/dev/ttyUSB0`:** `eduscope-hw.service` only. The engineer's panel and any probe must
  not run alongside it.
- **M09-L1:** closable once CR-C adds ESP32 link state (`online` = port open and a line heard
  within the quiet window) and `requireBlaster` checks it for `ir_mcu`. Not closable now.
- New dep: `pyserial`.

---

## 6 Discard list

| Dropped | Why |
|---|---|
| All lecture-capture services, `SERVICES`/`GROUPS`, start/stop/pgrep, STT/OCR/slide detail (web2:349–599, web2:1038–1067) | not our product |
| Flask app, HTML/JS panel (web2:601–983) | replaced by kiosk + core-api; kept only as syntax reference |
| Mixer proxy and pot-follow loop (web2:324–342, web2:986–1015) | mixer stays on the Radxa; pots will be driven directly by `audio` (CR-A) |
| Raw ESP32 console route (web2:1024–1028) | arbitrary commands from the LAN; never exposed |
| stdlib termios serial class (web2:85–166) | replaced by pyserial in one transport |
| Stream key `"test"`, ratios, LAN IP | lecture capture / engineer's network |

---

## 7 Questions for the hardware engineer

ESP32 (blocking Part A):
- **Q-A1** Which baud does the firmware use, and on which UART — `Serial` (USB) or `Serial2` on
  GPIO 16/17? Is the CP2102 on the ESP32 board or a separate adapter wired by jumpers?
- **Q-A2** On our Pi 5 the CP2102 times out on USB requests, disconnected once, and delivers
  garbage at every speed. Can you check the board + cable on your laptop (serial monitor) and try
  a different cable / external power?
- **Q-A3** How often does the board send `status` unprompted? Does it print a boot banner?
- **Q-A4** `learn`: internal timeout? Cancel command? Largest capture (lines, bytes)? Do
  `raw`/`irsend` reply `ok`/`err`?
- **Q-A5** What do `enable`/`disable` and `opto hold`/`release` physically do?
- **Q-A6** What are `in1`/`in2` ("LED in 1/2") wired to — the HDMI switch's input LEDs?
- **Q-A7** Which pot is the lecturer mic and which PC audio (BOMGE = mic receiver, UMS = PC/HDMI)?
- **Q-A8** Which ESP32 GPIOs drive the IR emitters/receiver (SPEC R8 says "GPIO 16 and 17")?
- **Q-A9** Can you send the firmware source or its command list?

Zigbee / room:
- **Q-B1** Which AC model is in R-101? The remote speaks the Panasonic AC protocol (§2C). Which
  setpoint range and mode/fan should be captured (SPEC Q23)?
- **Q-B2** When do the light switch (ZBM5-2C-86W), projector plug (S60ZBTPG) and sensors arrive?
- **Q-B3** The coordinator sits on an external USB hub with keyboard and mouse; the hub dropped 4×
  when a keyboard was plugged in. Can the dongle go directly into the Pi on a USB extension cable
  (better radio, no hub)?
