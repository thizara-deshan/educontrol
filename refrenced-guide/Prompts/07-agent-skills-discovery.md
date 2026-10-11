# Prompt 07 — Agent Skills Discovery & Installation

> **Phase 3 — Architect** · Step 2 of 3
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** All project docs
> **Output:** Installed agent skills matched to your stack

## When to use

Before generating RFCs. Agent skills are expert playbooks (React patterns, Supabase
RLS, TDD discipline…) that raise the quality of everything the agent generates from
here on. Install them once, benefit in every later step.

## Prerequisite — install find-skills

The prompt below relies on the **find-skills** skill, so install it first:

```shell
npx skills add https://github.com/vercel-labs/skills --skill find-skills
```

## The prompt

````text
You are setting up a new project workspace for AI-assisted development. The project
has documentation (PRD, feature inventory, dev rules, etc.) but little or no code yet.

Your task: Read the project docs, identify what domains and workflows the team will
build, then use the **find-skills** skill to discover and install agent skills that
will improve code generation quality across those domains.

### Step 1 — Extract Domains from the Docs

Read every doc in the workspace. For each, extract:
- **Core framework & language** (e.g., Next.js, React, TypeScript, Tailwind CSS)
- **UI patterns** (e.g., forms, tables, dashboards, kanban, accessibility, responsive)
- **Backend concerns** (e.g., auth, database, API design, background jobs, validation)
- **AI/LLM integration** (if the product uses AI generation, summarization, etc.)
- **Infrastructure & DevOps** (e.g., Vercel, Supabase, CI/CD, Docker, env management)
- **Testing strategy** (e.g., unit, integration, e2e, specific frameworks like Vitest/Playwright)
- **Code quality & DX** (e.g., linting, formatting, PR review, git workflow)
- **Specific services or platforms** (e.g., AI providers, Supabase Auth, Stripe, etc.)

Produce a numbered list of **skill search queries** derived from these domains.
Each query should be 1-3 keywords optimized for `npx skills find [query]`.

The example below is purely illustrative (one possible web-app stack). Derive the
domains and queries from THIS project's docs — do not copy this list.

Example output:
```
Domains identified:
1. Next.js + React (framework)
2. TypeScript (language)
3. Tailwind CSS + shadcn (styling/UI components)
4. Supabase + PostgreSQL (auth/database)
5. Vercel AI SDK (AI provider layer)
6. Accessibility / WCAG (UI quality)
7. Vitest (unit testing)
8. Playwright (e2e testing)
9. Vercel (deployment)

Proposed search queries:
1. nextjs react
2. typescript best practices
3. tailwind css
4. shadcn ui
5. supabase postgres
6. ai sdk
7. accessibility wcag
8. vitest testing
9. playwright e2e
10. vercel deployment
```

### Step 2 — Search for Skills

For each query, check the skills.sh leaderboard first (https://skills.sh/),
then run:

```bash
npx skills find [query]
```

Collect all results. Do NOT install anything yet.

### Step 3 — Filter and Rank Results

For every skill found, evaluate:

1. **Relevance** — Does it match a domain the project actually uses? Skip anything
   for out-of-scope tech (e.g., don't install a Docker skill if the project deploys
   to Vercel with no containers).
2. **Install count** — Prefer skills with 1K+ installs. Flag anything under 100 as
   low-confidence.
3. **Source reputation** — Prefer official sources (`vercel-labs`, `anthropics`,
   `microsoft`, `ComposioHQ`) over unknown authors.
4. **Overlap** — If two skills cover the same domain, recommend only the
   higher-quality one unless they're complementary.
5. **Scope match** — A "React best practices" skill is useful; a "React Native"
   skill is not if the project is web-only.

### Step 4 — Present a Recommendation Table

Show a table like this and STOP for my approval:

| # | Skill Name | Source | Installs | Covers Domain | Install Command | Confidence |
|---|------------|--------|----------|---------------|-----------------|------------|
| 1 | react-best-practices | vercel-labs/agent-skills | 185K | Next.js, React | `npx skills add vercel-labs/agent-skills@react-best-practices -g -y` | High |
| 2 | ... | ... | ... | ... | ... | ... |

Confidence levels:
- **High** — 1K+ installs, reputable source, directly relevant
- **Medium** — Relevant domain but lower installs or less-known source
- **Low** — Tangentially relevant or very new; include only if nothing better exists

Also list any domains where **no good skill was found**, so I know the gaps.

### Step 5 — Install Approved Skills

After I approve (I may remove some or ask for alternatives), install each
approved skill by running:

```bash
npx skills add <owner/repo@skill> -y
```

Use `-y` to skip confirmation prompts.

After installation, run `npx skills check` to verify everything installed correctly.

### Rules

- Do NOT install skills without my approval.
- Do NOT install skills for technologies the project doesn't use.
- Do NOT install skills that duplicate capabilities already covered by another
  approved skill.
- If a search returns no results, try one alternative query before giving up
  on that domain.
- Prefer fewer high-quality skills over many marginal ones. Aim for 5-10 total
  unless the project spans many distinct domains.
- If the project docs mention specific versions or constraints (e.g., "React 19",
  "Next.js App Router only"), mention this when evaluating skill compatibility.
````

## Core workflow skills — install these regardless

Beyond technology-specific skills, install these core implementation skills from
the **Superpowers** framework. They power the planning and execution steps later
in the pipeline:

| Skill | What it does | Install |
|-------|--------------|---------|
| brainstorming | Turns ideas into designs/specs through collaborative dialogue | `npx skills add https://github.com/obra/superpowers --skill brainstorming` |
| writing-plans | Structures specs into bite-sized implementation plans | `npx skills add https://github.com/obra/superpowers --skill writing-plans` |
| test-driven-development | Red-Green-Refactor discipline for every feature/bugfix | `npx skills add https://github.com/obra/superpowers --skill test-driven-development` |
| systematic-debugging | Root-cause process for any bug or failing test | `npx skills add https://github.com/obra/superpowers --skill systematic-debugging` |
| executing-plans | Executes written plans with review checkpoints | `npx skills add https://github.com/obra/superpowers --skill executing-plans` |
| subagent-driven-development | Executes plan tasks via independent subagents | `npx skills add https://github.com/obra/superpowers --skill subagent-driven-development` |

## Steps

1. Install **find-skills** (prerequisite above).
2. Open a **new** chat, paste the prompt.
3. **Gate:** review the recommendation table — trim it to what you actually use.
4. Approve installation, then install the six core Superpowers skills.

## Done when

- [ ] `npx skills check` passes
- [ ] 5–10 stack-matched skills + the 6 core workflow skills installed
