# Prompt 06 — Review & verify a milestone

> **Build loop** · once per milestone, after 05 finishes · **Model:** Opus 5.5 · new session
> **Inputs:** milestone, plan, `git diff mxx-start`, screens, running app
> **Output:** `docs/reviews/REVIEW-Mxx.md` + fix tasks appended to the plan

## When to use
When every task in the plan is ticked. A milestone is done when its acceptance
criteria are shown working in the running app, and the executor saying "done"
doesn't count.

## Variables
```
{{MILESTONE}}  — docs/milestones/M03-control-page.md
{{PLAN}}       — docs/plans/PLAN-M03-control-page.md
{{START_TAG}}  — m03-start
{{RESOLUTION}} — e.g. 1280x800
```

## The prompt
````text
You are a strict reviewer verifying a milestone before it is accepted.

### Inputs
`{{MILESTONE}}`, `{{PLAN}}`, `CLAUDE.md`, `docs/SPEC.md`, and the diff
`git diff {{START_TAG}}..HEAD`.

### Process
1. Run Verify-all (typecheck, tests, lint, build). Report the results.
2. Check each acceptance criterion: PASS / FAIL / CAN'T VERIFY, with evidence.
3. UI milestones: start the dev server, take a screenshot at {{RESOLUTION}}
   (use Playwright via `pnpm dlx playwright screenshot` or a small script),
   and compare it against the matching `reference/screens/` image. List
   visible differences: layout, spacing, color, type, copy, missing states.
   Also check that pending/assumed/failed/offline states render (switch the
   mock adapter into those states).
4. Code review of the diff. Look only for: contract violations (no zod at a
   boundary), raw hex / off-token styles, duplicated components that should
   reuse existing ones, logic without tests, hardware code outside the module
   pattern, secrets/pins hardcoded, anything that breaks on a Pi (paths,
   arch-specific deps, ports).
5. Classify each finding: MUST-FIX (blocks acceptance) or LATER.

### Output
- `docs/reviews/REVIEW-Mxx.md`: verify results, criteria table, visual diff
  list, findings.
- Append to `{{PLAN}}` a section `## Fix tasks (review 1)` with each
  MUST-FIX as a task in the same format as the plan (Files / Do / Verify /
  Commit), concrete enough for the executor.
- LATER items go to `docs/milestones/M00-index.md` under "Backlog".

### Gate
Summarize: PASS/FAIL per criterion, number of fix tasks. STOP.
````

## After the review
- Fix tasks present → run **05** (Sonnet) on the same plan, then run 06 again (ideally once).
- All PASS → update status in `M00-index.md`, `git tag mxx-done`, next milestone.
- **Frontend complete gate (after M05):** on Arch run
  `chromium --kiosk --window-size={{RESOLUTION}} http://localhost:5173` and use
  it like a lecturer would for 5 minutes.
