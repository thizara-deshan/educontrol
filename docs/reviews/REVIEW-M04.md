# REVIEW-M04 — Control page (S1)

Reviewed: 2026-10-13 · Range: `git diff m04-start..HEAD` (51 files, +2097/−120) ·
Inputs: `docs/milestones/M04-control-page.md`, `docs/plans/PLAN-M04-control-page.md`, `CLAUDE.md`,
`docs/SPEC.md` (S1, §2.2, H7–H25 as listed in M04), `reference/screens/01-control-page.png`.
Method: Verify-all; the existing dev server (`VITE_API_MODE=mock`, `?mock-panel&time-scale=0.1`) driven by
Playwright (`playwright-core` + system Chromium), one fresh browser context per scenario, at 1280×800 (mouse),
800×1000 (mouse) and 390×844 (touch); greps over the diff; reading the card and selector code.

**Verdict: PASS.** 11/12 acceptance criteria pass and one is partly CAN'T VERIFY (the two-browser check,
M02-L3). There are **0 MUST-FIX** items and 3 LATER items.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | ✅ contracts, kiosk (core-api not in scope yet) |
| Lint | `pnpm lint` | ✅ 0 problems |
| Tests | `pnpm -r test` | ✅ contracts 15 files / 134 tests · kiosk 41 files / 327 tests |
| hw | `pnpm hw:lint`, `pnpm hw:test` | ⚪ no-op until M07 (as planned) |
| `pnpm verify` | all of the above | ✅ exit 0 |
| Build | `pnpm build` | ✅ (warning: `index-*.js` 629 kB > 500 kB, already M02-L1) |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | 1280×800: three columns, no page scroll, matches screenshot 01 | **PASS** | `scrollHeight 800 = innerHeight 800`, no horizontal scroll. Columns at x=24/440/856, tallest ends at y=708 (worst case with blaster offline + stale + door open: 736). Order, labels and values as in the reference (see §3). |
| 2 | 800: Display + Audio left, Environment right. 390: one column Display → Audio → Environment, 3×48px bottom bar, pairs side by side, full-width sliders, AC row on one line, sensors 2×2, no h-scroll | **PASS** | 800: `display` left 16, `audio` left 16 below it (top 494), `environment` left 408. 390: sections at y 72 / 486 / 846, `scrollWidth = 390`, bar top 795, segments 130×48 each. Tiles, both power pairs, setpoint row on one line, sensors 2×2: seen in screenshot. Jumps land at `top = 72` below the 56px header (scroll-margin works). Last card ends at 772, above the bar (795). **0** targets under 48px in `main`, `header`, `nav` at all three sizes. |
| 3 | Source tiles: Switching… → Selected, confirmed; other "Tap to select"; assumed = amber | **PASS** | Tap Smart board: `Switching…`, then `Selected, confirmed`, Podium PC `Tap to select`. Panel "Source assumed": `Selected, assumed`, border `rgb(242,169,59)` (the warn token). |
| 4 | Projector ramp; H7b; meter offline | **PASS** | Power off: `Power off sent · waiting for draw` → `Cooling down` → `Standby · confirmed by draw`. Power on: `Power on sent · waiting for draw` → `Warming up` → `On · confirmed by draw`. With "No draw change": `waiting for draw` at 1 s, `no change in draw` at 10 s (9 s scaled, amber). Meter offline: `Power meter offline · state unknown`, `— W`. |
| 5 | Screen: Raise/Lower, Moving…, Unknown | **PASS** | Sequence `Lowered` → `Moving…` → `Raised`; button `Raise` → `Lower`. Panel "Screen position unknown" → `Unknown` (button `Lower`). |
| 6 | Sliders and Mute all (R9) | **PASS** | Drag from 62: thumb moved 20/40/59/79/99px with the pointer; number settled to 92 after release (last sent value). Mute all: `Muted` / `Muted`, button `Unmute all audio`; unmute: `62` / `38`. The "phone changes PC audio during drag" case is covered by `fake-room-order.test.ts` + `slider` reducer tests (not driven by eye). |
| 7 | Lights rows, by hand, offline | **PASS** | Click at the far-left corner of the "Rear of room" row toggled it Off → On. Panel "Change by hand": toast `Front of room turned off · by hand`. Panel "Toggle lights offline": `Switch offline · last known state`, red dot (screenshot), both switches `disabled`. |
| 8 | AC: Unknown, assumed, −/+ limits, disabled while off | **PASS** | After "Restart controller": `Unknown`. Power on: `On · assumed`. Stepping down reached `18°` with − disabled and + enabled; up reached `30°` with + disabled. Power off: both disabled. Dashed card border at every state (screenshots). |
| 9 | Sensors: fresh, stale, no reading, Door Open | **PASS** | Stale: `2 of 3 reporting`, `SNZB-02P · 14 min ago` on temperature and humidity (dimmed). Door no reading: `—` + `No reading yet`, `1 of 3 reporting`. Door open: `Open` in amber. |
| 10 | Coordinator offline (H9); blaster offline (H25) | **PASS** | Coordinator: header `Coordinator offline`, Lights `Switch offline · last known state`, sensors `No sensors reporting` / `· offline`, IR cards `IR blaster offline`. Blaster: header `ZS06 offline`, projector and AC Power buttons `disabled`, both cards show `IR blaster offline`. |
| 11 | Remote `view`: padlock on every card, controls open the PIN | **PASS** | `[aria-label=Locked]` = **9** at 1280, 800 and 390. Power off → "Enter room PIN"; `1234` → projector unchanged (`On · confirmed by draw`). A press on the locked mic slider also opened the PIN. |
| 12 | `pnpm verify` green, selector tests | **PASS** | §1. `projector.view.test.ts`, `ac.view.test.ts`, `sensors.view.test.ts`, `source-tiles.view.test.ts`, `screen.view.test.ts` exist, plus `audio.view`, `lights.view`, the mock rules/ramp/derived/time-scale/FakeRoom tests and the `supersede` sender test. |

