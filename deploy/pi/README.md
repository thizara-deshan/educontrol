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
- installs and enables `eduscope.target`, `eduscope-hw.service`, `eduscope-core.service` and
  `eduscope-restart.path`, makes the journal persistent (max 200 MB) and sets the hostname to `r-101`;
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
since H03 the SNZB-02P climate sensor too: `HW_DRIVERS=ir=real,sensors=real`. The installer
creates this file once and never changes it, so on a Pi that was installed earlier set the line by
hand, then restart:

```sh
sudoedit /etc/eduscope/hw.env                       # HW_DRIVERS=ir=real,sensors=real
sudo systemctl restart eduscope.target
curl -s 127.0.0.1:8081/v1/health                    # "ir":"real", "sensors":"real"
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
- **Frontend** (pairing, logs): `ssh -L 8080:127.0.0.1:8080 eduscope@<pi>` then open
  `http://localhost:8080` on the laptop.
- **Coordinator:** ZG-808Z on a CH340 adapter, `/dev/zigbee-coord` (udev) or
  `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`. Plug it straight into the Pi (USB extension
  cable), not into the hub with the keyboard: that hub dropped it once (INTAKE-01, Q-B3).
- **Upgrade:** the installer pins zigbee2mqtt 2.14.2 and stops if `/opt/zigbee2mqtt` has another
  version. To upgrade: back up `data/` (above), stop the unit, check out the new tag in
  `/opt/zigbee2mqtt`, run `pnpm install --frozen-lockfile && pnpm run build` as `eduscope`, change
  `Z2M_VERSION` in `deploy/pi/steps/50-zigbee.sh`, run the installer.
