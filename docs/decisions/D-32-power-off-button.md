# D-32 — S1 header "Power off" shuts the Pi down

Date: 2026-10-19 · Status: **requested by the owner 2026-10-19** · Adds to: SPEC S1 header (new element after
S1.E8), ARCHITECTURE §3.3 `api/system.ts` and §9 systemd units.

## Context

The owner asked for a power-off button with an icon in the top-right corner of the controls screen, behind an
"are you sure?" dialog, that shuts the system down. SPEC has no such element; the only system action is S3e
"Restart controller" (technician, D-23).

## Decision

1. S1 header, rightmost: **Power off** (power icon; label from `lg`, icon-only 48×48 below). Tap → confirm
   dialog "Power off the controller?" with Cancel · **Power off**. A `view` session gets S4 (room PIN) first.
2. `POST /api/system/shutdown`, `config.access = "control"` (everything on S1 needs `control`; the kiosk always
   has it). Answers 202, logs a `system`/`shutdown` event, then runs `SHUTDOWN_COMMAND` after 250 ms.
3. Same path as D-23: `SHUTDOWN_COMMAND=/usr/bin/touch /var/lib/eduscope/shutdown.request`;
   `eduscope-shutdown.path` starts root oneshot `eduscope-shutdown.service` → `systemctl --no-block poweroff`.
   No sudoers entry. Unset (dev): core-api logs a warning and does nothing.

## Consequences

- Anyone with the room PIN (or at the kiosk) can power the room controller off. It comes back only when its power
  is cycled; every screen shows the connection banner until then.
- A Pi installed before D-32 needs the `SHUTDOWN_COMMAND` line added to `/etc/eduscope/core.env` by hand
  (install.sh never edits an existing env file).
