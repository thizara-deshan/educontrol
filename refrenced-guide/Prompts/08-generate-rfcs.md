# Prompt 08 — Generate RFCs

> **Phase 3 — Architect** · Step 3 of 3
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** `PRD.md`, `FEATURES.md`, rules file, installed skills
> **Output:** `docs/rfcs/RFC-001…N.md` + `docs/rfcs/RFC-000-index.md`

## When to use

Once the docs are complete and skills are installed. RFCs (Request for Comments)
break the product into small, sequential, independently testable technical specs.
One RFC ≈ 1–3 days of focused work; each one is later turned into its own
implementation plan.

## The prompt

````text
You are a senior software architect breaking down a project into RFC (Request for
Comments) documents for sequential implementation. The project has a PRD, a feature
inventory, and development rules but no code yet.

### Input Documents

Read ALL docs in the workspace thoroughly. The primary inputs are:
- **PRD** — product vision, user journeys, non-functional requirements, delivery sequence
- **FEATURES** — the canonical feature inventory with IDs, priorities, acceptance
  criteria, dependencies, and edge cases
- **Development rules** (e.g., copilot-instructions.md, AGENTS.md) — tech stack,
  architecture rules, coding standards, testing requirements, security constraints

When documents conflict, the FEATURES acceptance criteria are authoritative (per the
project's own conflict-resolution rule).

---

### Step 1 — Build the Dependency Graph

Before grouping anything, produce a **feature dependency analysis**:

1. List every Must Have and Should Have feature ID from FEATURES.md
2. For each, list its explicit `Dependencies` field AND any implicit dependencies
   you infer (e.g., a feature needs another even if not stated, because it relies
   on infrastructure or a framework that feature delivers)
3. Identify **foundation layers** — features that are prerequisites for many others
4. Identify **leaf features** — features with no downstream dependents
5. Identify the **critical path** — the longest dependency chain from first to last

Output this as a textual directed graph and a summary table:

| Feature ID | Feature Name | Depends On | Blocks | Layer |
|------------|-------------|------------|--------|-------|

Where Layer is one of: Foundation, Core, Workflow, Surface, Enhancement.

---

### Step 2 — Group into RFCs

Using the dependency graph, group features into RFCs following these principles:

1. **Sequential implementability** — RFC N+1 can only depend on features delivered
   in RFCs 1 through N. No forward references.
2. **Cohesion** — group features that share the same domain, data model, or UI
   surface. Don't split tightly coupled features across RFCs.
3. **Right-sizing** — each RFC should represent roughly 1-3 days of focused work for
   a small team. Not a single function, not a two-week epic.
4. **Testability** — each RFC should produce a testable, demonstrable increment.
   After implementing an RFC, you should be able to run the app and verify
   something works.
5. **Foundation first** — database schema, auth, and shared infrastructure come
   before features that consume them.
6. **Follow the project's delivery sequence** — if the development rules define
   delivery phases, respect that phasing as the primary ordering constraint.

Present the proposed grouping as a summary table and STOP for approval:

| RFC | Title | Features Included | Depends on RFCs | Phase | Complexity |
|-----|-------|-------------------|-----------------|-------|------------|

Include a brief rationale for any non-obvious grouping decisions.

---

### Step 3 — Write the RFCs

After grouping is approved, generate each RFC as a separate file under `docs/rfcs/`.

**Naming convention:** `RFC-001-kebab-case-title.md`

**RFC structure:**

```
# RFC-{number}: {Title}

## Summary
One paragraph: what this RFC delivers and why it matters at this point in the build.

## Features Addressed
- F{XX} — {Name} ({Priority})
  (repeat for each feature in this RFC)

## Dependencies
- **Requires:** RFC-001, RFC-002 (list predecessors)
- **Enables:** RFC-005, RFC-007 (list what this unblocks)

## Technical Design

### Data Model Changes
- New tables, columns, indexes, RLS policies
- Migration considerations
- Show actual SQL or schema pseudocode for new tables

### API Surface
- New endpoints or server actions
- Request/response shapes (use TypeScript types)
- Validation rules (Zod schemas)

### Key Implementation Details
- Architecture decisions specific to this RFC
- Algorithms or business logic (e.g., eligibility, scoring, or scheduling rules)
- State management approach
- Error handling strategy

### UI Components
- New pages, layouts, or components needed
- Key interaction patterns
- Accessibility considerations
- Empty, loading, error, and success states

## Acceptance Criteria
Copy the acceptance criteria from FEATURES.md for each included feature.
Add any integration-level criteria that span multiple features in this RFC.

## Edge Cases and Risks
Consolidate edge cases from FEATURES.md for included features.
Add any cross-feature edge cases introduced by the grouping.

## Testing Strategy
- Unit tests: what business logic to test
- Integration tests: what API/data flows to test
- E2E tests: what user journeys become testable after this RFC
- Reference specific testing rules from the development rules doc

## Security Considerations
List relevant security requirements from the development rules that apply to this RFC.

## Applicable Development Rules
Reference specific numbered rules from the development rules doc that
constrain this RFC's implementation (don't copy them — cite by section and number).

## Open Questions
List anything ambiguous that the implementer should resolve before starting.
```

---

### Step 4 — Leverage Installed Skills

When writing RFC technical details, check whether any installed agent skill
provides relevant guidance:

- If a **React/Next.js skill** is installed, reference its patterns for component
  architecture, data fetching, or routing decisions
- If an **accessibility skill** is installed, use it to specify WCAG compliance
  approach in UI-heavy RFCs
- If a **testing skill** is installed, align the testing strategy section with its
  recommended patterns
- If a **Supabase or database skill** is installed, use it for RLS policy design
  and migration patterns

Do NOT invent skill-specific advice. Only reference skills that are actually
installed. When a skill provides relevant guidance, note it in the RFC:
`> Skill reference: {skill-name} — used for {what}`

---

### Step 5 — Generate the RFC Index

Create `docs/rfcs/RFC-000-index.md` containing:

1. **Implementation roadmap** — ordered list of all RFCs with titles
2. **Dependency matrix** — table showing which RFCs depend on which
3. **Phase mapping** — which RFCs belong to each delivery phase
4. **Feature coverage** — every Must Have and Should Have feature ID mapped to its
   RFC, confirming nothing was dropped
5. **Out of scope** — list Won't Have features explicitly excluded, to prevent
   scope creep

---

### Rules

- **Only include Must Have and Should Have features.** Could Have features get
  their own RFCs at the end, clearly marked as optional.
- **Won't Have features are never included** in any RFC.
- **Do not invent features.** Every requirement in an RFC must trace back to a
  feature ID or a development rule.
- **Do not include implementation prompts.** RFCs are specifications, not execution
  instructions. Implementation plans will be created separately from the RFCs.
- **Do not add TODOs or placeholders.** If something is unknown, put it in
  Open Questions.
- **Cite, don't copy** development rules. Reference by section and number
  (e.g., "Security Rule 1", "AI Workflow Rule 6") rather than duplicating text.
- **Keep RFCs self-contained for reading** but cross-reference other RFCs by number
  for dependencies.
- **Show actual types, schemas, and SQL** where the data model is defined. Keep
  pseudocode minimal — prefer real TypeScript/SQL that could be used as-is.
- **Flag ambiguities** rather than guessing. If the PRD is unclear on a behavior,
  list it as an Open Question rather than making up a design.
````

## Steps

1. Open a **new** chat.
2. Paste the prompt and attach `PRD.md` and `FEATURES.md` (rules are read from the
   workspace).
3. **Gate 1:** review the dependency graph and RFC grouping table before approving.
4. Approve, and let it write all RFCs plus the index.
5. **Gate 2:** skim each RFC's Open Questions — resolve them now or carry them
   consciously.

## Done when

- [ ] `docs/rfcs/` contains numbered RFCs + `RFC-000-index.md`
- [ ] Index's feature-coverage table shows every Must/Should feature mapped
- [ ] No RFC depends on a later RFC
- [ ] Committed to git
