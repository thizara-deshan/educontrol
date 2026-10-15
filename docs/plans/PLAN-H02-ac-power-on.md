# PLAN-H02 — Air conditioning "Power on" command (capture, test, send)
Milestone: none (scoped by `docs/decisions/D-26-ac-power-on-command.md`; not in M00-index) · Start tag: `h02-start` ·
Verify-all: `pnpm verify`

**Do not execute until the owner has approved D-26** (change its *Status* line to `accepted` and answer Q-a/Q-b; if an
answer differs from the recommendation, tell the planner before T1). Run it **after** H01's T13 is finished.

Inputs read for this plan: D-26; SPEC S1.E35/E36, R3, R4, R5, Q5, Q23 (via grep); CLAUDE.md; PLAN-H01 (format, executor notes);
code: `packages/contracts/src/domain/ir.ts` (`IrCommandRole` already has `power_on`), `api/ir.ts` (`IrCommandCreate` accepts
`power_on` with `setpoint: null`); `apps/core-api/src/{db/seed.ts, db/settings.ts, db/ir.ts, commands/ir-codes.ts,
commands/policies.ts (case "ac.power"), domain/ac.ts, ir/service.ts}`; kiosk `features/settings/remote/{forms.ts,
AddCommandSheet.tsx, remote.view.ts}`, `data/adapters/mock/fake-ir.ts`.
**Not verified while writing this plan:** nothing was run or applied. Tasks are instructions with the exact files and
behaviour, not patches; the executor writes the code to match the surrounding style and proves it with the tests named.
**No contract change** (the role exists), **no schema/migration change** (role is text), **no hw-service change**
(the dispatcher already sends any stored code by role). If the executor finds otherwise: Blocker.

## Executor notes (read once, apply to every task)

- Repo root `/home/eduscope/edcontrol`. Before T1: `git tag h02-start`.
- After each task: its **Verify**, then `pnpm verify`; tick the box; one commit with the task's message (plan file included).
- Never edit SPEC, ARCHITECTURE, milestones, other plans, or D-26. Never touch `reference/`. No UI beyond T3.
- `[ON PI · HUMAN]` steps need a person in R-101 or root; ask, never work around.
- Same failure after 2 fix attempts, or any ambiguity: `## Blockers`, commit, stop.

## Tasks

### T1 — core-api: seed the AC "Power on" row (new and existing databases)
- [x] done

**Files:** `apps/core-api/src/db/seed.ts`, `apps/core-api/src/db/settings.ts` (add the setting key), their tests
(`seed` tests next to it; find with `grep -rl "SEED_IR_COMMANDS" apps/core-api/src`).

**Do:**
1. `SEED_IR_COMMANDS`: add `irCommand("ac.power_on", "ac", "Power on", "power_on", 0)` before `ac.power_off` (comment: AC has 15,
   D-26). Fix the doc comment above it ("AC 15 = power on + power off + 13 setpoints").
2. `SettingKey` (db/settings.ts): add `ac_power_on_seeded`.
3. In `seed()`, after the first-boot block: if `readSetting(db, "ac_power_on_seeded", z.boolean()) === null` then (a) when the
   `ac` device exists and no `ir_commands` row has `device_id = "ac"` and `role = "power_on"`, insert the `ac.power_on` row;
   (b) `writeSetting(db, "ac_power_on_seeded", true, now)` (both cases, so a database created with the new seed is also marked).
4. The `SEED_FAKE_IR_CODES` loop already fills `code` for every row of `SEED_IR_COMMANDS`; no change.

**Test:** fresh database → 15 AC commands, `ac.power_on` first (sort 0), setting set. Database seeded the old way (insert the 14
old rows, no setting) → after `seed()` exactly one `ac.power_on`, uncaptured, setting set. Run `seed()` again → still one.
Delete `ac.power_on`, run `seed()` → not re-created (Q-b). Update any existing test that asserts 14 AC commands.

**Verify:** `pnpm --filter @eduscope/core-api test` → passes; `pnpm verify` green.

**Commit:** `feat(core-api): seed the AC Power on command once`

### T2 — core-api: S1 AC Power on sends the captured power-on code
- [x] done

**Files:** `apps/core-api/src/commands/policies.ts` (case `"ac.power"`), `apps/core-api/src/domain/ac.ts`
(only if a pure helper is useful), tests beside `policies` (find with `grep -rl "ac.power" apps/core-api/src --include=*.test.ts`).

**Do:** in `case "ac.power"` for `body.on`:
1. If `ir.find("ac", { role: "power_on" })` is `ok` → `irPlan(model, ir, timeouts, "ac", { role: "power_on" }, "ac", { after })`
   where `after` = `withAc(m, { power: "on" }, at, by)` (no `setpoint_c`: D-26.3).
2. Else keep the existing code (`powerOnSetpoint`, refuse message changed to
   `"Air conditioning has no captured power-on or setpoint frame"` when it returns null).
