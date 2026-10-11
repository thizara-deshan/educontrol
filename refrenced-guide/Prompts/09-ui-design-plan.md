# Prompt 09 — UI Design Plans (Design-First Approach)

> **Phase 4 — Design** · *Optional fork — skip straight to Prompt 10 if you're not designing first*
> **Run in:** IDE agent with a design tool MCP (e.g., Pencil.dev) — **new chat**
> **Inputs:** `docs/rfcs/*.md`, rules file
> **Output:** `docs/plans/ui/*.md` design plans → executed into `designs/*.pen` files

## When to use

After RFCs, before implementation plans, **if** you want a visual source of truth
before any code is written. Designing first lets you control the look manually and
makes UI implementation tasks reference real designs instead of inventing styles.

If you skip this phase, Prompt 10 still works — it detects the absence of design
artifacts and plans UI work normally.

## Variables

Fill these in before use:

```
{{PROJECT_NAME}}        — e.g. "Nexus-CRM", "Acuity Dashboard", "FieldOps"
{{SPEC_LOCATION}}       — e.g. "docs/rfcs/", "specs/", "requirements/"
{{SPEC_FORMAT}}         — e.g. "RFCs", "PRDs", "user stories", "feature specs"
{{FEATURE_ID_SCHEME}}   — e.g. "F01–F44", "US-001–US-120", "FEAT-1–FEAT-30"
{{DESIGN_TOOL}}         — e.g. "Pencil.dev (.pen files)", "Figma", "Penpot"
{{DESIGN_TOOL_MCP}}     — e.g. "mcp_pencil_*", "mcp_figma_*" (or "none")
{{DESIGN_FILE_EXT}}     — e.g. ".pen", ".fig", ".penpot"
{{DESIGN_DOCS_SOURCE}}  — e.g. "context7 query-docs with library /websites/pencil_dev" (or "official docs at [URL]")
{{COMPONENT_LIBRARY}}   — e.g. "shadcn/ui", "Radix + custom", "Material UI", "Ant Design"
{{ICON_SET}}            — e.g. "Lucide icons", "Heroicons", "Phosphor Icons"
{{CSS_FRAMEWORK}}       — e.g. "Tailwind CSS", "vanilla CSS", "CSS Modules"
{{CODE_FRAMEWORK}}      — e.g. "Next.js, React, TypeScript", "Nuxt 3, Vue, TypeScript", "SvelteKit"
{{CODE_STRUCTURE_HINT}} — e.g. "src/app/(app)/", "src/routes/", "app/"
{{PROJECT_RULES_FILE}}  — e.g. "copilot-instructions.md", ".cursorrules", "CONTRIBUTING.md" (or "none")
{{VIEWPORT_STRATEGY}}   — e.g. "Desktop-first at 1280px+", "Mobile-first at 375px", "Responsive from 768px"
{{ACCESSIBILITY_STANDARD}} — e.g. "WCAG 2.1 AA", "WCAG 2.2 AA", "Section 508"
```

## The prompt

````text
You are creating focused UI design plans from completed {{SPEC_FORMAT}}.
The goal is to produce {{DESIGN_FILE_EXT}} design files in {{DESIGN_TOOL}}
that serve as the visual source of truth BEFORE any implementation code is written.

**Announce at start:** "I'm using the writing-plans, frontend-design, and
brainstorming skills to create the UI design plan."

**Required skills:** Load and follow these skills:
- `brainstorming` — for design exploration and approach proposals
- `frontend-design` — for aesthetic direction and distinctive UI choices
- `writing-plans` — for plan structure, bite-sized tasks, no placeholders

**Required tools:**
- {{DESIGN_TOOL}} tools ({{DESIGN_TOOL_MCP}}) for all {{DESIGN_FILE_EXT}} file operations
- {{DESIGN_DOCS_SOURCE}} for design tool documentation when needed

---

## Step 1: Identify UI Surfaces from {{SPEC_FORMAT}}

Read every spec in `{{SPEC_LOCATION}}`. For each spec:

1. Extract every user-facing screen, dialog, form, panel, empty state, error
   state, and loading state described in the functional requirements and
   acceptance criteria.
