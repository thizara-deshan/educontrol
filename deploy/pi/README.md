# Eduscope Central on the Raspberry Pi

One Pi per room (R-101). It serves the control UI to every browser on the room network at
`http://r-101.local` and, if a screen is attached, shows it full screen as the room kiosk.
Platform: Raspberry Pi 5, Raspberry Pi OS based on Debian 13 "trixie", Node 24 (decision D-22).

## 1 Install

You need a Pi with network access and a user account that can `sudo` (here: `eduscope`).

```sh
git clone <repo-url> ~/edcontrol
cd ~/edcontrol
sudo deploy/pi/install.sh            # headless Pi: services only
sudo deploy/pi/install.sh --kiosk    # with a screen: also the kiosk for the user running sudo
```

The installer:
- installs build tools, avahi, **Node 24 from NodeSource** (it removes Debian's own `nodejs` 20
  package first), pnpm (the version in `package.json`) and uv 0.13.1;
- uses the `eduscope` account for the services (it creates a system user if there is none) and adds
  it to the `dialout`, `gpio` and `audio` groups;
- creates `/var/lib/eduscope` (database) and `/etc/eduscope/{core,hw}.env` (mode 600, **only if
  missing**, with a random cookie secret and the fixed demo PINs room `1234` / technician `123456`);
- builds the code as the owner of the checkout (`pnpm install --frozen-lockfile`, `pnpm build`,
  `uv sync --frozen`);
- installs mosquitto (broker on `127.0.0.1:1883` only), the `/dev/zigbee-coord` udev link and
  zigbee2mqtt 2.14.2 in `/opt/zigbee2mqtt` with `zigbee2mqtt.service` (section 10);
- installs the `/dev/podium-mcu` udev link for the podium MCU (section 11);
- installs and enables `eduscope.target`, `eduscope-hw.service`, `eduscope-core.service` and
  `eduscope-restart.path` and `eduscope-shutdown.path`, makes the journal persistent (max 200 MB) and sets the hostname to `r-101`;
- with `--kiosk`: desktop autologin, OS screen blanking off, the Chromium launcher in the labwc
  autostart. Reboot afterwards.

The checkout must stay where it is: the services run the code from it. The `eduscope` user must be
able to read it (true when the checkout is in `/home/eduscope`).

The first-boot PINs are the fixed demo PINs: room `1234`, technician `123456` (D-24). **Change them in
the app after the demo** (section 4).

## 2 Update

```sh
cd ~/edcontrol
git pull
sudo deploy/pi/install.sh            # add --kiosk if this Pi runs the kiosk
```

It rebuilds and restarts the services only when something changed; otherwise it prints
`No changes.` After a restart it also restarts a running kiosk browser, so the room screen loads the
new build. Phones, laptops and the podium PC keep the old page until they are refreshed.

## 3 Check and logs

```sh
systemctl status eduscope-core eduscope-hw          # both "active (running)"
curl -s http://127.0.0.1/api/health                 # {"ok":true,"hw":"up",...}
journalctl -u eduscope-core -u eduscope-hw -f       # live logs (kept across reboots)
journalctl -u eduscope-core -b -1                   # core-api logs of the previous boot
cat ~/.cache/eduscope-kiosk.log                     # kiosk browser (desktop user)
```

Restart everything: Settings → About → **Restart controller**, or
`sudo systemctl restart eduscope.target`.

Power the Pi off: S1 header → **Power off** (any `control` session, the kiosk included; D-32). It needs
`SHUTDOWN_COMMAND=/usr/bin/touch /var/lib/eduscope/shutdown.request` in `/etc/eduscope/core.env`;
install.sh never edits an existing `core.env`, so add that line by hand on a Pi installed before D-32 and
`sudo systemctl restart eduscope.target`. Without it the button only logs a warning. The Pi comes back
only when its power is cycled.

## 4 PINs

- Change the room PIN and the technician PIN in the app: Settings (technician PIN) → Devices →
  Room PIN / Technician PIN → **Change**. That is the only way once the system has started.
- `INITIAL_ROOM_PIN` / `INITIAL_TECH_PIN` in `/etc/eduscope/core.env` are used **only on the first
  start with an empty database**. Editing them later changes nothing.
- Forgotten technician PIN: stop the services, move the database away, set new initial PINs, start.
  This resets every setting (schedule, IR codes, devices):
  ```sh
  sudo systemctl stop eduscope.target
  sudo mv /var/lib/eduscope/eduscope.db /var/lib/eduscope/eduscope.db.old
  sudo rm -f /var/lib/eduscope/eduscope.db-wal /var/lib/eduscope/eduscope.db-shm
  sudoedit /etc/eduscope/core.env                    # INITIAL_ROOM_PIN=4 digits, INITIAL_TECH_PIN=6 digits
  sudo systemctl start eduscope.target
  ```

