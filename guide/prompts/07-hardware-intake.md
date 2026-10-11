# Prompt 07 — Hardware intake

> **Hardware loop** · once per drop from the hardware engineer · **Model:** Opus 5.5 · new session
> **Inputs:** `reference/hardware-drops/<drop>/`, ARCHITECTURE, contracts, hw-service code
> **Output:** `docs/hardware/INTAKE-NN-<slug>.md` + `docs/milestones/Hxx-<slug>.md`

## When to use
Each time the hardware engineer sends Python/bash files. Those files will
contain test scripts, hardcoded values, prints, `while True` loops, and code
unrelated to us. This step separates the **facts** we need (protocols, topics,
payloads, pins, codes, timings, init sequences) from the clutter. It then designs
how those facts become clean hw-service modules. After that, the new Hxx milestone
goes through the normal 04 → 05 → 06 loop.

## Before running
```bash
mkdir -p reference/hardware-drops/2026-10-14-ir-blaster
# copy the files in unchanged, and add a NOTES.txt with whatever the engineer said
git add reference/hardware-drops && git commit -m "chore: hardware drop ir-blaster"
```
These are untrusted, unreviewed files. Don't run them during intake.

## Variables
```
{{DROP}}   — reference/hardware-drops/2026-10-14-ir-blaster
{{NN}}     — next intake number, e.g. 01
```

## The prompt
````text
You are an embedded-systems engineer integrating hardware code written by
someone else into a clean, modular FastAPI service. The files in the drop are
REFERENCE MATERIAL: they are not to be imported, copied wholesale, or run.

### Inputs
- Every file in `{{DROP}}` (read all of them, including NOTES.txt)
- `docs/ARCHITECTURE.md` (hw-service module pattern, contracts, assumptions)
- `docs/SPEC.md` (what the UI needs from hardware)
- `packages/contracts/` and `services/hw/` (what already exists)
- Previous `docs/hardware/INTAKE-*.md`

### Process
1. **Inventory.** Table: | File | What it does | Relevant? (yes/partly/no) |
   Hardware touched | Deps | Problems (hardcoded secrets, blocking loops,
   global state, prints, sudo, magic numbers) |
2. **Extract facts.** Every hardware fact we need, each with a source
   citation `file:line`: device IDs, MQTT topics and payload shapes, serial
   ports/baud, GPIO pins, I2C addresses, IR code formats and the actual
   captured codes, timings/retries, init sequences, units and thresholds.
   Mark what is confirmed in code vs guessed.
3. **Map to capabilities.** For each relevant piece: which hw-service
   module it belongs to (existing or new), and which SPEC elements it powers
   (S1.E…). Call out SPEC elements still lacking hardware support.
4. **Check assumptions.** Compare against ARCHITECTURE's `[ASSUMED]` items.
   List each as confirmed / contradicted / still unknown. If something is
   contradicted, say a Change Record (prompt 08) is needed.
5. **Design the integration.**
   - Per module: driver interface methods, real-driver approach (async, no
     blocking loops, reconnect strategy, timeouts), fake-driver behavior,
     pydantic schemas, events emitted, config keys (.env, with defaults).
   - Contract changes needed in packages/contracts / core-api / kiosk.
   - Bash scripts: classify each as (a) one-time Pi setup → goes to
     `deploy/pi/` (e.g. enabling interfaces, installing packages, udev rules),
     (b) runtime behavior → reimplemented in Python, or (c) discard.
   - New Python deps (prefer what's already in use).
6. **Discard list.** What we're dropping and why.
7. **Questions for the hardware engineer.** Specific, answerable ones.

### Output
- `docs/hardware/INTAKE-{{NN}}-<slug>.md` with sections 1–7.
- `docs/milestones/Hxx-<slug>.md` in the standard milestone format
  (Goal / Scope / Out of scope / Acceptance criteria / Notes for the
  planner). Acceptance criteria must include a real-hardware check on the Pi
  (e.g. "Tapping Lights › Front of room toggles the physical light within
  1 s and the UI shows Confirmed").
- Add the Hxx row to `docs/milestones/M00-index.md`.

### Rules
- Never import from or reference `reference/` at runtime.
- Preserve hardware constants exactly as found, with citations. Never "clean
  up" an IR code or payload.
- Secrets/credentials found in the drop: don't copy them into docs. Name them
  as env keys and flag them.
- Rewrite, don't copy-paste: the new code follows the module pattern.

### Gate
Present the inventory table, extracted facts, assumption check, and
questions. STOP for my review (I may ask the engineer first). Then write files.
````

## After intake
1. Send the questions to the hardware engineer if any block the work.
2. Run 08 if an architecture assumption was contradicted.
3. **On the Pi:** 04 (Opus) → 05 (Sonnet) → 06 (Opus) for the Hxx milestone.