2. Classify each surface:
   - **Page** — full route (e.g., dashboard, detail view, list view)
   - **Panel** — embedded section within a page (e.g., detail panel,
     editor panel, summary panel)
   - **Dialog** — modal or sheet (e.g., confirmation dialogs, export options)
   - **Component** — reusable across pages (e.g., list item card, status badge,
     activity item, status indicator)
3. Note which spec and feature IDs ({{FEATURE_ID_SCHEME}}) each surface traces to.
4. Identify shared components that appear across multiple specs.

**Output:** Present a table to the user:

| Surface Name          | Type | Spec(s)    | Feature ID(s) | Priority  |
| --------------------- | ---- | ---------- | -------------- | --------- |
| Dashboard Overview    | Page | SPEC-005   | F21, F22       | Must Have |
| Detail Workspace      | Page | SPEC-004   | F06            | Must Have |
| ...                   | ...  | ...        | ...            | ...       |

**APPROVAL GATE:** Wait for the user to review and approve the surface
inventory before proceeding. Add, remove, or reprioritize as requested.

---

## Step 2: Define Design System Foundation

Before designing individual screens, establish the shared design language.

1. **Read project docs:** Check `{{PROJECT_RULES_FILE}}` for UI rules
   ({{VIEWPORT_STRATEGY}}, {{ACCESSIBILITY_STANDARD}}, keyboard-completable,
   semantic HTML, or any other constraints).
2. **Propose aesthetic direction** (per frontend-design skill):
   - Recommend 2–3 visual directions appropriate for the project's domain
     and target users.
   - Include: color palette, typography choices, spacing scale, component style
     (rounded vs sharp, dense vs spacious), dark/light theme approach.
   - Lead with your recommendation and explain why.
3. **Wait for user approval** on the aesthetic direction.

---

## Step 3: Split Surfaces into Separate Plan Documents

This is critical: DO NOT put all surfaces into a single plan. Split them into
**multiple independent plans**, each with **5–7 tasks maximum**.

**Splitting rules:**

1. **Plan 1 is always the Design System Foundation.** It creates design tokens
   and shared reusable components. Every other plan depends on Plan 1 being
   completed first. This plan includes:
   - Task: Create design tokens {{DESIGN_FILE_EXT}} file (colors, typography, spacing, radii)
   - Task: Sync tokens with project CSS variables if a global stylesheet exists
   - Task: Design shared components (buttons, inputs, badges, cards, nav items,
     empty states, loading skeletons, status indicators)

2. **Remaining plans follow the project delivery sequence.** Group surfaces by
   the phase or domain they belong to. Example grouping:
   - **Plan 2: Core Shells** — primary navigation, main pages, workspace layouts
   - **Plan 3: Feature-Specific Panels** — domain-specific panels and workflows
   - **Plan 4: Supporting Surfaces** — settings, export, onboarding, admin

   Adjust groupings based on the actual surface count. If a group exceeds 7
   tasks, split it further. If a group has only 1–2 tasks, merge it with an
   adjacent group.

3. **Dialogs and secondary states belong with their parent surface.** A delete
   confirmation dialog is a task within the plan that contains the page it
   appears on, not a separate plan.

4. **Each plan after Plan 1 must be independently executable.** It can assume
   Plan 1's tokens and components exist, but must not depend on other plans
   being completed first.

**Output:** Present the plan breakdown to the user:

| Plan   | File Name                          | Scope                          | Tasks | Depends On |
| ------ | ---------------------------------- | ------------------------------ | ----- | ---------- |
| Plan 1 | `ui-design-system-foundation.md`   | Tokens + shared components     | 3     | —          |
| Plan 2 | `ui-design-core-shells.md`         | Main pages, navigation         | 6     | Plan 1     |
| Plan 3 | `ui-design-feature-panels.md`      | Domain-specific workflows      | 5     | Plan 1     |
| Plan 4 | `ui-design-supporting-surfaces.md` | Settings, export, onboarding   | 4     | Plan 1     |

**APPROVAL GATE:** Wait for the user to approve the plan split before writing
any plan documents.

---

## Step 4: Write Each Plan Document

Write one plan document at a time, starting with Plan 1. For each plan:

### File structure for design files

