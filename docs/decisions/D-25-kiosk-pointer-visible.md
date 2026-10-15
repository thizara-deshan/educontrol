# D-25 — The kiosk shows the mouse pointer

Date: 2026-10-15 · Milestone: M10 · Supersedes: PLAN-M10 Decision D6 ("no cursor": labwc window rule with
`WarpCursor` + `HideCursor`) and M10 acceptance item 7 "no pointer".

## Context

D6 hid the pointer on the kiosk with a labwc window rule and assumed that moving the mouse would show it
again (`[ASSUMED]`). On R-101 (observed 2026-10-15, after the `--kiosk` install and a reboot) a USB mouse is
attached, the pointer stayed hidden and the operator could not click with it.

## Decision

1. install.sh `--kiosk` no longer writes a labwc `rc.xml` window rule. `deploy/pi/kiosk/labwc_rc.py` and its
   test are removed, and `pnpm pi:test` runs only `test-lib.sh` again.
2. The pointer is visible. Touch use is unaffected.
3. On a Pi where the rule was already installed, the user's `~/.config/labwc/rc.xml` keeps it until removed by
   hand (R-101: already done); install.sh never edits that file.

## Consequences

- A touch-only kiosk shows a pointer after the first mouse movement or at boot; hiding it is not part of M10.
