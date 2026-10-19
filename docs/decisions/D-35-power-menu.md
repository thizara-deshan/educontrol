# D-35 — The S1 power button opens a menu: Restart (Pi reboot) and Shut down

Date: 2026-10-19 · Status: **requested by the owner 2026-10-19** · Supersedes: D-32 decision 1 (one "Power off"
button straight to a confirm).

## Decision

1. S1 header, rightmost: power icon (label "Power" from `lg`, icon-only 48×48 below). Tap → dropdown menu,
   aligned to the button's right edge, with two 48px items: **Restart** and **Shut down**.
2. Each item asks for the room PIN first on a `view` session (S4), then opens a confirm dialog:
   "Restart the controller?" (Cancel · Restart) or "Shut down the controller?" (Cancel · Shut down).
3. **Restart reboots the Pi** (not just the services; S3e "Restart controller" is unchanged and stays technician
   only). `POST /api/system/reboot`, `config.access = "control"`, 202 then `REBOOT_COMMAND` after 250 ms, the
   same path as D-32: `REBOOT_COMMAND=/usr/bin/touch /var/lib/eduscope/reboot.request`, `eduscope-reboot.path`
   → root oneshot `eduscope-reboot.service` → `systemctl --no-block reboot`. Unset (dev): logged only.
4. Shut down is D-32's `POST /api/system/shutdown`, unchanged.

## Consequences

- Anyone with the room PIN (or at the kiosk) can reboot the Pi; every screen shows the connection banner for about a
  minute, then resyncs (H3 → H4).
- A Pi installed before D-35 needs `REBOOT_COMMAND` added to `/etc/eduscope/core.env` by hand.