```text
designs/
  _tokens{{DESIGN_FILE_EXT}}           ← design variables and theme definitions (Plan 1)
  _components{{DESIGN_FILE_EXT}}       ← shared reusable components (Plan 1)
  pages/
    dashboard{{DESIGN_FILE_EXT}}       ← Plan 2
    detail{{DESIGN_FILE_EXT}}          ← Plan 2
    list{{DESIGN_FILE_EXT}}            ← Plan 2
    settings{{DESIGN_FILE_EXT}}        ← Plan 4
  panels/
    [feature-panel]{{DESIGN_FILE_EXT}} ← Plan 3
  dialogs/
    [confirmation]{{DESIGN_FILE_EXT}}
  components/
    [shared-component]{{DESIGN_FILE_EXT}} ← Plan 1 (shared)
```

### Plan document header

```markdown
# UI Design Plan N: [Scope Name]

> **For agentic workers:** Use {{DESIGN_TOOL}} tools to execute this plan.
> Each task creates/updates {{DESIGN_FILE_EXT}} files that serve as the visual
> source of truth for implementation.

**Goal:** [One sentence]
**Design Direction:** [Chosen aesthetic in 1–2 sentences]
**Depends On:** [Plan 1 | None]
**Tech Stack:** {{DESIGN_TOOL}}, {{COMPONENT_LIBRARY}}, {{ICON_SET}}, {{CSS_FRAMEWORK}}
**Code Stack:** {{CODE_FRAMEWORK}} (for code generation reference)

---
```

### Task structure for each surface

```markdown
### Task N: [Surface Group Name]

**Surfaces:** [List of surfaces being designed]
**Traces to:** SPEC-XXX → F01, F02, ...
**File(s):** `designs/pages/[name]{{DESIGN_FILE_EXT}}`

**Design requirements** (extracted from spec acceptance criteria):
- [Specific UI requirement 1]
- [Specific UI requirement 2]
- [Accessibility requirement]
- [State variations: empty, loading, error, populated]

- [ ] **Step 1: Open or create the design file**
      Open or create the target {{DESIGN_FILE_EXT}} file using the design tool.

- [ ] **Step 2: Check current canvas state**
      Inspect the canvas to determine where to place new frames.

- [ ] **Step 3: Design the primary state**
      Create the main populated view.
  - Reference components from `_components{{DESIGN_FILE_EXT}}`
  - Apply variables from `_tokens{{DESIGN_FILE_EXT}}`
  - Use {{ICON_SET}}
  - Follow {{COMPONENT_LIBRARY}} layout patterns
  [Exact design operations — no placeholders]

- [ ] **Step 4: Screenshot and review**
      Capture and verify: layout correctness, visual hierarchy, spacing, accessibility.

- [ ] **Step 5: Design state variations**
      Create additional frames for: empty state, loading skeleton, error state.

- [ ] **Step 6: Screenshot all variations**
      Capture each state frame. Present all screenshots for review.

- [ ] **Step 7: Refine based on feedback**
      Apply any corrections.
```

---

## Step 5: Design-to-Code Reference Section

At the end of EACH plan (not just the last one), add a code generation reference
section specific to the surfaces in that plan:

```markdown
## Code Generation Reference

When implementing the designs from this plan, use these prompts to generate
starter code from each {{DESIGN_FILE_EXT}} file:

**For pages:**
"Generate a {{CODE_FRAMEWORK}} page component from this design using
{{CSS_FRAMEWORK}}, {{COMPONENT_LIBRARY}} components, and {{ICON_SET}}.
Follow the project structure in {{CODE_STRUCTURE_HINT}}."

**For reusable components:**
"Generate a component from this design using {{CSS_FRAMEWORK}} and
{{COMPONENT_LIBRARY}} primitives. Export from the project's component directory."

**For forms:**
"Generate this form with appropriate validation, {{COMPONENT_LIBRARY}} form
components, and type safety. Include error states."

**For design tokens sync:**
"Update the project's global stylesheet with the current design variables."
```

---

## Step 6: Save and Offer Next Steps

Save each plan to: `docs/plans/ui/YYYY-MM-DD-ui-design-[scope].md`

After writing ALL plan documents:

1. Present a summary table of all plans created with task counts.
2. Confirm that every surface from the Step 1 inventory is covered by exactly
   one plan.
3. Offer execution starting with Plan 1:

