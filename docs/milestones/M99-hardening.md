# M99 — Hardening & final acceptance
Depends on: M10, all Hxx done            Machine: Pi        Est: ½ day

## Goal
Make the room survive real life: power loss, crashed or hung processes, hardware going offline,
phones sleeping, and logs filling the card. Finish with a walk-through of SPEC on the real
hardware and record any gaps as decisions or follow-ups.

## Scope
- ARCHITECTURE §6.7, §9 (crash recovery, logs).
- systemd `WatchdogSec=30` + `sd_notify` heartbeat for core-api and hw-service, `Type=notify`
  on both (method in Notes).
- Enable the Pi hardware watchdog (`RuntimeWatchdogSec=15` in `/etc/systemd/system.conf`) via
  install.sh.
- End-to-end hw-down states on real hardware: coordinator unplugged (H9), router unpowered (R7),
  blaster unpowered (H25), mosquitto/zigbee2mqtt stopped `[ASSUMED]`, hw-service stopped.
- Resync after phone sleep (H4) on a real phone; reconnect under Wi-Fi drop.
- SQLite: `PRAGMA integrity_check` on boot logged; `event_log` pruning verified.
- Log volume check: journald cap, no per-event info logs in steady state.
- Final SPEC acceptance checklist `docs/reviews/ACCEPTANCE.md`: every row of the M00 coverage
  table ticked or linked to an open item.

## Out of scope
New features, HTTPS, multi-room.

## Acceptance criteria
1. Pull the Pi's power during normal use and plug it back in: within 2 minutes the screen shows
   S1 live, a phone that was open shows "Back online" and current values; no manual step.
2. `sudo kill -STOP $(pgrep -f core-api)` (hang): systemd restarts it within ~45 s (watchdog);
   same for hw-service.
3. Unplug the Zigbee coordinator: every client shows "Coordinator offline" (red), Zigbee cards in
   offline state; plug it back: recovers without restart.
4. Power off the lighting switch's circuit: S2 shows "ONE ROUTER LEFT"; sensors keep reporting.
5. Unpower the IR blaster: S1 IR controls and S3 Test/Re-learn disabled with "IR blaster offline".
6. Phone left asleep 10 minutes while someone changes lights from the Pi screen: on waking it shows
   the new state (never the old one as current).
7. `journalctl --disk-usage` ≤ 200 MB cap configured; one hour idle produces < 1 MB of logs.
8. `docs/reviews/ACCEPTANCE.md` exists with every SPEC element from M00 marked pass / fail /
   deferred, and each fail or deferral has a decision record or an issue noted.

## Notes for the planner
- Watchdog pings must come from the event loop, so a blocked loop actually stops them; ping
  every `WatchdogSec/3`.
- No libraries for sd_notify. hw-service: stdlib `socket` AF_UNIX datagram to `$NOTIFY_SOCKET`.
  core-api: Node `dgram` has no unix datagram sockets, so call `systemd-notify READY=1` /
  `WATCHDOG=1` via `child_process.execFile` with `NotifyAccess=all` on the unit.
- Run real-hardware pytest (`-m hardware`) as part of the acceptance walk-through.
