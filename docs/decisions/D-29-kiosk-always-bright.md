# D-29 — The kiosk screen never dims or blanks

Date: 2026-10-16 · Status: **requested by the owner 2026-10-16** · Supersedes: SPEC §2.6 "Screen sleep" (dim to ~20%
after 5 min idle, blank after 15 min, occupancy wakes it) and H23 for R-101's kiosk.

## Context

R-101's kiosk dimmed after 5 min without a touch and went black after 15 min (H23, `features/kiosk/idle-timer.ts`).
The owner wants the room screen always at full brightness, idle or not.

## Decision

1. `KIOSK_IDLE_TIMINGS` sets `dimMs` and `blankMs` to `null`: the kiosk stays `awake`. The idle timer still supports
   dim/blank timings (tested), so turning sleep back on is a one-line change under a new record.
2. Unchanged: after 2 min idle the kiosk returns to S1 and drops technician access (SPEC §2.3).
3. The wake-tap guard (R15) and occupancy wake only act while asleep, so they no longer have any effect; their code stays.
4. OS screen blanking stays off (install.sh `--kiosk`), so nothing else dims the panel.

## Consequences

- The panel is lit around the clock; turning it off at night is a manual step (or a later backlight capability).
