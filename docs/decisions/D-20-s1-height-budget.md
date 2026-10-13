# D-20 — S1 fits 1280×800 by height budget, not by locking the page

Date: 2026-10-13 · Milestone: M04 · Supersedes: ARCHITECTURE §4.1, the sentence "At 1280×800 `lg` must fit
without scrolling: page is `lg:h-dvh lg:overflow-hidden` with flex columns", and the rule "Only `sm:` and `lg:`
are used" for one element.

## Context

SPEC §2.2 requires S1 to fit 1280×800 with no scrolling. Locking the page to the viewport height at `lg` with
`overflow-hidden` also applies to every other `lg` window: a podium-PC browser at 1280×~650 or a 1024×700 laptop
would clip the bottom of the Environment column (Room sensors) with no way to reach it.

The four sensor tiles (S1.E42–E45) fit in one row in a 400px column (1280 wide) but not in a 314px column
(1024 wide). Viewport breakpoints cannot tell these apart because both are `lg`.

## Decision

1. S1 has a natural height. Cards follow a fixed vertical budget (header 64, `main` padding 24 + 24, section
   label 16 + 12, card gaps 12, primary buttons 56, AC −/+ 64, toggle rows 56, card padding 16). Measured at
   1280×800: the tallest column ends at 708px normally and at 768px in the worst state (blaster offline, stale
   captions, no reading), under 800. Shorter windows scroll normally.
2. The Room sensors tiles use a container query: `@container` on the card and
   `grid-cols-2 @min-[22rem]:grid-cols-4` on the tile grid (4 across when the card's inner width is at least
   352px, otherwise 2×2).

## Consequences

- No content is ever clipped. A future S1 element must fit in the budget's spare space (about 30px in the
  worst case) or the budget must be re-measured at 1280×800.
- Acceptance and review check "no scroll at 1280×800" by measurement
  (`document.documentElement.scrollHeight === 800`), not by CSS.
