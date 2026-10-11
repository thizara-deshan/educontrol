# Prompt 12 — Mid-Development Architectural Change (ADR)

> **Phase 6 — Evolve** · Run whenever a planning-time decision must change
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** All project docs + codebase
> **Output:** `docs/rfcs/ADR-{NNN}-*.md`, changelog entries in affected docs, migration checklist

## When to use

A technical decision made during planning (PRD, RFCs, or implementation plans) needs
to change after some code has already been written. Examples: swapping an AI
provider, changing a database, replacing a UI library, switching auth strategies,
adding a new integration not in the original plan.

## Why it matters

Projects evolve. Requirements shift, better tools emerge, or you discover a
technical constraint mid-build. The goal is to make the change **traceable**, update
all downstream artifacts, and ensure AI agents follow the NEW decision going forward
— without rewriting history.

## Variables

Fill these in before use:

```
{{PROJECT_NAME}}            — e.g. "Nexus-CRM", "Acuity Dashboard"
{{WHAT_IS_CHANGING}}        — e.g. "AI provider layer", "authentication strategy", "CSS framework"
{{OLD_DECISION}}            — e.g. "AWS Bedrock direct SDK integration", "NextAuth.js", "CSS Modules"
{{NEW_DECISION}}            — e.g. "Vercel AI SDK (provider-agnostic)", "Supabase Auth", "Tailwind CSS"
{{WHY_CHANGING}}            — e.g. "Need provider-agnostic AI layer", "Simplify auth to single provider"
{{RFCS_DIR}}                — e.g. "docs/rfcs/"
{{PLANS_DIR}}               — e.g. "docs/plans/"
{{DEV_RULES_FILE}}          — e.g. ".github/copilot-instructions.md", ".cursorrules", "RULES.md"
{{AGENT_INSTRUCTIONS_FILE}} — e.g. "CLAUDE.md", "AGENTS.md" (file AI agents read for current project state)
{{RFCS_AFFECTED}}           — e.g. "RFC-001, RFC-003, RFC-007" or "all RFCs that reference the old decision"
{{PLANS_AFFECTED}}          — e.g. "PLAN-RFC-001, PLAN-RFC-003" or "unknown — needs analysis"
{{CODE_ALREADY_BUILT}}      — e.g. "RFC-001 is implemented, RFC-002 is in progress" or "no code yet"
```

## The prompt

````text
You are a senior software architect managing a mid-project technical decision change.
The project has existing documentation (PRD, RFCs, implementation plans, development
rules) and may already have code written based on the OLD decision. Your task is to
make this change cleanly — traceable, minimal disruption, and with AI agents following
the new decision going forward.

- **Project:** {{PROJECT_NAME}}
- **What is changing:** {{WHAT_IS_CHANGING}}
- **Old decision:** {{OLD_DECISION}}
- **New decision:** {{NEW_DECISION}}
- **Why:** {{WHY_CHANGING}}
- **Code already built:** {{CODE_ALREADY_BUILT}}
- **RFCs potentially affected:** {{RFCS_AFFECTED}}
- **Plans potentially affected:** {{PLANS_AFFECTED}}

### Step 1 — Impact Analysis

Read ALL project documentation in the workspace. Produce an impact report:

1. **Search all RFCs** in `{{RFCS_DIR}}` for references to the old decision.
   For each match, note the file, section, and what specifically references it
   (a dependency, an API design, a schema, a testing strategy, etc.).

2. **Search all implementation plans, external-setup guides** in `{{PLANS_DIR}}`
   for references to the old decision. For each match, note the file, task number,
   and whether the task has already been executed (check if the files it creates
   already exist in the codebase).

3. **Search the codebase** for imports, configuration, types, or usage of the
   old decision's libraries, APIs, or patterns.

4. **Search development rules** in `{{DEV_RULES_FILE}}` and
   `{{AGENT_INSTRUCTIONS_FILE}}` for references to the old decision.

Produce a summary table:

