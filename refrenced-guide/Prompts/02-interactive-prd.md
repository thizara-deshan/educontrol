# Prompt 02 — Interactive PRD Creation

> **Phase 2 — Define** · Step 1 of 4
> **Run in:** IDE agent (Copilot / Cursor / Claude Code)
> **Inputs:** `docs/basic-idea.txt`, `docs/research/*.md`
> **Output:** `PRD.md` (project root)

## When to use

Once your research reference is saved. This prompt turns the idea + research into a
complete PRD through an **interview**: the AI acts as a Product Manager and asks you
batched questions before writing anything.

## Why it matters

The PRD is the single source of truth for everything downstream — features, rules,
RFCs, and plans all trace back to it. The interactive Q&A is where *your* product
decisions get captured; don't rush it.

## The prompt

Attach your idea file and research files where indicated (`#file` in Copilot,
`@file` in Cursor, plain paths in Claude Code).

```text
You are an experienced Product Manager with expertise in creating detailed Product
Requirements Documents (PRDs).

I have a very informal or vague product idea.

The idea is in #docs/basic-idea.txt and I did some research on the idea — those
research outputs are in #docs/research/. Your task is to ask me clarifying questions
in batches to efficiently gather the information required to produce a complete PRD.

Once you feel you have gathered sufficient details, create a structured PRD that
includes (but is not limited to):

## PRD Sections to Include

- **Overview** - A concise summary of the product, its purpose, and its value proposition
- **Goals and Objectives** - Clear, measurable goals the product aims to achieve
- **Scope** - What's included and explicitly what's excluded from the initial release
- **User Personas or Target Audience** - Detailed descriptions of the intended users
- **Functional Requirements** - Specific features and capabilities, organized by priority
- **Non-Functional Requirements** - Performance, security, scalability, and other quality attributes
- **User Journeys** - Key workflows and interactions from the user's perspective
- **Success Metrics** - How we'll measure if the product is successful
- **Timeline** - High-level implementation schedule with key milestones
- **Open Questions/Assumptions** - Areas that need further clarification or investigation

## Guidelines for the Questioning Process

- Ask questions in batches of 3-5 related questions at a time
- Start with broad, foundational questions before diving into specifics
- Group related questions together in a logical sequence
- Adapt your questions based on my previous answers
- Only ask follow-up questions if absolutely necessary for critical information
- Prioritize questions about user needs and core functionality early
- Do NOT make assumptions -- always ask for clarification on important details

Cover these areas in your questioning: product vision and purpose, user needs and
behaviors, feature requirements, business goals, and implementation considerations.

## Final PRD Delivery

After gathering sufficient information, you MUST:

1. Create a complete PRD document based on the information provided
2. Save the PRD as a markdown file named "PRD.md" in the project root
3. Ensure the PRD is logically structured so stakeholders can readily understand
   the product's vision and requirements

Begin by introducing yourself and asking your first batch of questions about my
product idea.
```

## Steps

1. Open a **new** chat in your IDE agent.
2. Paste the prompt and attach the idea + research files.
3. Answer the question batches honestly — these answers *are* your product decisions.
4. Review the generated `PRD.md` and approve the edits.

> Sample Q&A from the Nexus-CRM build: [PRD Question & Answers](https://docs.google.com/document/u/0/d/1uBSjTT3LtG-wYLOF772HDePW8ETQJtYQImkgU02LPdg/edit)

## Done when

- [ ] `PRD.md` exists in the project root with all listed sections
- [ ] Scope explicitly says what V1 is **not**
- [ ] Committed to git
