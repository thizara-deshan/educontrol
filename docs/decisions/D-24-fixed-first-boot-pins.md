# D-24 — Fixed first-boot PINs for the demo (room 1234, technician 123456)

Date: 2026-10-15 · Milestone: M10 · Supersedes: PLAN-M10 Decision D4 ("first PINs random, no PIN hardcoded").

## Context

PLAN-M10 D4 generated random first-boot PINs and printed them once. For the real demo the owner wants
PINs that are fast to type on the touch screen and the phones, and said they will change them afterwards
(Settings → Devices → Room PIN / Technician PIN → Change).

## Decision

1. `deploy/pi/env/core.env.example` sets `INITIAL_ROOM_PIN=1234` and `INITIAL_TECH_PIN=123456`.
2. `ensure_env_file` still generates the cookie secret randomly; it no longer generates or reports PINs.
3. These PINs are used only on the first start with an empty database (unchanged core-api behaviour).
   Both are trivially guessable: **change them in the app right after the demo.**

## Consequences

- Anyone on the room network who tries 1234 can unlock room control, and 123456 opens Settings, until the PINs
  are changed. Accepted by the owner for the demo.
- `/etc/eduscope/core.env` is still created once and never rewritten, so changing the example later does not
  alter an installed Pi.
