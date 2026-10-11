# Prompt 04 — Plan a milestone

> **Build loop** · once per milestone · **Model:** Opus 5.5 · new session
> **Inputs:** one milestone file, SPEC, ARCHITECTURE, CLAUDE.md, current code
> **Output:** `docs/plans/PLAN-Mxx-<slug>.md`

## When to use
Before building each milestone. This is the most important Opus step, because the
plan has to leave Sonnet nothing to decide.

## Variables
```
{{MILESTONE}}  — e.g. docs/milestones/M03-control-page.md
```

## The prompt
````text
You are a senior engineer writing an implementation plan that a less capable
model will execute literally, task by task, without asking questions.

### Inputs
- Milestone: `{{MILESTONE}}`
- `docs/SPEC.md` (only the referenced sections, plus design tokens)
- `docs/ARCHITECTURE.md`, `CLAUDE.md`
- The current codebase. Read it so you reuse existing components, hooks,
  schemas, and patterns instead of inventing parallel ones.
- If the milestone touches UI: the matching image in `reference/screens/`
  (and `reference/prototype/` if present). Look at it directly.
- If it is an Hxx milestone: its `docs/hardware/INTAKE-*.md`.

### Plan format
```
# PLAN-Mxx — Title
Milestone: … · Start tag: mxx-start · Verify-all: <command from CLAUDE.md>

## File map
| File | Create/Modify | Responsibility |

## Tasks
### T1 — <one behavior or one component>
- [ ] done
**Files:** exact paths
**Context:** SPEC refs; screenshot region (e.g. "screen 01, right column,
  Air conditioning card"); components/hooks to reuse
**Do:**
  numbered steps. Give FULL code for: schemas, types, hooks, state logic,
  adapters, drivers, tricky layout. For straightforward markup, give the
  component skeleton with props, the token/class names to use, and every
  state that must render.
**Test:** (logic tasks only) the test file and test cases (full code)
**Verify:** exact command(s) + what success looks like
**Commit:** `git commit -m "feat(kiosk): …"`

## Checkpoints
After T<n>: "Human: run `pnpm dev`, compare with screen 01 at <resolution>"

## Blockers
(executor writes here; leave empty)
```

### Rules
- Order: contracts/schema → data layer → shared components → screens →
  wiring → acceptance task.
- One task = one behavior/component, ~5–15 minutes for the executor. Split
  anything containing "and".
- No vague steps ("handle errors appropriately", "style as in design"). Say
  exactly which state, which token, which copy, which error message.
- UI tasks must name every state: default, pending, confirmed, assumed,
  failed, offline/stale (where SPEC defines them).
- Tokens only. Never raw hex in components.
- Hardware tasks: real + fake driver, pytest against the fake, plus one
  manual verify step on the Pi for the real driver (marked `[ON PI]`).
- Final task: walk every acceptance criterion of the milestone, with the
  command or manual check for each.
- Don't add scope beyond the milestone. Put "nice-to-haves" in a short list at
  the end without making them tasks.

### Gate
Write the plan file, then summarize: task count, risky tasks, anything
in the milestone you think is wrong. STOP.
````

## Gate checklist (read the plan, ~5 min)
- [ ] Task order is sane, and contracts/schemas come before their consumers
- [ ] Hard logic has full code. No "appropriately" or "as needed"
- [ ] UI tasks list all states and point to a screenshot region
- [ ] Commit: `git commit -am "docs: PLAN-Mxx"`
