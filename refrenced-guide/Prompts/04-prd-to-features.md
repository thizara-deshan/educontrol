# Prompt 04 — PRD to Features

> **Phase 2 — Define** · Step 3 of 4
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** Verified `PRD.md`
> **Output:** `FEATURES.md` (project root)

## When to use

After the PRD passes verification. This converts prose requirements into a
structured, prioritized feature inventory with stable IDs (F1, F2, …) that every
later artifact — RFCs, plans, designs — will reference.

## The prompt

```text
You are an expert product manager and technical lead tasked with extracting and
organizing features from the attached Product Requirements Document (PRD) #PRD.md .

Create a comprehensive FEATURES.md file that clearly outlines all features,
organized by priority and category. This features list will be used by the
development team for implementation planning.

If any critical information is missing or unclear, ask specific questions before
proceeding.

Extract and organize the features by:

1. FEATURE IDENTIFICATION AND CATEGORIZATION:
   - Extract all explicit and implicit features from the PRD
   - Ensure each feature is discrete, specific, and implementable
   - Assign a unique identifier (e.g., F1, F2, F3)
   - Group by logical category (e.g., User Authentication, Dashboard, Reporting)
   - Distinguish core features from enhancements
   - Tag by user persona where applicable

2. PRIORITIZATION:
   - Apply MoSCoW prioritization to each feature:
     * Must have: Critical for the minimum viable product
     * Should have: Important but not critical for initial release
     * Could have: Desirable but can be deferred
     * Won't have: Out of scope for current release but noted for future
   - Consider dependencies between features when prioritizing

3. FEATURE DETAILING:
   - Clear, concise description for each feature
   - Acceptance criteria
   - Technical considerations or constraints
   - Potential edge cases or special handling requirements

4. IMPLEMENTATION COMPLEXITY:
   - Relative complexity for each feature (Low, Medium, High)
   - Features requiring third-party integrations or special expertise
   - Features that may present significant technical challenges

First, provide a brief overview of the product based on the PRD. Then create the
FEATURES.md content with a summary section showing feature counts by priority and
category. Save it as "FEATURES.md" in the project root.
```

## Steps

1. Open a **new** chat.
2. Paste the prompt and attach the verified `PRD.md`.
3. Answer any clarifying questions it raises.
4. Review the generated feature list — especially the **Won't have** section, which
   is your scope-creep firewall.

## Done when

- [ ] `FEATURES.md` exists with unique IDs, MoSCoW priorities, acceptance criteria,
      and dependencies per feature
- [ ] Every Must-have is something V1 genuinely cannot ship without
- [ ] Committed to git
