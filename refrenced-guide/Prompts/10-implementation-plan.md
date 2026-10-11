# Prompt 10 — Implementation Plan (per RFC)

> **Phase 5 — Plan & Build** · Step 1 of 3 — run once **per RFC**
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** One RFC, rules file, codebase (if prior RFCs implemented), design artifacts (if any)
> **Output:** `docs/plans/PLAN-RFC-{NNN}-{title}.md`

## When to use

For each RFC, right before building it. The plan converts the RFC spec into
bite-sized TDD tasks with real code in every step — no placeholders.

This prompt is **design-aware**: if you did the optional Design phase (Prompt 09),
UI tasks automatically reference your design tokens, components, and `.pen` files.
If no design artifacts exist, it detects that and plans UI work normally — so this
single prompt covers both paths.

## Variables

Fill these in before use:

```
{{SPEC_FILE}}               — e.g. "docs/rfcs/RFC-001-project-foundation-and-cicd.md"
{{SPEC_FORMAT}}             — e.g. "RFC", "PRD", "user story", "feature spec"
{{SPEC_ID_PREFIX}}          — e.g. "RFC", "PRD", "US", "FEAT"
{{DEV_RULES_FILE}}          — e.g. ".github/copilot-instructions.md", ".cursorrules"
{{PRIOR_SPECS_IMPLEMENTED}} — e.g. "RFC-001, RFC-002" or "none — this is the first"
{{PLANS_DIR}}               — e.g. "docs/plans/"
{{DESIGN_PLANS_DIR}}        — e.g. "docs/plans/ui/" (where ui-design-*.md files live)
{{DESIGN_FILES_DIR}}        — e.g. "designs/" (where .pen/.fig design files live)
{{DESIGN_FILE_EXT}}         — e.g. ".pen", ".fig", ".penpot"
{{DESIGN_TOOL}}             — e.g. "Pencil.dev", "Figma", "Penpot"
```

## The prompt

````text
Use the **writing-plans** skill to create an implementation plan from the
{{SPEC_FORMAT}} below.
Use the **test-driven-development** skill for all task step structure.

### Input

- **Spec file:** `{{SPEC_FILE}}`
- **Development rules:** `{{DEV_RULES_FILE}}`
- **Prior specs already implemented:** {{PRIOR_SPECS_IMPLEMENTED}}

### Instructions

1. Read the spec completely. Read the development rules.
2. If prior specs are listed, read the current codebase to understand what
   already exists (schemas, types, utilities, patterns established).
3. **Detect UI work** (see Design-Aware Planning below).
4. Announce: "I'm using the writing-plans skill to create the implementation
   plan." If design artifacts were found, also announce: "Design artifacts
   detected — UI tasks will reference existing design tokens and plans."

---

### Design-Aware Planning

Before defining tasks, determine whether this spec involves any user-facing
surfaces (pages, components, panels, dialogs, forms, layouts, styles).

**If the spec touches UI, perform this discovery step:**

1. **Check for UI design plan documents.**
   Look in `{{DESIGN_PLANS_DIR}}` for files matching `*ui-design*.md`.
   Read any that exist. These plans contain:
   - The chosen aesthetic direction (design system name, visual philosophy)
   - Design token definitions (colors, typography, spacing, radii)
   - Surface-to-spec traceability (which surfaces map to which spec/feature IDs)
   - Component inventory (shared components, their names, their patterns)
   - State requirements (empty, loading, error, populated states per surface)

2. **Check for a design system foundation document.**
   Look for a plan whose title contains "System Foundation" or "Design Tokens".
   This is the source of truth for:
   - CSS variable names and values
   - Typography scale (font families, sizes, weights)
   - Color palette (semantic names, hex values, dark/light variants)
   - Spacing and radius scales
   - Component patterns (card styles, button variants, form layouts)

3. **Check for design files.**
   Look in `{{DESIGN_FILES_DIR}}` for `{{DESIGN_FILE_EXT}}` files.
   Key files to locate:
   - `_tokens{{DESIGN_FILE_EXT}}` — design token definitions
   - `_components{{DESIGN_FILE_EXT}}` — shared component designs
   - Any file matching the surfaces this spec introduces

4. **Check for an existing global stylesheet.**
   Look for `globals.css` or equivalent in the codebase. If it already
   contains design token CSS variables, UI tasks must use those variables
   rather than hardcoding values.

**Based on what you find, apply one of these modes:**

- **Design artifacts exist for this spec's surfaces →** UI tasks MUST
  reference the design plan's token values, component names, layout
  structures, and state requirements. Include a "Design Reference" block
  at the top of each UI task listing the source design plan, relevant
  {{DESIGN_FILE_EXT}} files, and the specific surface frames to implement.
  If the design plan specifies empty/loading/error states, the
  implementation task must cover all of them.

- **Design artifacts exist but don't cover this spec's surfaces →** UI
  tasks must still use the established design tokens and component patterns
  from the foundation document. Note which surfaces lack design coverage
  and flag them for design work in the plan header.

- **No design artifacts exist →** Proceed normally. UI tasks define their
  own styles, but should still extract CSS variables and follow the project's
  component library patterns to make future design system adoption easy.

**Add a design context block to the plan header:**