| Location | File | What References Old Decision | Status | Action Needed |
|----------|------|------------------------------|--------|---------------|
| RFC      | ...  | ...                          | Not yet implemented | Update RFC |
| Plan     | ...  | Task 3: Install old SDK      | Already executed | Code change needed |
| Code     | ...  | `import { OldClient }`       | In production | Refactor |
| Rules    | ...  | "Required Libraries" table   | Active | Update |

Status values: `Not yet implemented`, `Already executed`, `In codebase`, `Active`

**APPROVAL GATE:** Present this table and STOP. Wait for the user to confirm the
scope of impact before making any changes.

---

### Step 2 — Write the Architecture Decision Record (ADR)

Create an ADR document that records what changed, why, and what it affects.
This is a NEW document — never rewrite existing RFCs or plans to hide the
original decision.

**File location:** `{{RFCS_DIR}}ADR-{NNN}-{kebab-case-title}.md`

**ADR numbering:** Use the next available number after existing ADRs. If this is
the first ADR, use `ADR-001`.

**ADR structure:**

```markdown
# ADR-{NNN}: {Title — e.g., "Switch to Vercel AI SDK for provider-agnostic AI"}

**Date:** {today's date}
**Status:** Accepted
**Supersedes:** {list any previous ADR this replaces, or "N/A"}

## Context

{2-3 sentences: What was the original decision and why it was made?}

{2-3 sentences: What changed that prompted this reassessment?}

## Decision

{1-2 sentences: What is the new decision?}

## Consequences

### What changes
{Bulleted list of concrete changes to the project — dependencies added/removed,
env vars changed, patterns affected, RFCs impacted}

### What doesn't change
{Bulleted list of things that remain the same — reassure readers about the scope}

### Migration path
{For code already written: what needs to be refactored?}
{For code not yet written: what do future RFCs/plans need to do differently?}

## Affected Artifacts

| Artifact | File | Change Required |
|----------|------|----------------|
| RFC-001  | ...  | Add changelog entry referencing this ADR |
| Plan     | ...  | Task 3 needs rewrite |
| Code     | ...  | Remove old dependency, add new one |
| Rules    | ...  | Update library table |
```

---

### Step 3 — Update Affected Documents

After the ADR is approved, make targeted updates. Follow these rules strictly:

1. **RFCs — Add a changelog entry, don't rewrite.**
   At the top of each affected RFC, add or append to a `## Changelog` section:

   ```markdown
   ## Changelog

   - {date}: {One-line description of what changed}. See ADR-{NNN}.
   ```

   In the body of the RFC, if a section now contradicts the new decision,
   add an inline note:

   ```markdown
   > **Updated per ADR-{NNN}:** {brief correction}. Original text preserved
   > below for historical context.
   ```

   Do NOT delete original text from RFCs. The history has value.

2. **Implementation plans — Update unexecuted tasks, flag executed ones.**
   - For tasks NOT yet executed: rewrite the task steps with the new decision's
     libraries, imports, and patterns. Mark with `> Updated per ADR-{NNN}`.
   - For tasks already executed: do NOT change the plan. Instead, add a new
     task at the appropriate position titled "Migrate {component} per ADR-{NNN}"
     with concrete refactoring steps.

3. **Development rules — Update to reflect current truth.**
   Rules files should always reflect the CURRENT state. Update library tables,
   architecture rules, and tool references. Add a comment noting the change:
   `<!-- Updated per ADR-{NNN}, {date} -->`

4. **Agent instructions — Update to enforce new decision.**
   In `{{AGENT_INSTRUCTIONS_FILE}}` (and `{{DEV_RULES_FILE}}`), add or update
   guidance so that AI agents follow the new decision. This is the MOST IMPORTANT
   update because it prevents agents from reverting to the old pattern:

   ```markdown
   ## {Topic} (Updated per ADR-{NNN})

   Use {new decision} for all {domain} work. Do not use {old decision} patterns.
   ```

