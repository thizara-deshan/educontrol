# M10 — Pi deploy
Depends on: M09            Machine: Pi        Est: ½ day

## Goal
Put the system on the Raspberry Pi as a product: one idempotent install script, systemd units
that start on boot and restart on crash, core-api on port 80 for the whole LAN at
`http://r-101.local`, hw-service reachable only from the Pi itself, and the optional Chromium
kiosk on the Pi's screen.

## Scope
- ARCHITECTURE §2, §9.
- `deploy/pi/install.sh` (idempotent, re-runnable): apt prerequisites (`build-essential
  python3` for better-sqlite3, avahi-daemon present), Node 22 + pnpm, uv; system user `eduscope`
  (groups `dialout gpio audio`); `/var/lib/eduscope`, `/etc/eduscope/{core,hw}.env` (mode 600,
  created from `deploy/pi/env/*.example` with a generated `COOKIE_SECRET` only if absent);
  `pnpm install --frozen-lockfile && pnpm build`; `uv sync --frozen`; install and enable units;
  `hostnamectl set-hostname r-101`; sudoers line allowing `eduscope` to run exactly `systemctl
  restart eduscope.target`; journald persistent with `SystemMaxUse=200M`.
- `deploy/pi/systemd/`: `eduscope.target`, `eduscope-hw.service`, `eduscope-core.service` as in
  ARCHITECTURE §9 (CAP_NET_BIND_SERVICE, Restart=always, hardening). `hw.env.example` ships
  `HW_MODE=fake`; each Hxx switches its own module to real via `HW_DRIVERS`.
- `deploy/pi/kiosk/`: `launch.sh` (Chromium flags from §9, restart loop, log to
  `~/.cache/eduscope-kiosk.log`), labwc autostart snippet, `install.sh --kiosk` flag to install
  it for the desktop user; OS blanking disabled.
- `RESTART_COMMAND=sudo systemctl restart eduscope.target` in `core.env`.
- `deploy/pi/README.md`: install, update (`git pull && ./install.sh`), logs, how to change PINs.

## Out of scope
Real hardware drivers (Hxx). Watchdog and power-pull acceptance (M99). HTTPS.

## Acceptance criteria
1. On a fresh Bookworm Pi: `git clone … && sudo deploy/pi/install.sh` completes; running it a
   second time changes nothing and exits 0.
2. `systemctl status eduscope-core eduscope-hw` both active; `sudo reboot` → both active again
   without login.
3. A phone on the same network opens `http://r-101.local` (mDNS) and the Pi's IP; both show S1
   live; room PIN unlocks control.
4. From another machine: `curl -m 3 http://r-101.local:8081/v1/health` fails (connection
   refused/timeout); on the Pi `curl 127.0.0.1:8081/v1/health` succeeds. `ss -ltnp` shows 8081
   bound to `127.0.0.1` only and 80 on `0.0.0.0`.
5. `ps -o user= -C node` shows `eduscope`, not root, while core-api is bound to port 80.
6. `sudo kill -9 $(pgrep -f core-api)` → service back within 5 s; clients show "Back online".
7. With a display and `--kiosk`: after boot the Pi screen shows S1 full screen with no browser
   chrome, no cursor; it is a kiosk client (no padlocks, no Lock button); Settings asks for the
   technician PIN. The screen never blanks by the OS; the app's own dim/blank works.
8. About → Restart controller → both services restart, clients reconnect.
9. `journalctl -u eduscope-core -u eduscope-hw` shows logs from both; they survive a reboot.

## Notes for the planner
- better-sqlite3 needs a native build on arm64; install build deps before `pnpm install`.
- Run `pnpm build` as the `eduscope` user or chown the result; units must not write to the repo.
- `ProtectSystem=strict` needs `ReadWritePaths=/var/lib/eduscope`; the SQLite WAL files live there.
- Chromium package on Bookworm is `chromium-browser` or `chromium` depending on image — detect.
- Raspberry Pi OS Bookworm defaults to labwc on recent images; `raspi-config nonint do_blanking 1`
  disables blanking.
- Ask IT for a DHCP reservation; check client isolation on the Wi-Fi (README §8).
