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
`No changes.`

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

`/etc/eduscope/hw.env` starts with `HW_MODE=fake`: every device is simulated. Each hardware
milestone switches its own module, e.g. `HW_DRIVERS=ir=real`, then
`sudo systemctl restart eduscope.target`. The installer never overwrites this file.

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
