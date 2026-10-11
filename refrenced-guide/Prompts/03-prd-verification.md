# Prompt 03 — PRD Comprehensive Verification

> **Phase 2 — Define** · Step 2 of 4
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** `PRD.md`
> **Output:** Improved `PRD.md` + a quality assessment

## When to use

Immediately after the PRD is created, before deriving features and RFCs. A second,
fresh AI session reviews the PRD with no memory of how it was written — exactly like
a second pair of eyes.

## The prompt

```text
You are an expert product manager tasked with reviewing this Product Requirements
Document (PRD) #PRD.md . Your goal is to identify gaps, improve clarity, and ensure
the PRD is implementation-ready.

Review the PRD.md file created in the previous step and provide actionable feedback.

## STEP 1: GAP ANALYSIS

Identify critical missing elements in these areas:

1. PRODUCT FUNDAMENTALS
   - Product vision and problem statement
   - Target users and their needs
   - Success metrics and scope boundaries

2. TECHNICAL REQUIREMENTS
   - Technology constraints and integrations
   - Security, performance, and scalability needs
   - Infrastructure requirements

3. BUSINESS CONSIDERATIONS
   - Timeline and budget constraints
   - Regulatory requirements
   - Market factors and business model

4. IMPLEMENTATION FACTORS
   - Dependencies and third-party requirements
   - Team resources and skills needed
   - Testing and deployment needs

## STEP 2: IMPROVEMENT RECOMMENDATIONS

Provide specific recommendations in these areas:

1. STRUCTURE & CLARITY
   - Ensure all essential sections are included
   - Clarify ambiguous requirements
   - Format user stories properly

2. COMPLETENESS & FEASIBILITY
   - Fill gaps in user journeys
   - Identify technical challenges
   - Suggest alternatives for problematic requirements

3. PRIORITIZATION & IMPLEMENTATION
   - Apply MoSCoW prioritization
   - Identify critical path requirements
   - Suggest logical implementation sequence

## DELIVERABLES

1. SUMMARY OF FINDINGS
   - List of critical gaps (High/Medium/Low impact)
   - 2-3 sentence overall assessment

2. SPECIFIC RECOMMENDATIONS
   - Concrete suggestions for improvement
   - Examples of how to clarify ambiguous requirements

3. IMPROVED PRD
   - Create an enhanced version addressing the issues found
   - Save as "PRD.md" in the project root (overwrite the original)

4. QUALITY ASSESSMENT
   - Score the PRD (1-10) on: Completeness, Clarity, Feasibility, and User-Focus
```

## Steps

1. Open a **new** chat (fresh session — that's the point of verification).
2. Paste the prompt and attach `PRD.md`.
3. Read the findings summary *before* accepting the rewritten PRD.
4. Approve the edits.

## Done when

- [ ] You read the gap analysis and agree (or pushed back) on each High-impact gap
- [ ] Improved `PRD.md` saved and committed
- [ ] Quality scores are 7+ across the board — if not, iterate once more
