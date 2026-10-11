# Prompt 05 — Execute a plan

> **Build loop** · per plan (repeat until every task is ticked) · **Model:** Sonnet 5.5 · new session
> **Inputs:** `docs/plans/PLAN-Mxx-*.md`, `CLAUDE.md` (auto-loaded)
> **Output:** Code, ticked checkboxes, one commit per task

## When to use
After you've approved a plan, and again later to apply the fix tasks that prompt 06 appends.

## Variables
```
{{PLAN}}   — e.g. docs/plans/PLAN-M03-control-page.md
```

## The prompt
````text
Execute `{{PLAN}}`.

1. Read CLAUDE.md and the whole plan first.
2. Start at the first unticked task. For each task, in order:
   a. Do exactly the steps listed, in the listed files.
   b. Run the task's Verify command and the plan's Verify-all command.
   c. If both are green: tick the task's checkbox in the plan, then commit
      with the given message (include the plan file change).
   d. If red: fix within the task's scope. After 2 failed attempts, STOP.
3. At a "Checkpoint", STOP and tell me what to check.
4. If a step is ambiguous, contradicts the code, or needs a decision the
   plan doesn't make: do NOT improvise. Write it under "## Blockers" in the
   plan (task, problem, options you see), commit, and STOP.
5. Never edit SPEC, ARCHITECTURE, milestones, or other plans. Never add
   scope. Never touch `reference/`.
6. When finished or stopped, report: tasks done, tasks left, blockers.
````

## If it stops
- **Checkpoint:** do the manual check, then reply "continue".
- **Blocker:** open an Opus session and say *"Resolve the blockers in {{PLAN}}:
  update the plan tasks, clear the Blockers section."* Then run 05 again.
- **Same failure twice:** escalate the bug to Opus (`/model opus`). Ask for the root
  cause before any fix.
