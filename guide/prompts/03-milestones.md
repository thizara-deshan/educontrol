# Prompt 03 — Milestones

> **Setup** · run once (07 adds hardware milestones later) · **Model:** Opus 5.5 · new session
> **Inputs:** `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`
> **Output:** `docs/milestones/M00-index.md` + one `Mxx-<slug>.md` per milestone

## When to use
After architecture is approved. Milestones play the role of the reference guide's RFCs,
but they're smaller and lighter: each one is half a day to one day of work and ends with
something you can see running.

## The prompt
````text
You are a technical lead splitting a one-week build into milestones.

### Inputs
Read `docs/SPEC.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`.

### Starting proposal (adjust it if SPEC/ARCHITECTURE warrant)
- M01 Foundation: workspace, kiosk Vite app, Tailwind + shadcn, design tokens,
  packages/contracts, Vitest, root scripts
- M02 Shell & data layer: app header (brand, clock, status, room, nav),
  routing, shared components, ApiClient + mock adapter + WS simulation,
  kiosk hardening (no select, no context menu, touch sizes)
- M03 Control page (S1)
- M04 Devices page (S2)
- M05 Settings page (S3 + inferred tabs, technician gate)
  ── FRONTEND COMPLETE GATE ──
- M06 core-api: Fastify, Drizzle schema + seed for the room, routes per
  contracts, WS fan-out, serves kiosk build, kiosk http adapter
- M07 hw-service skeleton: FastAPI, module pattern, all modules with fake
  drivers, event stream, core-api integration
- M08 Pi deploy: install script, systemd units, Chromium kiosk autostart,
  screen blanking, logs
- Hxx: (reserved, created by hardware intake)
- M99 Hardening: restart/recovery, hw offline states end-to-end, watchdog,
  log rotation, final acceptance against SPEC

### For each milestone file `docs/milestones/Mxx-<slug>.md`
```
# Mxx — Title
Depends on: …            Machine: Arch | Pi        Est: ½ day | 1 day
## Goal (2–3 sentences)
## Scope — SPEC refs (S1.E1, S1.E4…) and ARCHITECTURE sections covered
## Out of scope
## Acceptance criteria — numbered, each demonstrable (what I see/run)
## Notes for the planner — gotchas, reuse, decisions already made
```

### `docs/milestones/M00-index.md`
Table: | ID | Title | Depends on | Machine | Est | Status |
plus a coverage check: every SPEC element ID → milestone ID. No SPEC element
may be unassigned.

### Rules
- No forward dependencies.
- Each milestone must be demoable when it's done.
- Acceptance criteria must be observable. "Code is clean" is not a criterion.

### Gate
Present the index table + coverage gaps. STOP for approval. Then write files.
````

## Gate checklist
- [ ] Frontend (M01–M05) fits in ~2.5 days
- [ ] Every SPEC element is covered
- [ ] Commit: `git commit -am "docs: milestones"`
