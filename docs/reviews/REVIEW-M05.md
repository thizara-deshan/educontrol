# REVIEW-M05 — Devices page (S2)

Reviewed: 2026-10-13 · Range: code review on `git diff m05-start..HEAD` (33 files, +1433/−91). The prompt named
`m04-start..HEAD`, which also contains the already-reviewed M04 work (REVIEW-M04), so only the M05 part was reviewed again ·
Inputs: `docs/milestones/M05-devices-page.md`, `docs/plans/PLAN-M05-devices-page.md`, `CLAUDE.md`, `docs/SPEC.md`
(S2.E1–E23, §2.2, H8–H11, H15, H16, R7, R11, R13), `reference/screens/02-devices-zigbee.png.png`.
Method: Verify-all; the dev server (`VITE_API_MODE=mock`, `/devices?mock-panel`) driven over the Chrome DevTools
protocol with system Chromium, one fresh tab (own in-memory `FakeRoom`) per scenario, at 1280×800 and 390×844 (touch);
greps over the diff; reading the selectors and cards.

**Verdict: PASS.** 8/9 acceptance criteria pass and AC1–AC9 have no FAIL. One check outside the criteria (two browser
contexts) is CAN'T VERIFY, same as M04. **0 MUST-FIX**, 2 LATER.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck, lint, tests | `pnpm verify` | ✅ exit 0 · contracts 15 files / 134 tests · kiosk 47 files / 383 tests · hw no-op until M07 |
| Build | `pnpm build` | ✅ exit 0 (warning: chunk > 500 kB, already M02-L1) |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | 1280×800 matches screenshot 02 | **PASS** | Columns `[901, 300]` (75/25). Order and copy as in the reference: MAINS POWERED — ROUTERS, both cards, BATTERY — END DEVICES table, COORDINATOR / MESH / "TWO ROUTERS, NO SINGLE PATH" / SHUTDOWN INTERLOCK. Page height 854 at 800 (scrolls ~54px; allowed, D15 / CLAUDE.md "S1 with no scrolling"). |
| 2 | "← Controls" → S1; Settings through the technician gate | **PASS** | Header links `Controls:/`; click → `/`. Settings on `/devices` → "Technician PIN" overlay, path stays `/devices`. |
| 3 | Router cards: mono ids, badge, LQI, tiles, metrics | **PASS** | `ZBM5-2C-86W · r101_lights`, `S60ZBTPG · r101_proj_plug`, "Router" badges, `LQI 214` / `LQI 231`, Front of room On (green) / Rear of room Off, Mains to projector On, `287 W` (green) · `231 V` · `1.84 kWh` · `13 A`. |
| 4 | Battery table, low battery, stale, empty | **PASS** | Rows Room climate / Motion / Door with reading, battery, link, last seen. Computed colours: 18% `rgb(242,169,59)` = warn token, 8% `rgb(240,82,79)` = danger token. Stale: last seen `14 min ago` warn, reading `rgb(108,122,136)` (text-3). S1 header with 8%: "Sensor battery low" (H16). No battery devices: "No battery devices paired". |
| 5 | Lighting switch offline (R7) | **PASS** | Red dot + "Offline · last seen 5 min ago" replaces LQI, tiles greyed, red border. Callout amber "ONE ROUTER LEFT … Restore the lighting switch soon." (same for the projector socket). |
| 6 | Coordinator offline / joining | **PASS** | Header "Coordinator offline" red; coordinator and mesh values greyed (H9); callout red "NO ROUTERS ONLINE" (inferred variant). "Coordinator starting…" in the header. Joining "Open · 4:12 left". Countdown ticking is covered by `side.view.test.ts` and the shared ticker test, not watched by eye. |
| 7 | Interlock holding (H15) | **PASS** | "Holding" / "Waiting for projector to cool · 112 W"; POWER shows `112 W`. Bypassed: "Bypassed" / "Projector mains can be switched off at any draw." |
| 8 | 390px layout | **PASS** | Header: "← Controls" with label, "Zigbee devices", coordinator dot, gear icon. Order routers → 3 battery cards (3 lines each) → coordinator → mesh → callout → interlock. Metrics 2×2. `scrollWidth 390 = innerWidth`; **0** targets under 48px in `header` / `main`. |
| 9 | `pnpm verify` green with S2 selector tests | **PASS** | §1. `battery.view.test.ts`, `side.view.test.ts`, `routers.view.test.ts`, `coordinator-status.view.test.ts`, `mock-nodes.test.ts`, `fake-room-devices.test.ts`, `server-time.test.ts` (shared ticker). |

