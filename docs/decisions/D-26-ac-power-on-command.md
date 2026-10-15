# D-26 — The air conditioning gets a "Power on" command

Date: 2026-10-15 · Milestone: H01 (raised during acceptance) · Status: **accepted by the owner 2026-10-15** (Q-a: setpoint stays
unknown; Q-b: insert once) · Supersedes: SPEC S1.E35 ("Send AC frame for the current setpoint"), the AC row of the S1 failure table
("AC Power on → IR frame for current setpoint"), Q23's command set "power off + 13 setpoints (14 commands)" and
`apps/core-api/src/domain/ac.ts` `powerOnSetpoint` as the only power-on path.

## Context

SPEC treats an AC state frame as power + mode + temperature + fan (R4), so AC Power on has no frame of its own: it
replays the stored setpoint frame. On R-101 (observed 2026-10-15, H01 acceptance) S3 therefore shows no "Power on" row for
the air conditioning, and the technician cannot capture or test one. The AC remote does have a power-on button
whose frame is not the same as a setpoint frame (it resumes the AC's last state).

Already true in the code (checked 2026-10-15): `IrCommandRole` has `power_on`; the DB stores `role` as text; the IR code
lookup `IrMatch` and the dispatcher accept `{ role: "power_on" }` (the projector uses it); `POST /api/ir/devices/:id/commands`
accepts `role: "power_on"` with no setpoint; S3 lists every command of a device with Test and Re-learn. No contract change is
needed. What is missing: a seeded AC row, the S1 policy using it, and a way for S3 to re-create it.

## Decision

1. The AC gets **one more command**, `ac.power_on`, "Power on", role `power_on`, listed first (sort 0). The AC has
   15 commands: power on, power off, 13 setpoints (Q23 otherwise unchanged).
2. **S1 AC Power on** (S1.E35) sends the captured `power_on` code when there is one; otherwise it keeps today's behaviour
   (the frame for `powerOnSetpoint`); with neither it is refused: "Air conditioning has no captured power-on or
   setpoint frame". Power off is unchanged.
3. After a dedicated power-on frame the state is `power: on` (assumed). `setpoint_c` is **left as it was** (the AC resumes
   its last setpoint, which core-api cannot know): unknown stays unknown, so S1 −/+ stay disabled until a setpoint is
   sent (Q5/R4 unchanged). After the setpoint-frame fallback both power and setpoint are assumed as today.
4. **Existing databases:** seeding only runs on an empty database, so startup inserts `ac.power_on` **once** into a database
   that already has the AC device but no AC command with role `power_on`, then records the setting `ac_power_on_seeded`.
   A technician who later deletes the row does not get it back on restart.
5. **S3:** the new row appears like every other (Re-learn, Test, status line). "+ Add a command" for an AC offers
   "Power on" while the AC has none, so a deleted row can be re-created.
6. `SEED_FAKE_IR_CODES` and the kiosk mock adapter include the new command, so dev and `VITE_API_MODE=mock` match.

## Consequences

- Rooms with a learned `power_on` code turn the AC on the way the remote's own button does; rooms without one behave as before.
- S1 −/+ after a dedicated power-on need a first setpoint; an option for later is to let − / + start from the lowest
  captured setpoint (not decided here).
- S3 counts change: AC "15 commands" (was 14); device count and `needs attention` include the new row until captured and tested.
- SPEC is not edited (CLAUDE.md); this record wins over the lines listed under *Supersedes*.
- H01 is unaffected: its acceptance (T13) uses setpoint frames, as the plan says.

## Answered questions (owner, 2026-10-15)

- Q-a: Is "setpoint stays unknown after a dedicated power-on" acceptable (decision 3), or should S1 assume the last
  setpoint core-api sent before? **Answer: unknown.**
- Q-b: One-time insert (decision 4) versus ensuring the row on every start. **Answer: one-time.**
