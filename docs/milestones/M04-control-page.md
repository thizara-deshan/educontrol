# M04 — Control page (S1)
Depends on: M03            Machine: Arch        Est: 1 day

## Goal
Build S1 Control so it matches screenshot 01 at 1280×800 with no scrolling, reflows to two
columns at 600–1023 and to the phone layout at 390px, and shows every S1 hidden state when driven
from the mock panel. All interactions go through the M02 command flow and M03 access gate.

## Scope
- `features/control/`: `ControlPage`, `display/` (SourceTiles, ProjectorCard, ScreenCard),
  `audio/` (LevelCard ×2, MuteAllBar), `environment/` (LightsCard, AcCard, SensorsCard),
  `BottomNav` (phone, `sm:hidden`).
- SPEC S1.E10–E18, S1.E20–E23, S1.E30–E45, S1 view-only presentation, S1.E4 tap → `/devices`
  (and S1.E41 tap → `/devices`), phone layout §2.2.
- Hidden states: H7, H7b, H8, H9, H10, H11, H12 (per card), H14, H15 (S1 line), H18, H19, H25.
- Rules as presented: R1, R2, R3, R4, R6, R9, R10, R13 (the mock produces the states; the page
  renders them).
- Mock: extend `FakeRoom` so every command kind in `CommandBody` behaves plausibly (R1 draw ramp
  with `FAKE_TIME_SCALE`, AC assumed with captured setpoints 18–30, mute-all save/restore,
  exclusive source), plus panel buttons for each S1 hidden state.

## Out of scope
S2/S3 content. Real server behaviour (M08). Projector mains control UI (no SPEC element; R11 is
server-side).

## Acceptance criteria
1. At 1280×800 (Chromium `--window-size=1280,800 --kiosk` or DevTools device) S1 shows all three
   columns with no page scroll, matching screenshot 01 in order, labels and values.
2. At 800px wide: Display + Audio stacked left, Environment right. At 390px: one column in the
   order Display → Audio → Environment, a sticky bottom bar with three 48px segments that jump to
   each section, source tiles and power pairs side by side, sliders full width, AC row on one
   line, sensor tiles 2×2, no horizontal scroll.
3. Tap "Smart board": tile shows "Switching…" (pending), then becomes "Selected, confirmed" when
   the mock pushes; "Podium PC" becomes "Tap to select". Tapping the selected tile does nothing.
   Mock panel "source assumed" shows "Selected, assumed" with amber border.
4. Projector Power on (mock, fast time scale): "Power on sent · waiting for draw" → "Warming up"
   (amber dot, live W) → "On · confirmed by draw" with green `287 W`. Panel "no draw change" →
   after 90 s scaled: "Power on sent · no change in draw" in amber (H7b). Panel "power meter
   offline" → hollow ring, "— W", "Power meter offline · state unknown".
5. Screen button reads "Raise" when Lowered and "Lower" when Raised; Moving… and Unknown render.
6. Drag the mic slider: the thumb follows the finger; the value settles to the pushed value on
   release. Panel "phone changes PC audio" during a drag of the PC slider does not move it until
   release. Mute all → "Unmute all audio", sliders dimmed, values "Muted"; unmute restores the
   previous levels (R9).
7. Lights rows toggle on a tap anywhere in the ≥56px row; panel "by hand" → toast "… · by hand".
   Panel "switch offline" → red dot, "Switch offline · last known state", rows disabled (H8).
8. AC: before any command it shows "Unknown"; Power on → "On · assumed" with amber ring, dashed
   card border always; − / + step through captured setpoints; − disabled at 18°, + at 30° (H19);
   both disabled while assumed Off.
9. Sensor tiles show fresh, stale ("· 14 min ago", dimmed, count drops to "2 of 3 reporting"),
   and "—"/"No reading yet" states from the panel. Door "Open" is amber.
10. Panel "coordinator offline" → header status red "Coordinator offline", Zigbee-backed cards in
    H8 (H9). Panel "blaster offline" → projector and AC IR buttons disabled with "IR blaster
    offline" (H25).
11. As remote `view`, every card header has a padlock and any control opens the room PIN.
12. `pnpm verify` green, with Vitest covering the pure view-model selectors (projector state line
    text, AC button enablement, sensors reporting text, source tile label, screen button label).

## Notes for the planner
- Put text/enablement decisions in pure selector functions per card (`*.view.ts`) and test those;
  don't test markup.
- The 1280×800 no-scroll requirement is the hardest constraint: plan the vertical budget
  (header 64, gutters 24, gaps 16) before building cards. Primary buttons are 56 tall (SPEC §3.3),
  taller than the screenshot.
- All colours via `state-styles.ts`; the AC card must use the dashed `border-dashed` token.
- Section anchors for `BottomNav` must account for the sticky header (scroll-margin-top).