5. **Codebase — Generate a migration checklist.**
   If code already exists that uses the old decision, produce a concrete
   migration checklist (not a plan — a checklist of specific changes):

   ```markdown
   ## Code Migration Checklist (ADR-{NNN})

   - [ ] Remove `old-package` from package.json
   - [ ] Install `new-package@version`
   - [ ] Update `src/lib/env/server.ts` — remove OLD_ENV_VAR, add NEW_ENV_VAR
   - [ ] Update `.env.example` — same changes
   - [ ] Refactor `src/lib/old-client.ts` → `src/lib/new-client.ts`
   - [ ] Update all imports of old client
   - [ ] Run tests to verify nothing breaks
   ```

   Save this checklist to: `{{PLANS_DIR}}adr-checklist/ADR-{NNN}-migration-checklist.md`

---

### Step 4 — Present Summary

After all updates are made, present:

1. **Files created:** list each new file
2. **Files modified:** list each modified file with a one-line summary of changes
3. **Code migration needed:** yes/no, and link to the migration checklist
4. **Unresolved items:** anything that needs manual attention or a decision

---

### Rules

- **Never rewrite history.** RFCs and plans are living documents with a changelog,
  not clean-slate rewrites. The original decisions have pedagogical and audit value.
- **Always create an ADR.** Even if the change feels small. ADRs are cheap;
  confusion from undocumented changes is expensive.
- **Agent instructions are the source of truth for current decisions.** RFCs
  capture what was planned; agent instructions capture what IS. Update agent
  instructions immediately.
- **Don't cascade unnecessarily.** If an RFC mentions the old decision only in
  a "Tech Stack" header but no task depends on it, a changelog note is sufficient.
  Only rewrite task-level details that would cause incorrect implementation.
- **Test after migration.** If code changes are needed, the migration checklist
  must end with a verification step (run tests, run build, etc.).
- **One ADR per decision.** Don't bundle multiple unrelated changes into one ADR.
  If switching AI provider AND changing auth strategy, write two ADRs.
````

## Example — filled variables for Nexus-CRM (the real ADR-001)

```
{{PROJECT_NAME}}            = Nexus-CRM
{{WHAT_IS_CHANGING}}        = AI provider integration layer
{{OLD_DECISION}}            = AWS Bedrock direct SDK (@aws-sdk/client-bedrock-runtime)
{{NEW_DECISION}}            = Vercel AI SDK (provider-agnostic, supports Bedrock/OpenAI/Anthropic/Google/Groq)
{{WHY_CHANGING}}            = Bootcamp needs to demonstrate multiple AI providers; students should swap providers without code changes
{{RFCS_DIR}}                = docs/rfcs/
{{PLANS_DIR}}               = docs/plans/
{{DEV_RULES_FILE}}          = .github/copilot-instructions.md
{{AGENT_INSTRUCTIONS_FILE}} = AGENTS.md
{{RFCS_AFFECTED}}           = RFC-001 (env vars), RFC-006+ (AI features)
{{PLANS_AFFECTED}}          = PLAN-RFC-001 (Task 1 dependencies, Task 3 env schema)
{{CODE_ALREADY_BUILT}}      = RFC-001 almost fully implemented — env schemas require AWS_* vars, package.json includes @aws-sdk/client-bedrock-runtime
```

The real outputs for this example:
`docs/rfcs/ADR-001-switch-to-vercel-ai-sdk-and-ai-gateway.md` and
`docs/plans/adr-checklist/ADR-001-migration-checklist.md`.

## Steps

1. Open a **new** chat.
2. Paste the prompt with variables filled.
3. **Gate:** review the impact table — confirm the scope before any file changes.
4. Approve the ADR, then the document updates, then work through the migration
   checklist and run the verification step.

## Done when

- [ ] ADR saved under `docs/rfcs/` with status Accepted
- [ ] Affected RFCs have changelog entries (history preserved, not rewritten)
- [ ] Rules + agent instruction files reflect the NEW decision
- [ ] Migration checklist complete, tests/build green