## 5 Hardware drivers

`/etc/eduscope/hw.env` has `HW_MODE=fake` (every device simulated) plus a per-module override
`HW_DRIVERS=`. Each hardware milestone switches its own module. Since H01 the IR blaster is real,
since H03 the SNZB-02P climate sensor too, since H05 the Zigbee status (coordinator, paired
devices, permit joining), and since H06 audio and the HDMI switch (the podium MCU, section 11):
`HW_DRIVERS=ir=real,sensors=real,zigbee_status=real,audio=real,hdmi=real,plug=real` (since D-34 also
the S60ZBTPG smart plug, `r101_plug`). The installer creates
this file once and never changes it, so on a Pi that was installed earlier set the line by hand,
then restart:

```sh
sudoedit /etc/eduscope/hw.env      # HW_DRIVERS=ir=real,sensors=real,zigbee_status=real,audio=real,hdmi=real,plug=real
sudo systemctl restart eduscope.target
curl -s 127.0.0.1:8081/v1/health   # "ir", "sensors", "zigbee_status", "audio", "hdmi", "plug": "real"
```

With `sensors=real` the climate sensor (`r101_temp`, H03), the motion sensor (`r101_motion`) and the
door sensor (`r101_door`, H04) report through the same driver. None of them is retained, so after a
restart each tile shows "No reading yet" until that sensor's next report.

## 6 Backup

Back up the database (settings, schedule, IR codes) and the env files. Stop the services for the
copy so the SQLite files are consistent:

```sh
sudo systemctl stop eduscope.target
sudo tar -czf ~/eduscope-backup-$(date +%F).tar.gz /var/lib/eduscope /etc/eduscope
sudo systemctl start eduscope.target
```

The archive holds the cookie secret: keep it off shared drives.

## 7 Developing on this Pi

`pnpm dev` needs the ports the services use (hw-service 8081). Stop the services first and start
them again afterwards:

```sh
sudo systemctl stop eduscope.target
pnpm dev
sudo systemctl start eduscope.target
```

## 8 Network (ask IT)

- **DHCP reservation** for the Pi, so its IP never changes (phones that cannot resolve `.local` use
  the IP; Settings → Network shows it).
- **No client isolation** on the room Wi-Fi: phones and laptops must be able to reach the Pi.
- mDNS (UDP 5353) allowed on the room network, so `r-101.local` resolves.

## 9 What runs where

| Unit | Process | Listens on |
|---|---|---|
| `eduscope-core.service` | `node apps/core-api/dist/main.js` as `eduscope` | `0.0.0.0:80` (UI, `/api`, `/ws`) |
| `eduscope-hw.service` | `services/hw/.venv/bin/uvicorn` as `eduscope` | `127.0.0.1:8081` only |
| `eduscope-restart.path` | watches `/var/lib/eduscope/restart.request` | — |
| `eduscope-shutdown.path` | watches `/var/lib/eduscope/shutdown.request` → `systemctl poweroff` | — |
| `eduscope.target` | starts both services at boot | — |
| `mosquitto.service` | MQTT broker (Debian package) | `127.0.0.1:1883` only |
| `zigbee2mqtt.service` | `/usr/bin/node index.js` in `/opt/zigbee2mqtt` as `eduscope` | `127.0.0.1:8080` (frontend) |

## 10 Zigbee (mosquitto + zigbee2mqtt)

- **Only one zigbee2mqtt may run.** Never start it by hand (`pnpm start`, `node index.js`) while the
  unit runs: two copies fight over the coordinator and can break `data/database.db`. Use
  `sudo systemctl restart zigbee2mqtt` and `journalctl -u zigbee2mqtt -f`.
- **Back up `/opt/zigbee2mqtt/data/`.** It holds the network key, the coordinator backup and the
  paired devices. Losing it means re-pairing every device. It is never in git:
  ```sh
  sudo systemctl stop zigbee2mqtt
  sudo tar -czf ~/zigbee2mqtt-data-$(date +%F).tar.gz -C /opt/zigbee2mqtt data
  sudo systemctl start zigbee2mqtt
  ```
  Keep the archive private (network key).
- The installer writes `data/configuration.yaml` only when it is missing (template:
  `deploy/pi/zigbee/configuration.yaml`, keys `GENERATE`). It never changes the live file.
- **Frontend** (logs, advanced pairing): `ssh -L 8080:127.0.0.1:8080 eduscope@<pi>` then open
  `http://localhost:8080` on the laptop. Everyday pairing is in the app (below).
