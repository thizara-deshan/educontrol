# Prompt 01 — Deep Research

> **Phase 1 — Discover** · Step 2 of 2
> **Run in:** Perplexity (best with Pro), Gemini Deep Research, Claude, or ChatGPT — or a mix
> **Inputs:** Idea capture (`docs/basic-idea.txt`)
> **Output:** `docs/research/<tool>-research.md` (one file per research tool used)

## When to use

Right after capturing the core idea. The goal is to turn the raw idea into a rich
**Research Reference** document that the PRD will be written from.

## Why it matters

You research **once**, here, with tools built for it. From this point on, no other
prompt in the pipeline "goes and searches the web" — they all work from this saved
document. That keeps the PRD grounded and reproducible.

## The prompt

Replace the Core Idea block with your own idea capture.

```text
Role: You are a Senior Product Researcher. Your goal is to take a raw product idea
and turn it into a deep "Research Reference" document that will be used to write a
formal Product Requirements Document (PRD).

The Core Idea:
[paste your idea capture from docs/basic-idea.txt here]

Research Instructions:
Please research and provide a detailed report on the following five areas:

1) User Deep-Dive: Research the "Target User's" current daily habits. What are they
   doing right now to solve this "Problem"? Identify the specific moments where they
   feel the most frustration or waste the most time.

2) Market Gaps: Look at existing tools or "old ways" of doing things that people use
   for this. Why do these solutions fail or feel "too much" for the specific user I
   described? Find the "gap" that my product fills.

3) The "Why Now" Validation: Find evidence of the market or tech shift I mentioned.
   Why was this product impossible or too expensive to build 2 years ago, and why is
   it essential today?

4) Feature Best Practices: Research the "Hypothesized Solution" features. What are
   the modern standards for making these features feel easy and high-quality? (e.g.,
   if it uses AI, how do people prefer to interact with it?).

5) Technical Sounding Board: Based on the "Tech Stack" provided, research potential
   roadblocks or "best-in-class" ways to build the core features. Are there specific
   APIs or libraries that would make this solution faster or more reliable?

Output Format: Provide the results in a clear Markdown document. Use headers like:
User Insights, Competitive Landscape, Market Timing, and Technical Recommendations.
Use simple, direct language that explains the "why" behind every suggestion.
```

## Steps

1. Open a new conversation in your research tool of choice.
2. Paste the prompt with your idea capture filled in.
3. Let it generate the full Markdown report.
4. Save the output into your repo — one file per tool:
   - `docs/research/perplexity-research.md`
   - `docs/research/gemini-research.md`
5. Commit. These files are now your **research source of truth**.

## Tips

- Perplexity with a Pro subscription gives the strongest research output most of
  the time. Running the same prompt in two tools and keeping both reports gives
  the PRD step a wider evidence base.
- Adjust the five research areas to deep-dive into whatever matters most for your
  idea (e.g., add a pricing/competitor-pricing section for a paid product).

## Done when

- [ ] At least one research report saved under `docs/research/`
- [ ] You have *read* it and removed/flagged anything that looks hallucinated
- [ ] Committed to git