"All UI design plans created:

| Plan   | File                                     | Tasks |
| ------ | ---------------------------------------- | ----- |
| Plan 1 | `docs/plans/ui/...-ui-design-system-foundation.md` | 3     |
| Plan 2 | `docs/plans/ui/...-ui-design-core-shells.md`        | 6     |
| ...    | ...                                      | ...   |

Plan 1 (Design System Foundation) must be executed first. Plans 2–N can be
executed in any order after Plan 1.

**Execution options per plan:**
1. **Subagent-Driven (recommended for design work)** — fresh subagent per
   task with screenshot review between tasks
2. **Inline Execution** — design tasks sequentially in this session

Ready to start executing Plan 1?"

---

## Rules

1. **Never generate code in these plans.** Plans produce {{DESIGN_FILE_EXT}} designs only.
   Code generation happens in separate implementation plans.
2. **Maximum 7 tasks per plan document.** If a plan exceeds 7 tasks, split it.
3. **Screenshot after every design task.** Validate visually before moving to the next task.
4. **Trace every surface to spec + Feature ID.** No orphan designs.
5. **Design all states.** Every surface needs: primary, empty, loading, and
   error states at minimum. Add disabled, selected, hover where relevant.
6. **Use the project's component library.** {{COMPONENT_LIBRARY}} patterns,
   {{ICON_SET}}, {{CSS_FRAMEWORK}} spacing. Do not invent custom components
   when the library has one.
7. **Accessibility in design.** Ensure contrast ratios meet {{ACCESSIBILITY_STANDARD}},
   touch targets are adequate, and interactive elements are visually distinct.
8. **{{VIEWPORT_STRATEGY}}.** Design at the primary viewport first. Note
   responsive breakpoint considerations but don't design secondary viewport
   variants for MVP unless requested.
9. **Approval gates.** Wait for user approval after: surface inventory (Step 1),
   aesthetic direction (Step 2), plan split (Step 3), and each task's
   screenshot review during execution.
10. **Plan 1 first, always.** No other plan should be executed before the
    design system foundation is complete.
````

## Example — filled variables for Nexus-CRM

```
{{PROJECT_NAME}}           = Nexus-CRM
{{SPEC_LOCATION}}          = docs/rfcs/
{{SPEC_FORMAT}}            = RFCs
{{FEATURE_ID_SCHEME}}      = F01–F44
{{DESIGN_TOOL}}            = Pencil.dev (.pen files)
{{DESIGN_TOOL_MCP}}        = mcp_pencil_*
{{DESIGN_FILE_EXT}}        = .pen
{{DESIGN_DOCS_SOURCE}}     = context7 query-docs with library /websites/pencil_dev
{{COMPONENT_LIBRARY}}      = shadcn/ui
{{ICON_SET}}               = Lucide icons
{{CSS_FRAMEWORK}}          = Tailwind CSS
{{CODE_FRAMEWORK}}         = Next.js, React, TypeScript
{{CODE_STRUCTURE_HINT}}    = src/app/(app)/
{{PROJECT_RULES_FILE}}     = copilot-instructions.md
{{VIEWPORT_STRATEGY}}      = Desktop-first at 1280px+
{{ACCESSIBILITY_STANDARD}} = WCAG 2.1 AA
```

## Steps

1. Open a **new** chat with your design tool's MCP connected.
2. Paste the prompt with variables filled.
3. **Gates:** approve the surface inventory, then the aesthetic direction, then
   the plan split — in that order.
4. Execute each plan (Plan 1 first) to create the `.pen` files, reviewing
   screenshots between tasks.

> **If you're using Pencil and hit issues during execution** (file-creation
> timeouts, black `#000000` fills, question-mark icons, text overflow, files
> staying 0 bytes on disk), see [pencil-execution-notes.md](pencil-execution-notes.md)
> — workarounds discovered executing these plans on a real project. Pencil updates
> frequently, so some issues may already be fixed in newer versions — treat the
> notes as a troubleshooting aid, not as the source of truth for Pencil.

## Done when

- [ ] Every surface from the inventory exists in exactly one plan
- [ ] `designs/_tokens` and `designs/_components` exist before any page design
- [ ] All surfaces designed with primary/empty/loading/error states
