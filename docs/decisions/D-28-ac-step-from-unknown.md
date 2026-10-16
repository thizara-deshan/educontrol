# D-28 — AC − / + work while the setpoint is unknown

Date: 2026-10-16 · Status: **accepted by the owner 2026-10-16** (option A) · Amends: D-26 decision 3 ("S1 −/+ stay
disabled until a setpoint is sent") and SPEC S1.E38/E40 for the unknown-setpoint case. Takes up the option D-26 left
open under *Consequences*.

## Context

Since D-26, AC Power on sends the captured `power_on` code and leaves `setpoint_c` unknown. `stepTarget` refused −/+
with "Air conditioning setpoint is unknown" and S1 disabled both buttons. Nothing on S1 sends a setpoint frame while a
`power_on` code exists (S3 Test does not change room state), so on R-101 (observed 2026-10-16: power on assumed,
setpoint `null`, captured 18/19/22) −/+ could never become enabled.

## Decision

1. AC assumed On, setpoint unknown, at least one captured setpoint: **− sends the lowest captured setpoint, + the
   highest.** Afterwards the setpoint is assumed as for any step and −/+ step normally (R4, H19).
2. With no captured setpoint, −/+ are refused ("Air conditioning has no captured setpoint frame") and disabled on S1.
3. Unchanged: Q5 (−/+ refused and disabled unless the AC is assumed On), D-26 Power on behaviour, the setpoint shown
   as `—` until a frame is sent.
4. Applied in core-api `domain/ac.ts` `stepTarget`, kiosk `ac.view.ts` and the mock adapter's `stepSetpoint`.

## Consequences

- The first −/+ tap after a dedicated power-on jumps to an end of the captured range, which may be far from the AC's
  own (unknown) temperature.
