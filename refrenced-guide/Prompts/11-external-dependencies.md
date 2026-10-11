# Prompt 11 — Extract External Dependencies

> **Phase 5 — Plan & Build** · Step 2 of 3 — run once **per implementation plan**
> **Run in:** IDE agent (Copilot / Cursor / Claude Code) — **new chat**
> **Inputs:** Implementation plan (+ its RFC for context)
> **Output:** `docs/plans/PLAN-RFC-{NNN}-{title}-external-setup.md`

## When to use

After an implementation plan has been written but BEFORE executing it. This prompt
identifies and sequences all work that happens OUTSIDE the codebase — account
creation, environment configuration, secret management, third-party service setup,
DNS, etc.

## Why it matters

Implementation plans are designed for AI agent execution — they create files, write
code, and run tests. But many plans silently depend on external services being
configured (database accounts, API keys, CI/CD environments, deployment platforms).
If these aren't identified upfront, plan execution will partially fail and leave the
project in an incomplete state that's confusing to debug. The output tells you what
to do manually **before** execution, and what to wire up **after**.

## Variables

Fill these in before use:

```
{{PLAN_FILE}}          — e.g. "docs/plans/PLAN-RFC-001-project-foundation-and-cicd.md"
{{RFC_FILE}}           — e.g. "docs/rfcs/RFC-001-project-foundation-and-cicd.md" (optional, for additional context)
{{PROJECT_NAME}}       — e.g. "Nexus-CRM"
{{HOSTING_PLATFORM}}   — e.g. "Vercel", "Netlify", "AWS Amplify", "Railway", "Fly.io"
{{DATABASE_PROVIDER}}  — e.g. "Supabase", "PlanetScale", "Neon", "Railway Postgres"
{{CI_CD_PLATFORM}}     — e.g. "GitHub Actions", "GitLab CI", "CircleCI"
{{REPO_PLATFORM}}      — e.g. "GitHub", "GitLab", "Bitbucket"
```

## The prompt

````text
You are a DevOps-aware software architect reviewing an implementation plan to extract
all work that must happen OUTSIDE the codebase. The plan was written for AI agent
execution (file creation, code, tests), but many tasks implicitly depend on external
services, accounts, secrets, or manual configuration that an agent cannot perform.

### Input

- **Implementation plan:** `{{PLAN_FILE}}`
- **RFC (optional):** `{{RFC_FILE}}`
- **Project:** {{PROJECT_NAME}}
- **Hosting:** {{HOSTING_PLATFORM}}
- **Database:** {{DATABASE_PROVIDER}}
- **CI/CD:** {{CI_CD_PLATFORM}}
- **Repository:** {{REPO_PLATFORM}}

### Step 1 — Read and Analyze the Plan

Read the implementation plan completely. For every task and step, identify:

1. **Environment variables** — any `.env` file, env schema, or `process.env`
   reference implies that real values must come from somewhere. Where?
2. **CLI tools** — any `npx supabase`, `vercel`, `gh`, `stripe` command implies
   a CLI tool must be installed and authenticated.
3. **Account references** — any mention of "project ref", "API key", "access token",
   "org ID", "webhook URL" implies an account exists on an external platform.
4. **CI/CD secrets** — any `${{ secrets.X }}` or `${{ vars.X }}` in workflow files
   implies GitHub/GitLab environment configuration.
5. **DNS/domain** — any custom domain, SSL, or production URL reference.
6. **Third-party integrations** — OAuth apps, webhook endpoints, API credentials
   for services like Stripe, Resend, OpenAI, etc.

### Step 2 — Classify Into Three Phases

Sort every external dependency into one of three phases:

**Phase A: Pre-Execution Setup (do BEFORE running the plan)**
Items where the plan's code literally cannot compile, test, or run without
this being done first. Examples:
- Create a database project (need API keys for `.env.local`)
- Install a CLI tool (plan steps run CLI commands)
- Create a `.env.local` file with real credentials

**Phase B: Parallel / Deferrable (can do DURING or AFTER plan execution)**
Items that the core codebase doesn't need at development time but are needed
for the full system to work. Examples:
- Docker setup (only if using local Supabase via Docker)
- Domain registration (production only)
- Third-party OAuth app creation (only needed when auth features are built)

**Phase C: Post-Execution Wiring (do AFTER the plan creates the code)**
Items that require the codebase to exist first. Examples:
- Configure CI/CD environments and secrets (needs workflow files to exist)
- Run `vercel link` (needs package.json to exist)
- Run `supabase link` (needs supabase/config.toml to exist)
- Set up deployment environment variables in hosting platform
- Configure webhook URLs (needs API routes to exist)

### Step 3 — Produce the External Setup Guide

Generate a structured document with this format:

