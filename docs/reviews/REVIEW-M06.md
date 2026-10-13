# REVIEW-M06 — Settings (S3, S3b–S3e)

Reviewed: 2026-10-13 · Range: code review on `git diff m06-start..HEAD` (84 files, +4290/−112, 50 commits). The prompt named
`m05-start..HEAD`, which also contains the already-reviewed M05 work (REVIEW-M05), so only the M06 part was reviewed again ·
Inputs: `docs/milestones/M06-settings.md`, `docs/plans/PLAN-M06-settings.md`, `CLAUDE.md`, `docs/SPEC.md`,
`reference/screens/03-settings-remote-config.png`.
Method: Verify-all; the dev server (`VITE_API_MODE=mock`, `?mock-panel`) driven over the Chrome DevTools protocol with system
Chromium (headless), one fresh tab (own in-memory `FakeRoom`) per scenario, at 1280×800 and 390×844 (touch); a mock build
served with `vite preview` for the gate; `zbarimg` on a screenshot of the About tab; greps over the diff.

**Verdict: PASS.** AC1–AC11 pass. One check outside the criteria (two browser contexts) is CAN'T VERIFY, same as M02–M05.
**0 MUST-FIX**, 6 LATER.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | ✅ exit 0 |
| Tests | `pnpm -r test` | ✅ contracts 15 files / 134 tests · kiosk 61 files / 489 tests |
| Lint | `pnpm lint` (`hw:lint` / `hw:test` are no-ops until M07) | ✅ exit 0 |
| Build | `pnpm build` | ✅ exit 0 (warning: chunk 730 kB > 500 kB, already M02-L1) |
| Mock build | `VITE_API_MODE=mock pnpm --filter @eduscope/kiosk build` | ✅ exit 0 |
| Audit | `pnpm audit --prod` | ✅ no known vulnerabilities (`qrcode` is the only new runtime dependency) |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `/settings/remote` matches screenshot 03 at 1280×800 | **PASS** | Columns `[271, 937]`, `scrollHeight` 800. Tabs, AC `14` / Projector `2` selected (teal fill, green border), "+ Add device", BLASTER (`ZS06`, `LQI 196`, `r101_ir`, `360°, 12 m`, mains caption), FALLBACK, Projector header "Epson · two commands · via ZS06", COMMAND / CAPTURE rows with Test / Re-learn, "+ Add a command", HOW CAPTURE WORKS verbatim (3 paragraphs). Differences in §3. |
| 2 | Re-learn → Listening… + 20 s + Cancel → "Captured · now test it", untested amber, count amber | **PASS** | Row: "Listening… point the remote at the ZS06 and press the button" `0:20` + only Cancel; other row's Test/Re-learn `disabled`. After ~3 s: "Tuya code · captured · untested", "Captured · now test it"; Projector count colour `rgb(242,169,59)` = warn token. |
| 3 | Test → "Did the Projector react?" Yes / No; "nothing received" keeps the old code | **PASS** | Yes → "Tuya code · tested ✓ just now", count back to green `rgb(52,211,153)`. No on Power off → "Tuya code · no reaction" `rgb(240,82,79)` (danger), count amber. Panel "Next capture: nothing received" + Re-learn → "Nothing received" + **Try again**, status still "tested ✓ just now". |
| 4 | Blaster offline | **PASS** | BLASTER card red border, red dot, "Offline · last seen 0s ago"; all four Test / Re-learn and "+ Add a command" `disabled`, opacity 0.4; re-enabled after toggling back. |
| 5 | + Add device; + Add a command | **PASS** | Empty Save → "Enter a name" / "Enter a brand"; `Screen relay` / `Generic` / MCU / Other → `/settings/remote/mock-dev-1`, list "Screen relay · Generic · via MCU · 0" (grey), detail "Generic · no commands · via MCU". AC → sheet "Saves as “24°”…", + → 25 °C, Save and learn → new last row "25°" Listening; Cancel → row with **Test** (disabled) and **Learn**; AC count amber. See L1 (a 25° entry already existed). |
| 6 | Network, Schedule, Devices, About; add / toggle / delete / rename persist; PIN change; QR | **PASS** | Network: `r-101.local`, `192.168.10.41`, Ethernet, Online, `4` clients. Schedule: 3 blocks + "All off · 18:00 weekdays"; End `09:00` → "End must be after start"; `10:00–11:30` added; toggle On→Off; "Lights off · 21:00 weekdays" added then deleted; all survive Network → Schedule. Devices: rename Projector → "Main projector" (also in Remote list); Permit joining → "Joining open · 4:00 left", `/devices` shows "Open · 3:59 left". Room PIN: `4321` → "Enter the new room PIN again"; `4320` → "The PINs don't match · start again"; `4321` ×2 → toast "Room PIN changed"; afterwards Lock + Power off: `1234` → "Wrong PIN", `4321` accepted. Technician PIN sheet shows 6 dots. About: `R-101`, `0.6.0`, "3 d 4 h", "Raspberry Pi 5 Model B Rev 1.0"; `zbarimg` on the screenshot → `QR-Code:http://r-101.local`. |
| 7 | Restart controller: confirm → reconnecting → "Back online" | **PASS** | Dialog "Restart the controller?"; after Restart "Reconnecting…" from 0.6 s, "Back online" at 9.4 s, gone at 11.2 s; stays on `/settings/about`, uptime "under a minute". |
| 8 | 390px | **PASS** | Tab strip `scrollWidth 606 / clientWidth 390`, `overflow-x: auto`; selecting About / Devices scrolls it so the tab is visible (`312–390`, `216–308`). Remote opens on the device list; Projector → `/settings/remote/projector` with "← All devices"; rows two lines, Test and Re-learn `158×48` each. HOW CAPTURE WORKS: first sentence + More → rest. `scrollWidth 390 = innerWidth` on Remote list, Remote detail, Network, Schedule, Devices, About; **0** targets under 48px in `main` / `header` / tabs; sheets open from the bottom (`y 603`, full width). |
| 9 | Expire session on any tab → `/` | **PASS** | All five tabs end on `/` with the "Locked · enter PIN to control" toast. |
| 10 | FRONTEND COMPLETE GATE | **PASS** | Mock build exit 0, `vite preview`; S1, S2, S4 (Settings → PIN), all five S3 tabs and one sheet/dialog each, at 1280×800 and 390×844: console errors and warnings **0**. (Headless Chromium over CDP, not `--kiosk`.) |
| 11 | `pnpm verify` green with the listed Vitest coverage | **PASS** | §1. `command-row.test.ts`, `remote.view.test.ts`, `schedule-form.test.ts`, `pin-change.test.ts`, `forms.test.ts`, `fake-ir`, `fake-schedule`, `fake-room-settings`, `capture-store`, `apply-event`, `http-client`, `queries`, `network.view`, `schedule.view`, `devices.view`, `about.view`. |