**Two browser contexts: CAN'T VERIFY.** Each context has its own in-memory `FakeRoom` (M02-L3): Smart board
selected in context 1 stays `Tap to select` in context 2 until M08. This is not new in M04.

Pending / assumed / failed / offline: pending (`Switching…`, pulsing border), assumed (source, AC, `Power … sent`),
warning (warming up, H7b, muted, `2 of 3 reporting`), offline (H8 per card, H9, H25), stale (H10), unknown
(screen, AC, meter) and locked all render. Failed/timed-out command handling is the M03 flow and was not
re-driven (the S1 cards use the same `useCommand` + `InlineError`).

## 3 Visual diff (vs `reference/screens/01-control-page.png`)

1280×800:
- Same three columns, same order and copy: Podium PC / Smart board; Projector `287 W`, Power on (green) / Power off,
  "Commanded over IR · state read back from the S60 power meter"; Projection screen / `Raise`; Lecturer microphone
  `62`, PC audio `38`, Mute all audio; Lights `ZBM5`, Front of room On, Rear of room Off; Air conditioning
  `IR REMOTE` (dashed, amber ring, Power on amber), Setpoint − `24°` +; Room sensors `3 reporting`, `26.4°`, `61%`,
  Detected, Closed with model captions.
- Expected differences: primary buttons 56px (SPEC §3.3; reference ~64px); sliders have an 8px track (SPEC §3.3);
  padlock icons on every card (`view` access, AC11); the reference header is taller with a bigger clock.
- Column bottoms: Display ends at ~470, Audio at ~432, Environment at 708 (the reference has the same ragged bottoms).
- The floating mock panel (dev only) covers the lower-right corner of Room sensors at 1280×800 when collapsed
  (M02-L4, M03-L1).

800×1000: Display and Audio stacked left, Environment right; nothing clipped; sensors 2×2.

390×844: header 56px (wordmark, dot, R-101, two icon buttons; the clock is hidden on phone as in M03); one column;
bottom bar with `Display · Audio · Environment`; AC row `Setpoint − 24° +` on one line; sensors 2×2; offline
states (red Lights card, "IR blaster offline" in red under AC, amber header dot, dimmed stale readings) fit without
horizontal scroll. **The mock panel covers the Audio and Environment segments of the bottom bar even when
collapsed** (dev only, see L1).

## 4 Code review findings

| ID | Severity | Finding | Where |
|---|---|---|---|
| L1 | LATER | At 390 the (collapsed) mock panel sits over the bottom bar's Audio/Environment segments, so by hand the bar can't be tapped without hiding the panel. Extends M02-L4 / M03-L1; dock the panel above the bar (`bottom-16` below `sm`) or start it hidden. | `apps/kiosk/src/app/dev/MockPanel.tsx` |
| L2 | LATER | While dragging, the big number shows the **server** value and only the thumb follows the finger (62, 62, 62, 80, 86 while the thumb is at +20…+99px). SPEC §2.4 only requires the thumb to follow; showing the dragged level in the number is the plan's nice-to-have. | `features/control/audio/LevelCard.tsx`, `components/LevelSlider.tsx` |
| L3 | LATER | The mock's AC − / + taps are dropped while one is pending (H5), so 8 quick taps (700 ms apart) moved the setpoint 6 steps. Correct per H5, but a step-by-step test needs ≥1.5 s between taps; consider showing the pending overlay long enough, or document it in the panel. | `data/commands/command-sender.ts` (behaviour) |

Checked with nothing found:
- No hex/rgb/hsl/oklch literals or `[#…]` classes in the diff; the one new token is `--text-value-word` (18px),
  registered in `token-names.ts`. No `as` casts other than `as const`, no `any`, `@ts-ignore`, `eslint-disable`.
- Contracts: no contract change was needed (checked: every S1 field and `CommandBody` kind already existed);
  every `useCommand().send` body is a `CommandBody`; the mock still parses `CommandRequest`. No new hand-defined
  contract types.
- Reuse: all cards use `Card`, `CommandButton`, `ObservedLine`, `LevelSlider`, `SensorTile`, `LockBadge`,
  `InlineError`; the new `CardHeader` is used by 7 cards; no duplicate of an existing component.
- Tests: each `*.view.ts` selector has a test; mock rules, ramp, derived fields, time-scale, arrival order, timed
  effects, panel methods and the `supersede` sender path are all tested. `useViewOnly` is a one-line hook over the
  session query (no logic).
- Boundaries: no `fetch`, sockets or storage in components; `import.meta.env.DEV` is only used to gate
  `?time-scale=` (production → 1). Query keys unchanged. No feature imports another feature.
- No hover-only affordances (`hover:` absent from the diff). No hardware code, core-api routes or Pi-specific
  paths in this range, so no mutating route lacks `config.access` and nothing new listens on 0.0.0.0.
- No secrets or PINs in the diff (mock PINs are M03's L2).
- D8/D-20 deviates from ARCHITECTURE §4.1 (no `lg:h-dvh`) with a decision record, as CLAUDE.md requires.
- Plan housekeeping: all 37 task boxes ticked, `## Blockers` empty, one commit per task.

## 5 Gate

AC1–AC12: **PASS** (AC6 partly verified by unit tests rather than by hand; the two-context check is CAN'T VERIFY,
M02-L3). **0 fix tasks** (the plan's `## Fix tasks (review 1)` section says so). 3 LATER items added to
`docs/milestones/M00-index.md` → Backlog (M04-L1…L3).