```markdown
**Design Artifacts:**
- Design system: [found/not found] — [file path or "N/A"]
- UI plans covering this spec: [list of plan files or "none"]
- Design files: [list of relevant {{DESIGN_FILE_EXT}} files or "none"]
- Surfaces without design coverage: [list or "all covered"]
```

When writing UI task code, follow these rules based on design discovery:

- **Token usage:** If a design system defines `--color-canvas: #F5F1E8`,
  use `var(--color-canvas)` in component code — never hardcode the hex.
- **Component naming:** If the design plan names a component (e.g., "Item Card /
  Default"), the implementation component should match that name.
- **Layout fidelity:** If a design plan specifies a two-column layout at
  specific widths, implement those dimensions.
- **State coverage:** If a design plan defines empty, loading, and error
  frames for a surface, the implementation task must include all three
  states — not just the populated view.
- **Typography:** If the design system specifies font families (e.g., one
  display family for headings, another for body text), use them in the
  implementation.

---

### Plan Requirements

Follow the writing-plans skill exactly, with these additions:

**File structure first.** Before defining tasks, map every file that will be
created or modified. Use the project's recommended folder structure from the
development rules. Each file gets one clear responsibility.

**TDD is mandatory.** Every task that produces logic follows the
test-driven-development skill's Red-Green-Refactor cycle:
- Step: Write the failing test (show full test code)
- Step: Run it, verify it fails (show exact command and expected failure)
- Step: Write minimal implementation (show full code)
- Step: Run it, verify it passes (show exact command)
- Step: Commit (show exact git command)

**Task sizing.** Each task should take 2-5 minutes of focused work. One task =
one behavior or one component. If a task description contains "and", split it.

**No placeholders.** Every step contains actual code, actual file paths, actual
commands. "Add appropriate error handling" is a plan failure — show the error
handling code.

**Schema tasks come first.** If the spec defines new tables or columns, the
first task is always the migration. Later tasks depend on it.

**Design-informed UI tasks.** If design artifacts were found (see above), UI
component tasks must include a "Design Reference" block before the TDD steps:

```markdown
**Design Reference:**
- Plan: `docs/plans/ui/YYYY-MM-DD-ui-design-[scope].md`, Task N
- File: `designs/pages/[surface]{{DESIGN_FILE_EXT}}`
- Frame: "[Surface Name] / Primary"
- States: primary, empty, loading, error
- Tokens: references `_tokens{{DESIGN_FILE_EXT}}` variables
- Components: reuses [Component Name] from `_components{{DESIGN_FILE_EXT}}`
```

**Acceptance criteria verification.** The final task in every plan is an
integration check that verifies each acceptance criterion from the spec can be
demonstrated.

---

### Execution Method Selection

After writing the plan, analyze the tasks and annotate the plan header with
the recommended execution method:

**Choose Subagent-Driven (default) when:**
- Most tasks touch different files/modules (low coupling between tasks)
- The platform supports subagents
- Tasks don't require heavy back-and-forth with shared mutable state

**Choose Executing-Plans when:**
- Tasks are tightly sequential and each modifies the previous task's output
- The platform doesn't support subagents
- The user explicitly prefers inline execution

Add this to the plan header:

```
> **Recommended execution:** Subagent-Driven Development
> **Reason:** {N} of {M} tasks are independent (touch separate files).
> **Alternative:** Use executing-plans if subagents are unavailable.
```

Or:

```
> **Recommended execution:** Executing-Plans (inline)
> **Reason:** Tasks are tightly coupled — {explain why}.
> **Alternative:** Use subagent-driven-development if tasks can be isolated.
```

### Plan Location

Save to: `{{PLANS_DIR}}PLAN-{{SPEC_ID_PREFIX}}-{NNN}-{title}.md`

### After Saving

Present the execution choice:

"Plan saved. Based on task analysis, I recommend **{method}** because {reason}.

1. **Subagent-Driven** — Fresh subagent per task, two-stage review (spec + quality), fast iteration
2. **Inline Execution** — Execute tasks in sequence with checkpoints for your review

Which approach?"
````

## Example — filled variables for Nexus-CRM RFC-001

```
{{SPEC_FILE}}               = docs/rfcs/RFC-001-project-foundation-and-cicd.md
{{SPEC_FORMAT}}             = RFC
{{SPEC_ID_PREFIX}}          = RFC
{{DEV_RULES_FILE}}          = .github/copilot-instructions.md
{{PRIOR_SPECS_IMPLEMENTED}} = none — this is the first
{{PLANS_DIR}}               = docs/plans/
{{DESIGN_PLANS_DIR}}        = docs/plans/ui/
{{DESIGN_FILES_DIR}}        = designs/
{{DESIGN_FILE_EXT}}         = .pen
{{DESIGN_TOOL}}             = Pencil.dev
```

## Steps

1. Open a **new** chat.
2. Paste the prompt with variables filled for the RFC you're about to build.
3. Review the generated plan: check task ordering, that schema/migration tasks
   come first, and that no step says "add appropriate X" without showing the code.
4. Don't execute yet — run [Prompt 11 (External Dependencies)](11-external-dependencies.md)
   first so manual setup doesn't break plan execution halfway.

## Done when

- [ ] `docs/plans/PLAN-RFC-{NNN}-*.md` saved with TDD steps and real code
- [ ] Header shows the recommended execution method
- [ ] (If designs exist) UI tasks carry Design Reference blocks
