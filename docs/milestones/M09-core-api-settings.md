# M09 — core-api: settings & scheduler
Depends on: M08            Machine: Arch        Est: ½ day

## Goal
Make every Settings tab real: IR device and command management with learn and test flows, the
schedule (class blocks and timed actions) with the scheduler that runs them and ends control
sessions, the device registry with permit joining, PIN changes, and network/about/restart. At
the end the whole frontend runs against core-api with no mock-only feature left.

## Scope
- ARCHITECTURE §6.8, §6.9; contracts `api/ir.ts`, `api/schedule.ts`, `api/devices.ts`,
  `api/settings.ts`, `api/system.ts`.
- Routes (all `technician`, GETs included): IR devices/commands CRUD, learn (202 + `ir_capture`
  events, 20 s), cancel, test (send stored code), test-result; schedule CRUD; devices
  list/update/delete; `zigbee/permit-join` (240 s); PIN change (room 4 digits, technician 6,
  re-hash, end all other sessions of that level); system network (hostname, IPs from
  `os.networkInterfaces`, Wi-Fi SSID/signal via `nmcli` when available, controller status,
  connected clients from the WS hub), about (room, version from package.json, uptime, Pi model
  from `/proc/device-tree/model` or "unknown"), restart (runs the configured `RESTART_COMMAND`;
  dev default is `process.exit(0)` under the dev runner).
- AC `available_setpoints` recomputed from captured setpoint commands (R4); IR transport switch
  updates "via ZS06"/"via MCU" (R8).
- `scheduler/`: 30 s tick: due timed actions (steps dispatched with attribution "schedule"),
  control sessions ended at class-block end, expired session sweep, midnight kWh baseline,
  `event_log` pruning > 30 days.
- `invalidate` WS events after every settings mutation.
- SPEC: S3.E7–E17, S3b, S3c, S3d, S3e, H20–H22, H25 (server), R4, R5, R8, §2.3 class-block end.

## Out of scope
Editing network settings. systemd-specific restart wiring (M10 sets `RESTART_COMMAND`).

## Acceptance criteria
1. With `pnpm dev` (http mode) and technician PIN: Remote configuration lists AC (14) and
   Projector (2) from the DB; Re-learn "Power on" → Listening countdown → fake hw captures →
   "Captured · now test it"; Test → Yes → "tested ✓ just now"; reload the page: status persists.
2. Re-learn with hw fake "nothing received" → "Nothing received"; the stored code is unchanged
   (verify the projector still powers on from S1).
3. + Add a command on AC for 31 °C, capture it: S1's + button now goes up to 31°.
4. Switch the projector's transport to mcu in S3d: S3 shows "Epson · via MCU".
5. Add a timed action "Lights off" two minutes from now: when it fires, every client gets the
   toast "… · by schedule" and the lights turn off.
6. Add a class block ending two minutes from now and unlock a remote client with the room PIN:
   at the block end it drops to `view` with "Locked · enter PIN to control".
7. Change the room PIN in S3d: the old PIN fails, the new one works, other remote control
   sessions are locked.
8. Permit joining → S2 Mesh shows "Open · 4:00 left" counting down on every client.
9. Network tab lists this machine's hostname, address and connected clients (e.g. "phone",
   "laptop"); About shows uptime and a QR for `ROOM_HOSTNAME`.
10. Every new route returns 401/403 for `view` and `control` sessions (curl).
11. `pnpm verify` green, with Vitest covering: learn/test state transitions, setpoint list
    rebuild, scheduler due-calculation (days, minute boundary, midnight), class-block end
    expiry, PIN change invalidation, all new routes' access levels.

## Notes for the planner
- No new tables (all exist since M08); a missing column means a new generated migration, not an
  edit of the old one.
- Learn is long-running: the route returns 202 immediately; the hw call runs in the background,
  one learn at a time per blaster (second request → 409 precondition).
- `RESTART_COMMAND` is config; never shell out with user input.
- Scheduler uses the injectable clock so tests jump time.
