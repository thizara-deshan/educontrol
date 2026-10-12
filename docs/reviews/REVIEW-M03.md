# REVIEW-M03 — Access & kiosk behaviour

Reviewed: 2026-10-12 · Range: `git diff m03-start..HEAD` (53 files, +1758/−95) ·
Inputs: `docs/milestones/M03-access-kiosk.md`, `docs/plans/PLAN-M03-access-kiosk.md`, `CLAUDE.md`,
`docs/SPEC.md` (§2.3, §2.6, S1.E7/E8, S3.E3, S4, H12/H17/H23/H24, R14/R15),
`reference/screens/03-settings-remote-config.png` (there is no S4 reference image; S4 is `[INFERRED]`).
Method: `pnpm verify` + `pnpm build`; the existing dev server (mock mode, `?mock-panel`) driven by
Playwright (`playwright-core` + system Chromium) at 1280×800 (mouse) and 390×844 (touch), one fresh browser
context per scenario; greps over `apps/kiosk/src`; reading the whole diff outside the plan file.

**Verdict: FAIL.** 9/9 acceptance criteria pass, but there is **1 MUST-FIX**: with a Lock button in the header
(any remote `control`/`technician` session) the header breaks at 1280×800 (R-101 chip wraps, icons squashed to
6px) and the Lock button is partly off-screen at 600px (F1). There are 5 LATER items.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | ✅ contracts + kiosk |
| Lint | `pnpm lint` | ✅ 0 problems |
| Tests | `pnpm test` | ✅ contracts 15 files / 134 tests · kiosk 28 files / 258 tests |
| hw | `pnpm hw:check` | ⚪ no-op until M07 (as planned) |
| `pnpm verify` | all of the above | ✅ exit 0 |
| Build | `pnpm build` | ✅ (warning: `index-*.js` 596 kB > 500 kB, already M02-L1) |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `view`: padlocks; tap → "Enter room PIN", 4 dots; `1234` closes it, control did **not** fire, 2nd tap fires | **PASS** | 1280 and 390: 4 padlock badges on `/dev/components`; tapped "Power off" → dialog "Enter room PIN", `0 of 4 digits entered`. After `1234` the dialog closed and the projector still read `running`; the second tap gave `standby`. |
| 2 | 5 wrong → keypad disabled, "Too many tries · wait 0:59" counting down, re-enables at 0 | **PASS** | Both sizes: "Wrong PIN" after the first miss; after the fifth "Too many tries · wait 0:59", 11 keys disabled (digits + ⌫), Cancel enabled; 3 s later `0:56`; after ~62 s message empty, 0 disabled, `1234` unlocks. |
| 3 | Header Settings → "Technician PIN" 6 dots; `123456` → `/settings/remote`; Cancel stays on `/`; typed `/settings/network` gated | **PASS** | Both sizes: "Technician PIN", `0 of 6 digits entered`; Cancel → path `/`, `history.length` unchanged (no extra entry); `123456` → `/settings/remote`. Fresh load of `/settings/network`: dialog first, page body empty until unlocked; Cancel → `/`; unlock → `/settings/network`. |
| 4 | Remote `control`: Lock in header, drops to `view` in place; on `/settings/*` navigates to `/` | **PASS** (header layout: F1) | After `1234` one Lock button; tap → Lock gone, path unchanged (`/dev/components`), no toast (D4). On `/settings/remote` as technician: Lock → path `/`. |
| 5 | "Expire session" → toast "Locked · enter PIN to control", padlocks return | **PASS** | Toast text exact, padlock icons 2 → 4, Lock button gone. Expiring while on `/settings/remote` also navigated to `/`. |
| 6 | "Be kiosk": no Lock, controls usable without PIN, Settings asks technician PIN | **PASS** | No Lock button; "Power off" fired with no dialog (`running` → `standby`); Settings → "Technician PIN" 6 dots. |
| 7 | Kiosk, `?idle-scale=0.02`: return to `/` + drop technician; dim; black; wake tap swallowed; occupancy wakes | **PASS** | Both sizes. Timeline after the last tap: `/settings/remote` → `/` at ~2.5 s, `dim` at ~6.2 s, `blank` at ~18 s (scaled 2/5/15 min). Settings asked for the technician PIN again (dropped). Tap on Settings while blank: overlay gone, no dialog. Tap on "Power off" while dim: overlay gone, projector stayed `running`; next tap → `standby`. "Occupancy detected" woke it from dim and from blank (mouse and touch). |
| 8 | 390: keypad in the lower half, 64×64 keys; 1280×800 centred overlay | **PASS** | 390×844: all 12 keys 64×64, first row top y=422 = 844/2. 1280×800: 64×64 keys in a card centred at x=640 (496–784) over a dimmed backdrop. |
| 9 | `pnpm verify` green with the listed Vitest coverage | **PASS** | `pin-input.test.ts` (auto-submit, backspace, countdown), `decide-access.test.ts` (table), `idle-timer.test.ts` (fake timers), `wake-guard.test.ts`; plus `session-change`, `kiosk-params`, `pin-requests`, `session-actions`, `format`, `fake-room`, `http-client`, `gate`. The guard swallows the 3 events of the waking tap and then passes the next tap (the test's "exactly one tap"). |

Also checked: `touch-action: manipulation` on buttons; with `html.kiosk`: `user-select: none`, `cursor: none`,
`contextmenu` default prevented; no `hover:` in app code (only the unused shadcn `ui/sheet.tsx`, M02-L5).

## 3 Visual diff

There is no S4 reference. Compared against `03-settings-remote-config.png` (S3.E3) and the SPEC text.

1280×800:
- S4: dimmed backdrop + centred card: `R-101` chip, "Enter room PIN" / "Technician PIN", dots, keypad `1–9 · Cancel 0 ⌫`.
  Wrong = red "Wrong PIN" + shake; locked = amber "Too many tries · wait 0:59". Copy matches SPEC S4.E1–E5.
- S3.E3: reference shows "Technician access" at the right of the S3 header beside the `R-101` chip; the build has a
  row "Technician access [Lock]" above the placeholder card (plan D12, M06 moves it). Copy matches; layout is M06.
- **Header with Lock (remote `control`/`technician`): broken.** The `R-101` chip wraps to two lines ("R-" / "101"),
  "All systems normal" wraps to two lines, and the Devices, Settings and Lock icons are squashed to ~6px
  (measured 6/6/10px). Baseline (`view`, no Lock) at 1280 is clean. See F1.
- Kiosk dim (80% black) and blank (black) cover the page; the mock panel stays above the overlay (D9).

390×844:
- S4: title and dots in the top half, keypad in the lower half, 16px gaps; nothing scrolls.
- Header with Lock: one 56px row, wordmark, dot, `R-101`, and three 48×48 icon buttons. No horizontal scroll, no target < 48px
  (checked on `/`, `/settings/remote`, `/dev/components`).
- The expanded mock panel (open by default, above the PIN overlay) covers the lower-right keys, so the keypad
  can only be driven by hand after collapsing the panel (L1).

Missing states: none found for M03. Pending (pulse), failed ("Command failed"), timed out ("No response · tap to
retry"), device offline (lights controls disabled + "Switch offline · last known state"), reconnecting, unreachable
("Can't reach R-101 controller" + Retry), "Back online", expired-session toast and `view` padlocks all render at both
sizes with the mock adapter (a `locked` control stays tappable; `disconnected` and `offline` still disable it).
**Two browser contexts:** can't verify. Each tab has its own in-memory `FakeRoom` (M02-L3), so a change in one
context does not reach the other until M08.

## 4 Code review findings

| ID | Severity | Finding | Where |
|---|---|---|---|
| F1 | **MUST-FIX** | The header has no `shrink-0`/`whitespace-nowrap` on its fixed items and shows button labels from `sm` (≥600). Adding Lock (S1.E8) pushes the row over its width: at **1280** the `R-101` chip wraps and the Devices/Settings/Lock icons shrink to 6/6/10px; at **600** the Lock button ends at x=610 (10px past the viewport, clipped by `overflow-x: clip`); at 640–1023 the wordmark is squeezed to 14–74px. At **1024–1100** the icons shrink to 0–9px even without Lock (from M02, same cause). CLAUDE.md requires 1280×800 to work, and the Lock button is the M03 AC4 deliverable. The plan's nice-to-have only mentions 600–1023 as "pre-existing"; it misses 1280 and the clipped Lock. | `apps/kiosk/src/app/Header.tsx`, `components/LockButton.tsx`, `app/StatusIndicator.tsx` |
| L1 | LATER | The mock panel is open by default and (D9) sits above the PIN overlay, so at 390 it covers the lower-right keypad keys; taps on them hit the panel. Start collapsed, or collapse while S4 is open. Extends M02-L4. | `apps/kiosk/src/app/dev/MockPanel.tsx` |
| L2 | LATER | The mock PINs `1234` / `123456` are string constants in `fake-room.ts` and ship in the production bundle together with the mock adapter. They are the documented mock values (ARCHITECTURE §4.4) and core-api has its own hashes, but the code-split in M02-L1 should also keep them out of the Pi build. | `data/adapters/mock/fake-room.ts` |
| L3 | LATER | `GET /favicon.ico` is a 404 on every load (console error). Add a favicon (or `<link rel="icon" href="data:,">`) in `index.html`. | `apps/kiosk/index.html` |
| L4 | LATER | `LockButton` copies the whole `HEADER_BUTTON_CLASS` string from `Header.tsx`; two class strings must now be kept in step (F1 touches both). Move the class to `components/` and share it. | `components/LockButton.tsx`, `app/Header.tsx` |
| L5 | LATER | Not reproduced, from reading `computeControlGate`: while the session is still loading (`access === undefined`) the gate reports `locked`, so a padlock badge may flash on card headers until `/api/session` answers. Worth a look when M04 lays out real cards (maybe `reason: null`, `enabled: false` while loading). | `apps/kiosk/src/data/gate.ts` |

Checked with nothing found: no hex/rgb literals outside `tokens.css` (the only new colour is the `--color-sleep` token,
D8), no arbitrary colour classes, no `as` casts other than `as const`, no `any` or `@ts-ignore`. Every new boundary is
zod-parsed: `login` validates `LoginRequest` before fetching and parses the `PinError` / `ClientSession` body, `?idle-scale`
goes through zod, env unchanged. No new contract types were defined by hand. Query keys come from `query-keys.ts`; session
writes go through `setQueryData(sessionQuery(api).queryKey, …)` with a server-returned session (not optimistic). No
feature imports another feature; `data/` imports nothing from `features/`. Locked taps never send (`useCommand`) and are
not replayed after unlock. No hardware code, core-api routes or Pi-specific paths in this range, so no mutating route
lacks a role check. No new listeners on 0.0.0.0 (the Vite `host: true` from M01 is M02-L2). The kiosk/remote
decision uses `session.client_type`, not the user agent. New logic has tests (see AC9).

## 5 Gate

AC1–AC9: **PASS** (AC4 passes functionally; F1 is the header layout it depends on). **1 fix task** (FX1) appended to the
plan as `## Fix tasks (review 1)`. 5 LATER items added to `docs/milestones/M00-index.md` → Backlog.
