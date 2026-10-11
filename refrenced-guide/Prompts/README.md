# NextGen AI Bootcamp — Prompt Library

This folder is the complete, ordered prompt toolkit for the AI-Driven Development workflow.
Each prompt is one step in the pipeline. Run them in order; each one consumes the artifacts
produced by the previous one.

> **The mental model:** You = Architect, AI = Lead Developer.
> You give structure and review at the gates; the AI executes between them.

## Pipeline index

| # | Prompt | Phase | Run in | Input artifact(s) | Output artifact(s) |
|---|--------|-------|--------|-------------------|--------------------|
| 00 | [Idea Capture](00-idea-capture.md) | 1 — Discover | Any chat AI | Your rough idea | `docs/basic-idea.txt` |
| 01 | [Deep Research](01-deep-research.md) | 1 — Discover | Perplexity / Gemini | Idea capture | `docs/research/*.md` |
| 02 | [Interactive PRD](02-interactive-prd.md) | 2 — Define | IDE agent | Idea + research | `PRD.md` |
| 03 | [PRD Verification](03-prd-verification.md) | 2 — Define | IDE agent | `PRD.md` | Improved `PRD.md` |
| 04 | [PRD to Features](04-prd-to-features.md) | 2 — Define | IDE agent | `PRD.md` | `FEATURES.md` |
| 05 | [Features to Rules](05-features-to-rules.md) | 2 — Define | IDE agent | `PRD.md`, `FEATURES.md` | Rules file (agent instructions) |
| 06 | [Tooling Gap Analysis](06-tooling-gap-analysis.md) | 3 — Architect | IDE agent | PRD, features, rules | Updated rules + PRD |
| 07 | [Agent Skills Discovery](07-agent-skills-discovery.md) | 3 — Architect | IDE agent | All docs | Installed agent skills |
| 08 | [Generate RFCs](08-generate-rfcs.md) | 3 — Architect | IDE agent | PRD, features, rules | `docs/rfcs/RFC-*.md` |
| 09 | [UI Design Plan](09-ui-design-plan.md) *(optional)* | 4 — Design | IDE agent + Pencil | RFCs | `docs/plans/ui/*.md`, `designs/*.pen` |
| 10 | [Implementation Plan](10-implementation-plan.md) | 5 — Plan & Build | IDE agent | One RFC (+ designs if any) | `docs/plans/PLAN-RFC-*.md` |
| 11 | [External Dependencies](11-external-dependencies.md) | 5 — Plan & Build | IDE agent | Implementation plan | `*-external-setup.md` |
| 12 | [Architectural Change (ADR)](12-architectural-change-adr.md) | 6 — Evolve | IDE agent | Changed decision | `docs/rfcs/ADR-*.md` + updates |

**Helper docs** (not prompts — reference material):

- [pencil-execution-notes.md](pencil-execution-notes.md) — troubleshooting aid for
  executing UI design plans with Pencil (Prompt 09). Consult it when Pencil
  misbehaves; note that newer Pencil versions may have fixed some of the issues.

## How every prompt works

All prompts in this library share the same anatomy:

1. **Role** — who the AI should act as (researcher, PM, architect…)
2. **Inputs** — which existing artifacts to read
3. **Process** — numbered analysis/generation steps
4. **Output format** — the exact structure of the artifact to produce
5. **Rules** — guardrails (no placeholders, don't invent features, cite don't copy…)
6. **Approval gate** — where the AI must STOP and wait for your review

The approval gates are not optional. They are where *you* do the architect's job.

## Conventions

- `{{VARIABLES}}` — fill these in before pasting the prompt.
- **Run in: IDE agent** means VS Code Copilot, Cursor, or Claude Code — any agent
  that can read and write files in your repo. Attach-file syntax differs per tool:
  `#file` (Copilot), `@file` (Cursor), or just the path (Claude Code).
- **One step = one fresh chat.** Start a new conversation for each prompt so the
  agent works from the artifacts on disk, not from stale conversation memory.