- **Coordinator:** ZG-808Z on a CH340 adapter, `/dev/zigbee-coord` (udev) or
  `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`. Plug it straight into the Pi (USB extension
  cable), not into the hub with the keyboard: that hub dropped it once (INTAKE-01, Q-B3).
- **Upgrade:** the installer pins zigbee2mqtt 2.14.2 and stops if `/opt/zigbee2mqtt` has another
  version. To upgrade: back up `data/` (above), stop the unit, check out the new tag in
  `/opt/zigbee2mqtt`, run `pnpm install --frozen-lockfile && pnpm run build` as `eduscope`, change
  `Z2M_VERSION` in `deploy/pi/steps/50-zigbee.sh`, run the installer.

### Moving the sensors between Central and Unistream (H05)

R-101's IR blaster (`r101_ir`), climate (`r101_temp`), motion (`r101_motion`) and door (`r101_door`)
sensors and the smart plug (`r101_plug`, S60ZBTPG: hold its button about 5 s until the blue LED
flashes quickly) are shared with the Eduscope Unistream board, which has its own coordinator. A Zigbee device
belongs to one network at a time, so each move is a re-pair. To bring them to Central:

1. In the app, unlock technician access and open **Settings › Devices**.
2. Press **Permit joining** (open for 4 minutes).
3. Reset each device: SNZB sensors, hold the button about 5 s until the LED flashes; ZS06, hold the
   reset pin about 5 s until the LED flashes fast. The **Pair devices** card shows each one.
4. Wait until all four show **Heard just now**. A door or motion sensor may need its magnet or a
   hand wave to send a first report.
5. In **Settings › Remote configuration**, press **Test** on one AC and one projector code. The codes are stored on the
   Pi, so nothing has to be learned again.

zigbee2mqtt keeps each device's name, so nothing else changes. The motion sensor's "no motion" delay
goes back to 15 s by itself (`HW_MOTION_TIMEOUT_S`) after its first report. To move the devices back,
reset them again and pair them on the Unistream.

## 11 Podium MCU (audio levels and HDMI switch, H06)

An ESP32 at the podium (firmware `eduscope-podium-mcu 2.1`, source in
`reference/hardware-drops/2026-10-18-podium-mcu/`) on USB serial, CP2102 adapter, `/dev/podium-mcu`
(udev, step 55) or `/dev/serial/by-id/usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0`.
It drives:

- **PC audio** and **Lecturer microphone**: two pairs of X9C103S digital potentiometers (pair `a` =
  PC, `b` = mic). They cannot be read back. The app shows the level it last set; mute turns the
  pair to 0 (D-30). Levels 1-12 are as quiet as 0.
- **The HDMI switch**: the MCU presses the switch's button and reads its two input LEDs, so the
  source tiles show what the switch really selected. Input 1 = podium PC, 2 = smart board
  (`HW_HDMI_PODIUM_PC_INPUT`). A press on the switch by hand shows up in the app within a second.

Things to know:

- **Opening the port restarts the ESP32.** Every hw-service start, and every reconnect after the
  cable was out, sets both audio levels back to `HW_AUDIO_START_MIC` / `HW_AUDIO_START_PC`
  (60 / 40). After a reconnect, a muted channel stays muted.
- **hw-service is the only program that may use the port.** It locks it; a console or the
  engineer's tools fail with "Could not exclusively lock port" while it runs (and a tool that does
  not lock would garble both). The ESP32 has no IR (D-31); its RS232, SPI and spare GPIO are not
  used by the app.
- **LED calibration** (once, and after replacing the switch): the MCU decides which LED is lit with
  thresholds stored on the ESP32. With hw-service stopped:
  ```sh
  sudo systemctl stop eduscope-hw
  python3 -m serial.tools.miniterm /dev/podium-mcu 115200 --eol LF
  ```
  Press the switch's button until input 1 is lit, type `cal`, note `led1=… led2=…`; repeat on input
  2. Then `thresh <t1> <t2>` with each value halfway between that LED's lit and unlit readings, and
  `pol 0` only if a lit LED reads lower than an unlit one. `src?` must now print the lit input on
  both inputs. Leave with Ctrl+], then `sudo systemctl start eduscope-hw`.
  Never use `volsave`, `tap` or `taper` from the console: the app does not expect them, and
  `volsave` wears out the potentiometers' memory.
- **Check:** `uv run --directory services/hw pytest -m hardware` (stop hw-service first; it reads
  `ping`, `ver`, `src?`, `vol?` and changes nothing except restarting the ESP32).
