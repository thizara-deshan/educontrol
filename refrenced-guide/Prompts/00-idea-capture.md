# Prompt 00 — Idea Capture

> **Phase 1 — Discover** · Step 1 of 2
> **Run in:** Any chat AI (ChatGPT, Gemini, Claude)
> **Inputs:** Your rough product idea (in your head)
> **Output:** `docs/basic-idea.txt` — a structured idea capture

## When to use

At the very start, before any research. The goal is to force a fuzzy idea into six
sharp fields. Everything downstream (research, PRD, features) is built on this.

## The template

Fill these six fields. Keep the Problem free of solution wording.

```text
Working Name:           (a name you can say out loud)
Target User:            (as specific as possible — a person, not a market)
Problem:                (1–3 sentences, no solution wording)
Hypothesized Solution:  (your rough product idea)
Why Now:                (market/tech trigger that makes this possible today)
Unfair Advantage:       (domain, data, distribution, or approach others lack)
Primary Tech Stack:     (your initial stack guess — it can change later)
```

## The prompt

If you can't fill the template directly, explain your idea to an AI and let it
structure it for you:

```text
I have a rough product idea. Help me capture it in this exact format:

Working Name / Target User / Problem / Hypothesized Solution / Why Now /
Unfair Advantage / Primary Tech Stack

Here is my idea, explained informally:
[explain your idea in your own words]

Rules:
- Keep the Problem section free of any solution wording.
- Make the Target User specific — a person I could describe to a friend.
- If any field is missing or vague in my explanation, ask me questions
  before producing the final version.
```

## Worked example — Nexus-CRM

```text
Working Name: Nexus-CRM (The Agentic Sales Hub)

Target User (The "Solo Specialist"):
A Solo Specialist is a freelance consultant, creative, or technical expert who works
for themselves. They usually handle 5–10 clients at once and are constantly looking
for new ones, but they don't have a team to help manage the sales work.

The Problem:
Solo experts spend too much time and energy on writing cold emails and following up
with people. Their notes and plans are scattered across different tools, so they
often forget to follow up and feel stressed about where their next paycheck is
coming from.

Hypothesized Solution:
A simple tool that acts like a virtual teammate. It researches potential clients,
drafts emails, and turns messy meeting notes into a clear to-do list.

Why Now:
Modern AI makes it possible to automate these high-friction tasks in a way that
feels personal and non-robotic.

Unfair Advantage:
Unlike traditional CRMs that are just digital filing cabinets, Nexus-CRM uses
"Agentic Workflows". The system actively suggests the next email and creates the
next task for a solo operator.

Primary Tech Stack:
Next.js, Supabase, Vercel, Vercel AI SDK
```

## Steps

1. Draft the six fields yourself, or use the prompt above to structure them.
2. Save the result as `docs/basic-idea.txt` in your project.
3. Keep this text ready — you'll paste it into the Deep Research prompt next.

## Done when

- [ ] All six fields are filled and specific
- [ ] The Problem contains no solution wording
- [ ] Saved to `docs/basic-idea.txt` and committed