3. `body.on === false` unchanged. Use whatever the existing `irPlan` already does for lookup errors; do not duplicate the lookup
   if `irPlan` can express "role, else setpoint" — if it cannot, do the `find` call in the case and pass the chosen match.

**Test (core-api, existing style for policies):** with a captured `ac.power_on` code → the hw call carries that code and
`after` leaves `setpoint_c` untouched (known stays, unknown stays); without it but with a setpoint code → today's behaviour
(setpoint assumed too); with neither → refused with the new text; power off unchanged; −/+ after a dedicated power-on with
unknown setpoint is refused by `stepTarget` (existing message).

**Verify:** `pnpm --filter @eduscope/core-api test` → passes; `pnpm verify` green.

**Commit:** `feat(core-api): AC Power on uses the captured power-on code`

### T3 — kiosk: mock data and "+ Add a command" for the AC Power on
- [ ] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-ir.ts`, `apps/kiosk/src/features/settings/remote/{forms.ts,
AddCommandSheet.tsx}`, tests next to them (`forms.test.ts`, `remote.view.test.ts`, mock tests that count AC commands).

**Do:**
1. `seededCommands()`: add `{ ...base, id: "ir-ac-on", device_id: "ac", name: "Power on", role: "power_on", setpoint: null }`
   before `ir-ac-off` (comment: AC 15, D-26). Fix the doc comment ("AC 15").
2. `forms.ts` `commandInput`: for `kind === "ac"` accept a `powerOn` flag (or a role choice) that yields
   `{ name: "Power on", role: "power_on", setpoint: null }`; otherwise unchanged.
3. `AddCommandSheet.tsx`: for an AC that has **no** `power_on` command, show a two-way choice "Setpoint / Power on" (use the
   existing `ChoiceGroup`); "Power on" hides the temperature/mode/fan fields and the description reads "Saves as “Power on”,
   then listens for the remote." If the AC already has `power_on`, the sheet is unchanged. Touch targets ≥ 48 px, design tokens
   only, works at 390 px and 1280×800 (CLAUDE.md). No other S3 change: the seeded row already shows Re-learn / Test / status.
4. The duplicate guard in core-api (`duplicateSetpoint`) only covers setpoints; do **not** touch core-api here. If creating a
   second `power_on` for the AC must be refused, that is a Blocker (add to D-26 first), not extra scope.

**Test:** `commandInput("ac", …)` for power on gives the contract input and passes `IrCommandCreate`; selectors count AC as
"15 commands" with the mock data; the sheet's choice logic as a pure function in `forms.ts` (no markup tests).

**Verify:** `pnpm --filter @eduscope/kiosk test` and `pnpm --filter @eduscope/kiosk typecheck` pass; `pnpm verify` green;
`pnpm --filter @eduscope/kiosk dev` (mock mode): S3 → Air conditioning lists "Power on" first, Re-learn and Test work.

**Commit:** `feat(kiosk): AC Power on command in S3 (mock data, add sheet)`

### T4 — Acceptance on the Pi (D-26)
- [ ] done

**Files:** this plan only (tick; failures under `## Blockers`).

**Do:** `[ON PI · HUMAN]` `! sudo deploy/pi/install.sh` (builds and restarts), then:
1. S3 (technician PIN) → Air conditioning shows **15 commands** and "Power on" as **Not captured**; the count badge is amber.
2. Re-learn "Power on": set the remote so its power-on button turns the AC on, point it at the ZS06, press **once** within 20 s →
   **captured · untested**. Turn the AC off, tap **Test** → the AC turns on → answer **reacted** → **tested ✓**.
3. S1 (room PIN): AC Power off, then Power on → the AC turns on with the **power-on code** (not a setpoint beep sequence); the AC
   card shows **On · assumed (IR)**; the setpoint reads as before the tap (unknown after a restart), and −/+ are disabled until a
   setpoint is sent (D-26.3). `journalctl -u eduscope-core --since -2min --no-pager` shows no `has no captured`.
4. Delete the captured "Power on" in S3 (or use a spare room's database) → S1 Power on falls back to the setpoint frame; restart
   `eduscope.target` → the row is **not** back (Q-b); "+ Add a command" on the AC offers **Power on** and re-creates it.
5. `pnpm verify` green; `git status --short` clean apart from this plan file.

**Verify:** all five pass as written; otherwise `## Blockers` and stop.

**Commit:** `docs: H02 acceptance walk-through`

## Nice-to-haves (not tasks)

- Let S1 − / + start from the lowest captured setpoint when the AC is assumed on with an unknown setpoint.
- A refusal in core-api for a second `power_on` on the same device (needs a line in D-26).
- The same dedicated-command idea for AC modes (heat/fan) if the room ever needs them.

## Blockers

(executor writes here; leave empty)