```markdown
# External Dependencies — {{PROJECT_NAME}} / {RFC or Plan title}

> **Generated from:** `{{PLAN_FILE}}`
> **Date:** {today}
>
> Complete Phase A before executing the implementation plan.
> Phase B items can be done in parallel or deferred.
> Complete Phase C after the plan has been executed.

---

## Phase A: Pre-Execution Setup

Complete these steps BEFORE running the implementation plan.

### A1: {Service/Tool Name}
**Why needed:** {which plan task depends on this and why}
**Steps:**
1. {Concrete step with URLs where to go}
2. {What to click/configure}
3. {What value to copy and where to put it}

**Values to collect:**
| Value | Where to Find It | Where to Put It |
|-------|------------------|-----------------|
| API URL | Service dashboard > Settings > API | `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` |
| ... | ... | ... |

### A2: {Next service/tool}
...

---

## Phase B: Parallel / Deferrable

These can be done anytime. Not blocking plan execution.

### B1: {Item}
**Why needed:** {what feature/phase needs this}
**When to do it:** {e.g., "Before RFC-003 which adds auth"}
**Steps:**
1. ...

---

## Phase C: Post-Execution Wiring

Complete these AFTER the implementation plan has been executed.

### C1: {Configuration}
**Why after:** {which files need to exist first}
**Steps:**
1. ...

**Verification:** {how to confirm this is working}

---

## Verification Checklist

After all three phases are complete, verify the full integration:

- [ ] `npm run dev` starts without env validation errors
- [ ] `npm run build` completes successfully
- [ ] `npm run test` all tests pass
- [ ] {Service-specific check, e.g., "supabase migration list shows migrations"}
- [ ] {CI/CD check, e.g., "Push to a branch triggers the CI workflow"}
- [ ] {Deployment check, e.g., "Preview deployment accessible at staging URL"}
```

### Step 4 — Annotate the Plan

After generating the external setup guide, suggest a concrete addition to the
implementation plan's header section:

```markdown
**External Dependencies:** See `docs/plans/{plan-name}-external-setup.md`

- Phase A (pre-execution): {count} items — estimated {X} minutes manual setup
- Phase C (post-execution): {count} items — estimated {X} minutes manual wiring
```

### Step 5 — Cross-Reference with Future RFCs

If the RFC or plan references future work (e.g., "auth is in RFC-002",
"AI features in RFC-003"), note which external dependencies will likely
surface in those future plans:

```markdown
## Heads Up: External Dependencies in Future RFCs

| Future RFC/Feature | Likely External Dependency | Action                              |
| ------------------ | -------------------------- | ----------------------------------- |
| Auth (RFC-002)     | OAuth app on Google/GitHub | Create when RFC-002 plan is written |
| AI features        | AI provider API key        | Create when AI RFC plan is written  |
| Payments           | Stripe account + webhook   | Create when payment RFC is written  |
```

This helps anticipate manual work ahead without over-provisioning accounts
you might not need.

---

### Rules

- **Be platform-specific.** Don't say "configure your hosting platform."
  Say "Go to vercel.com > Project > Settings > Environment Variables."
  Use {{HOSTING_PLATFORM}} and {{DATABASE_PROVIDER}} to give concrete instructions.
- **Include actual URLs** for dashboards, documentation, and setup pages.
- **Distinguish free tier vs paid.** If a step requires a paid plan, flag it
  explicitly. If it works on free tier, say so and note any limitations.
- **One-time vs per-environment.** Mark whether a step is done once globally
  (e.g., install CLI) or once per environment (e.g., create staging DB,
  create production DB).
- **Don't duplicate plan content.** This document covers what happens OUTSIDE
  the codebase. Don't repeat the codebase tasks.
- **Estimate time.** Each phase should have a rough time estimate so students
  can plan their session.
- **Verification is mandatory.** Every item in Phase A and C must have a
  concrete way to verify it's working.
````

## Example — filled variables for Nexus-CRM RFC-001

```
{{PLAN_FILE}}         = docs/plans/PLAN-RFC-001-project-foundation-and-cicd.md
{{RFC_FILE}}          = docs/rfcs/RFC-001-project-foundation-and-cicd.md
{{PROJECT_NAME}}      = Nexus-CRM
{{HOSTING_PLATFORM}}  = Vercel
{{DATABASE_PROVIDER}} = Supabase
{{CI_CD_PLATFORM}}    = GitHub Actions
{{REPO_PLATFORM}}     = GitHub
```

The real output for this example lives at
`docs/plans/PLAN-RFC-001-project-foundation-and-cicd-external-setup.md`.

## Steps

1. Open a **new** chat.
2. Paste the prompt with variables filled for the plan you're about to execute.
3. **Do Phase A manually** before executing the implementation plan.
4. Execute the plan, then complete Phase C wiring and the verification checklist.

## Done when

- [ ] External setup guide saved next to its plan
- [ ] Phase A complete (verified) before plan execution starts
- [ ] Phase C + verification checklist complete after execution
