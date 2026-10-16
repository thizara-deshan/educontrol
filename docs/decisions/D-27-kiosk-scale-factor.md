# D-27 — The kiosk renders at 1.5× on R-101's 1920×1200 screen

Date: 2026-10-16 · Milestone: M10 · Amends: ARCHITECTURE §9 "Chromium kiosk" flags. SPEC §2.1 (kiosk viewport
1280×800) is unchanged: this record keeps the kiosk at that CSS viewport.

## Context

The UI is designed and checked at a 1280×800 viewport (SPEC §2.1, §2.2, §3.2 sizes are px on the 1280 canvas).
The screen attached to R-101's Pi is 1920×1200 (`wlr-randr`: HDMI-A-2, 1920x1200 current). Chromium rendered the
page at 1920×1200 CSS px, so every element was at its 1280-canvas size and a large empty area was left below S1.
The owner asked for the UI to fill the screen with larger elements.

## Decision

1. `deploy/pi/kiosk/launch.sh` starts Chromium with `--force-device-scale-factor=$EDUSCOPE_KIOSK_SCALE`, default
   `1.5`. 1920×1200 ÷ 1.5 = 1280×800 CSS px, the designed viewport: same layout, everything 1.5× larger and sharp.
2. A Pi with a 1280×800 panel sets `EDUSCOPE_KIOSK_SCALE=1` in the desktop user's environment.
3. No kiosk UI code, token or breakpoint changes. Remote clients (podium PC, laptop, phone) are unaffected; a
   1920-wide podium PC can use browser zoom 150% for the same result.

## Consequences

- Restarting the kiosk browser (or rebooting) is needed after `git pull` + `install.sh --kiosk` for the flag to
  apply.
- Touch targets become ≥72 physical px (48 CSS px × 1.5).