**Two browser contexts: CAN'T VERIFY.** Each context has its own in-memory `FakeRoom` (M02-L3); not new in M05.

States: offline (routers, coordinator, nodes), stale, low/critical battery, empty, loading skeleton, starting, joining,
holding, bypassed and "no routers online" all render. Pending, assumed and failed do not apply: S2 has no controls (Q11).

## 3 Visual diff (vs `reference/screens/02-devices-zigbee.png.png`)

1280×800:
- Same structure, order, copy, colours and proportions (main/side 75/25, green On tiles, Router badge, green `287 W`, green
  Routers `2`, green callout).
- Header: ours is 64px (reference ~76px) and the Settings button has a gear icon (reference: text only). The coordinator
  status is a small dot + caption in both.
- Side-column and table text is slightly smaller than in the reference (reference screenshot is 1873px wide, so proportions
  are scaled); row spacing in the Coordinator card is a little tighter. Gang tiles are 48px.
- Page scrolls ~54px (reference is cropped at the same place).
- Dev only: the collapsed mock panel covers the Shutdown interlock card (see L1).

390×844: no reference image. One column, no horizontal scroll, battery cards with name + reading, model · friendly name,
then `Battery 98% · Link 168 · 15s ago`; offline, stale and empty variants fit. The mock panel covers the "BATTERY —
END DEVICES" label and the first card (L1).

## 4 Code review findings

| ID | Severity | Finding | Where |
|---|---|---|---|
| L1 | LATER | The collapsed mock panel covers the Shutdown interlock card at 1280×800 and the first battery card at 390 (extends M02-L4, M03-L1, M04-L1). | `apps/kiosk/src/app/dev/MockPanel.tsx` |
| L2 | LATER | With one router offline, Mesh still shows "Routers `2`" in accent next to the amber "ONE ROUTER LEFT" callout. It is the paired count from `mesh.routers`; decide in M08 (server mesh counting) whether it means paired or online and show it consistently. | `features/devices/side/side.view.ts` (`meshView`) |

Checked with nothing found:
- No hex/rgb/hsl literals, `[#…]` or arbitrary-value classes in the diff (new colours are tokens / `state-styles`); no
  `any`, `@ts-ignore`, `eslint-disable`, `as` casts other than `as const`.
- Contracts: no contract change in the range (`packages/`, `services/`, `apps/core-api`, `deploy/` untouched); selectors
  take `@eduscope/contracts` types; nothing re-declared by hand.
- Reuse: `MetricTile` (extended with a stale age, T4), `Card`, `SectionLabel`, `StateDot`-style tones from
  `state-styles`, the shared `sensorReadingDisplay` (extracted from S1, T2) and the shared one-second ticker; no duplicate
  of an existing component. The two battery markups in one component are allowed (ARCHITECTURE §4.1).
- Tests: each `*.view.ts` has a test; the `.tsx` files are markup only. Mock helpers, FakeRoom S2 methods and the ticker are
  tested.
- Boundaries: no `fetch`, sockets or storage in components; query keys unchanged; no feature imports another feature
  (`app/Header.tsx` imports `features/devices/header`, as it already did for `features/session`).
- No `hover:`-only affordances; every target ≥ 48px; S2 has no mutating control (no routes).
- No hardware code, secrets, PINs, paths or ports in the diff; nothing new listens on 0.0.0.0.
- Plan housekeeping: 33 task boxes ticked, `## Blockers` empty, one commit per task.

## 5 Gate

AC1–AC9: **PASS** (AC6 countdown by unit test, not by eye; two-context check CAN'T VERIFY, M02-L3). **0 fix tasks.**
2 LATER items added to `docs/milestones/M00-index.md` → Backlog (M05-L1, M05-L2).
