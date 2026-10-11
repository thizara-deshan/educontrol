# Prompt 08 — Change record

> **Any time** · **Model:** Opus 5.5 · new session
> **Output:** `docs/decisions/NNN-<slug>.md` + updates to affected docs

## When to use
When reality overrides an earlier decision. For example, the hardware isn't
zigbee2mqtt, the display is portrait, the AC has feedback after all, or a library
fails on the Pi. Don't silently edit ARCHITECTURE or a plan. Write it down, then
update the docs.

Not for small fixes inside a milestone. Those go in the plan.

## The prompt
````text
A decision needs to change.

**Change:** {{WHAT_CHANGED}}
**Why:** {{EVIDENCE}}   (e.g. "INTAKE-02 shows the blaster is driven over
                          serial, not Zigbee — see zs06_test.py:14")

1. Read SPEC, ARCHITECTURE, CLAUDE.md, M00-index, open plans, and code
   affected by this decision.
2. Impact analysis: every doc section, contract, module, plan task, and
   finished milestone affected. Table: | Item | Impact | Action |
3. STOP and show me the table.
4. After approval:
   - Write `docs/decisions/NNN-<slug>.md`: Context · Decision · Alternatives
     · Consequences · Affected items.
   - Update ARCHITECTURE/SPEC/CLAUDE.md in place, adding
     "(changed by decision NNN)" next to each edited section.
   - If finished code must change, create a milestone `Cxx-<slug>.md` with
     acceptance criteria and add it to M00-index. It then goes through 04/05/06.
````

## Done when
- [ ] Decision file committed, docs updated, and follow-up milestone (if any) indexed