Regression: `/` at 1280×800 `[scrollHeight, innerHeight]` = `[800, 800]`; `/devices` opens from Settings' "Controls" and shows the
permit-join countdown. **Two browser contexts: CAN'T VERIFY** (each context has its own in-memory `FakeRoom`, M02-L3).

States: listening, captured/untested, testing, tested, no reaction, nothing received, not captured, blaster offline, connection
dropped ("Reconnecting…" then "Back online"), expired session, empty (new device "No commands yet"), pending (Save/Test) all render.
**Failed** settings mutations cannot be triggered from the mock panel (L3); the inline error copy exists in the code
("Couldn't save · try again" etc.) but was not seen rendered.

## 3 Visual diff (vs `reference/screens/03-settings-remote-config.png`)

1280×800:
- Same structure, order, copy and colours: tabs with the active one attached, device cards with green counts, selected card
  teal, dashed "+ Add device" and "+ Add a command", BLASTER and FALLBACK cards, COMMAND / CAPTURE table, three-paragraph help.
- Header is 64px (reference ~76px) and has a **Lock** button beside "Technician access" (S3.E3 `[INFERRED]`, D-notes in plan).
- Left column is 22% (`271px`, ARCHITECTURE §4.1); the reference is ~18%.
- Status text is smaller than in the reference and starts at the second column; Test / Re-learn are slightly wider.
- The collapsed mock panel (bottom right) covers nothing here; when open it covers the right-hand 250px (dev only).
- "Offline · last seen 0s ago" in the BLASTER card wraps to two lines at 271px (mock value; fine in the real world only if
  the string stays short).

