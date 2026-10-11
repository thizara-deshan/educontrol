# Prompt 06 — Tooling Gap Analysis

> **Phase 3 — Architect** · Step 1 of 3 *(optional but recommended)*
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** `PRD.md`, `FEATURES.md`, rules file
> **Output:** Updated rules file (library table) + updated PRD sections

## When to use

Before writing RFCs. The PRD and rules name the big technologies (framework,
database, hosting), but features quietly imply many smaller libraries — forms,
toasts, date handling, validation, commit hooks. This prompt finds those gaps now
so RFC and plan generation never has to invent dependencies on the fly.

## The prompt

```text
You are a senior full-stack engineer preparing a greenfield project for
implementation. The project has a PRD, a feature inventory, and development rules —
but no code yet.

Your task: Read EVERY doc in this project workspace, then produce a **technology
gap analysis** by doing the following:

### Step 1 — Understand the Product
Read all docs in the project. For each doc, extract:
- Every named technology, library, framework, service, or tool already specified
- Every UI pattern implied by the features (forms, toasts, modals, tables, date
  displays, drag-and-drop, icons, copy-to-clipboard, rich text, etc.)
- Every server-side concern implied by the features (validation, auth, rate
  limiting, job queues, file export, email, env config, etc.)
- Every DX/quality concern implied by the dev rules (linting, formatting, commit
  hygiene, pre-commit hooks, type-checking, migration tooling, etc.)

### Step 2 — Identify Gaps
For each UI pattern, server-side concern, and DX concern you found, check whether
the existing tech stack **explicitly names** a library or tool that handles it.
Flag anything that is:
1. **Required but missing** — the PRD/features demand this capability and no
   library is listed (e.g., forms exist but no form library, toasts are needed but
   no toast library, dates are compared but no date utility)
2. **Implicitly assumed** — a listed library depends on another library that isn't
   mentioned (e.g., shadcn depends on tailwind-merge, clsx, lucide-react,
   react-hook-form, and sonner for its standard components)
3. **Strongly recommended for DX** — industry-standard tooling that the dev rules
   imply but don't name (e.g., commit linting, pre-commit hooks, env validation,
   migration CLI)

Do NOT flag things that are:
- Nice-to-have but not implied by any feature or rule
- Covered by a named tool already (don't duplicate)
- Out of scope per the PRD's explicit non-goals

### Step 3 — Output Format
Produce a markdown table with these columns:

| Gap | Category | Library/Tool Recommendation | Why It's Needed | Which Feature/Rule Implies It |
|-----|----------|-----------------------------|-----------------|-------------------------------|

Categories: `UI dependency`, `Server dependency`, `DX tooling`,
`Implicit dependency of named tool`

Then produce a second section: **Recommended additions to the Required Libraries
And Tools table:**

Show the exact rows to add, formatted as:

| Purpose | Library Or Tool | Version Baseline |
|---------|-----------------|------------------|

Use the latest stable version as of today's date for each.

### Step 4 — Update the docs
After I approve the table, update:
1. The `Required Libraries And Tools` table in the development rules doc
2. The `Proposed Planning Stack` section in the PRD (keep it high-level, just
   ensure nothing contradicts)
3. The `Third-Party Dependencies` section in the PRD if a new category of
   dependency was introduced

Do NOT:
- Add libraries for features marked "Won't Have" or "Out of Scope"
- Add heavy abstractions the dev rules warn against
- Change architectural decisions — only fill in missing leaf-level packages
- Invent features or behaviors not in the PRD
```

## Steps

1. Open a **new** chat.
2. Paste the prompt and attach `PRD.md`, `FEATURES.md`, and your rules file.
3. **Gate:** Review the gap table before approving doc updates. Don't accept every
   suggestion — do a quick background check on unfamiliar libraries and approve
   only what your project actually needs.

## Done when

- [ ] Gap table reviewed; each accepted row is something a feature/rule truly implies
- [ ] Rules file's library table and PRD updated and committed