390×844: no reference image. Header: back arrow, "Settings", "Technician access" (two lines), lock icon, `R-101`. Detail
page has "← All devices", name + "Epson · two commands · via ZS06", two-line rows. About shows the QR (224px, light plate, readable)
with the URL under it.

## 4 Code review findings

| ID | Severity | Finding | Where |
|---|---|---|---|
| L1 | LATER | The mock seeds an AC setpoint for every 18–30 °C, so the walk-through's "+ Add a command 25° / cool / auto" creates a **second** "25°" row; nothing rejects a duplicate setpoint or name. Decide the rule (reject with a clear error, or replace) in M09 and mirror it in the sheet validation and the mock. | `data/adapters/mock/fake-ir.ts`, `features/settings/remote/forms.ts` |
| L2 | LATER | Overlapping class blocks are accepted (`10:00–11:30` next to `10:15–12:15`). SPEC has no overlap rule; add one in M09 (and the sheet) or document that overlap is fine. | `features/settings/schedule/schedule-form.ts` |
| L3 | LATER | The mock panel's "Fail next command" / "Time out next command" only affect room commands, so no settings mutation (schedule, devices, PIN, permit join, restart) can be made to fail and the inline "Couldn't … · try again" states cannot be seen. Let the mock settings API honour the same flags. | `data/adapters/mock/fake-room-settings.ts`, `app/dev/MockPanel.tsx` |
| L4 | LATER | The collapsed mock panel still sits over the lower-right of Settings pages at 1280 and over the page bottom at 390 (extends M02-L4, M03-L1, M04-L1, M05-L1). | `app/dev/MockPanel.tsx` |
| L5 | LATER | `vite preview` (like `vite dev`, M02-L2) listens on every interface (`172.16…`, `192.168…`, tailscale); only core-api may bind 0.0.0.0. Make LAN exposure opt-in for both. | `apps/kiosk/vite.config.ts` |
| L6 | LATER | The mock restart takes ~9 s to "Back online" (plan text says 6–8 s); and the BLASTER offline caption wraps in the 22% column. Cosmetic. | `data/adapters/mock/fake-room-settings.ts`, `features/settings/remote/BlasterCard.tsx` |

Checked with nothing found:
- No hex/rgb/hsl literals or arbitrary colour values in the diff (the arbitrary values are grid templates and the dialog
  centring); no `any`, `@ts-ignore`, `eslint-disable`, or `as` casts other than `as const`.
- Contracts: no change in `packages/`, `apps/core-api`, `services/`, `deploy/`; the HTTP adapter's new calls parse
  requests and responses with the existing contract schemas (`http-client.ts`, with tests).
- Settings queries are `enabled` only for a technician session (`data/settings/hooks.ts`); no `fetch`, sockets or storage in
  `features/`; query keys come from `data/query-keys.ts`; no feature imports another feature.
- Mutations: server-state only (invalidate on success, no optimistic cache writes); controls disabled while not connected
  (`useWritable`). No core-api route added, so no new `config.access` to check (M09).
- Reuse: `PinPad` for PIN change, `ui/sheet`, new `ui/dialog` (shadcn), shared sheet controls in `settings/shared/`; no
  duplicate of an existing component. Every `*.view.ts` / logic file has a test; `.tsx` files are markup only.
- No hover-only affordances; every target ≥ 48px at 390 (measured). No secrets, PINs or ports in the diff other than the
  existing mock PINs (M03-L2). `qrcode` renders to SVG path with token colours; URL comes from `AboutInfo.url`.
- Plan housekeeping: 50/51 task boxes ticked (T51, the walk-through, is this review), `## Blockers` empty, one commit per task.

## 5 Gate

AC1–AC11: **PASS** (two-context check CAN'T VERIFY, M02-L3; failed-mutation rendering not exercised, L3). **0 fix tasks.**
6 LATER items added to `docs/milestones/M00-index.md` → Backlog (M06-L1 … M06-L6).
