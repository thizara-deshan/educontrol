# REVIEW-M02 — App shell & data layer

Reviewed: 2026-10-12 · Range: `git diff m02-start..HEAD` (87 files, +6249/−354) ·
Inputs: `docs/milestones/M02-shell-data-layer.md`, `docs/plans/PLAN-M02-shell-data-layer.md`, `CLAUDE.md`,
`docs/SPEC.md`, `reference/screens/01-control-page.png`.
Method: `pnpm verify` + `pnpm build`; the dev server in mock mode, driven by Playwright (system Chromium) at
1280×800 and 390×844 (touch); greps over `apps/kiosk/src`; reading the data layer.

**Verdict: FAIL**: 9/9 acceptance criteria pass, but there is **1 MUST-FIX**: commands crash on every non-localhost
client, i.e. on the real room LAN (F1). There are 6 LATER items.

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | ✅ contracts + kiosk |
| Lint | `pnpm lint` | ✅ 0 problems |
| Tests | `pnpm test` | ✅ contracts 15 files / 134 tests · kiosk 19 files / 169 tests |
| hw | `pnpm hw:check` | ⚪ no-op until M07 (as planned) |
| Build | `pnpm build` | ✅ (warning: `index-*.js` 582 kB > 500 kB, see L1) |

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Routes render placeholders in the shell; unknown → `/`; back/forward | **PASS** | `/`, `/devices`, `/settings/remote`, `/settings/about` render placeholder cards inside the header shell at both sizes; `/nope` lands on `/`. Back/forward come from React Router's data router (not scripted separately). |
| 2 | Header matches 01 at 1280×800; at 390 one 56px row, icon buttons ≥48, dot → sheet | **PASS** | Desktop header: wordmark, `02:59` mono clock, `Mon 12 Oct`, "● All systems normal", `R-101`, Devices, Settings. Phone: header height 56, no interactive element < 48×48, clock/date hidden, status is a dot button; tap opens the bottom sheet "SYSTEM STATUS / All systems normal / Close". |
| 3 | First load: "Connecting…" + skeletons until the snapshot | **PASS** | At `domcontentloaded` the header read `eduscope CENTRAL · Connecting… · R-101 · Devices · Settings` with 9 `[data-slot=skeleton]` elements on `/dev/components`; values appeared after ~0.5 s. |
| 4 | Drop → amber "Reconnecting…", controls disabled + greyed with values kept; 10 s → red "Can't reach R-101 controller" + 48px Retry; Restore → "Back online" 2 s | **PASS** | Banner sequence observed: `Reconnecting…` → (10.5 s) `Can't reach R-101 controller`, Retry box 96×48 → after Restore+Retry `Back online` → gone 2.6 s later. Screenshot: live section greyed, values kept, buttons disabled. |
| 5 | Visibility hidden→visible after drop+restore: reconnect at once, snapshot values | **PASS** | Drop → "Change by hand" (page still showed Front of room **On**) → Restore → dispatched `visibilitychange` hidden/visible → within 0.9 s "Back online" and Front of room **Off** (snapshot value). |
| 6 | `/dev/components` (dev only) shows every shared component in each §3.4 state | **PASS** | Gallery shows StateDot, ObservedLine, Card, CommandButton, ToggleRow, LevelSlider, SensorTile, MetricTile, KeyValueRow, InlineError, LockBadge, DashedAddButton in confirmed / selected / assumed / off / unknown / stale / offline / pending. Route is behind `import.meta.env.DEV` (`app/router.tsx:9`). |
| 7 | Pending pulse, label unchanged, value only on push, repeat taps ignored; fail → 6 s inline error; timeout → "No response · tap to retry" | **PASS** (on localhost; see F1) | "Power off": label stayed, projector `running` → `standby` only after the push. Fail next → "Command failed" inline (1 found); Time out next → "No response · tap to retry" (found). Repeat-tap suppression covered by `command-sender.test.ts` (`isPending` guard). |
| 8 | "Change from phone" → toast "Rear of room turned on · from phone", bottom, 4 s | **PASS** | Sonner toast text exactly `Rear of room turned on · from phone`, bottom-centre; `duration={4000}` in `ui/sonner.tsx`. |
| 9 | `pnpm verify` green with the listed Vitest coverage | **PASS** | All listed files exist with passing tests: `apply-event`, `connection`, `pending-store`, `state-styles`, `level-slider`, `format`, `client-label`, `http-client`. |

## 3 Visual diff vs `reference/screens/01-control-page.png` (header row only — S1 body is M04)

1280×800:
- Layout, order and copy match: wordmark (`eduscope` white + `CENTRAL` brand-red, tracked), mono clock + mono date,
  green dot + "All systems normal", mono `R-101` chip, Devices (wifi icon) and Settings (gear) buttons.
- Clock is centred; the reference has it ~43% from the left (already noted in the plan's nice-to-haves).
- Header height is 64px; the reference header is taller in proportion (≈ 96px on its ~1880px canvas ≈ 65px at
  1280), so it matches within scale.
- Colours, radii and type look the same as the tokens. No copy differences.

390×844:
- One 56px row: wordmark (smaller), status dot (48×48 hit area), `R-101` chip, icon-only Devices/Settings at 48×48.
  No horizontal scroll on any route or on `/dev/components`.
- Status sheet: bottom sheet, dimmed backdrop, 48px Close button. OK.

States (mock panel): pending (pulsing border), failed and timed-out inline errors, toast, device offline (lights
"Switch offline · last known state", header amber "Lighting switch offline"), reconnecting, unreachable, back
online all render. Two dev-only notes:
- The floating mock panel covers part of the gallery (Card/LevelSlider columns at 1280, the lights rows at 390).
  It can be collapsed with "–" (L4).
- **Two browser contexts:** a command in context A did **not** appear in context B (`A standby / B running`).
  This is expected by design: each tab runs its own in-memory `FakeRoom`, and M02 has no core-api. Cross-client
  sync **can't be verified until M08** (L3).

## 4 Code review findings

| ID | Severity | Finding | Where |
|---|---|---|---|
| F1 | **MUST-FIX** | `crypto.randomUUID()` is only defined in secure contexts (HTTPS or `localhost`). The room UI is served over plain `http://r-101.local` (SPEC §2.1), so on every phone, tablet, laptop and the kiosk (if it opens the LAN name) `newId()` throws `TypeError: crypto.randomUUID is not a function`. That happens before `pending.add`/`try`, so the tap does nothing and no error is shown. Reproduced: dev server opened at `http://172.16.24.10:5173` → `isSecureContext=false`, tapping "Power off" left the projector `running`, console `crypto.randomUUID is not a function`. AC7 passes only on localhost. | `apps/kiosk/src/data/commands/command-sender.ts:18` |
| L1 | LATER | Mock adapter + mock panel ship in the production bundle (582 kB chunk). Code-split behind `VITE_API_MODE` (already a plan nice-to-have). | `data/create-api-client.ts`, `app/dev/` |
| L2 | LATER | Kiosk Vite dev server binds `0.0.0.0` (`server.host: true`). Dev-only (production is served by core-api) and from M01, but it goes against "only core-api on 0.0.0.0" on a shared network. Make it opt-in (`--host` when testing phones). | `apps/kiosk/vite.config.ts` |
| L3 | LATER | Mock tabs don't share state, so the "change in one browser appears in the other" walk-through can't run before M08. Optionally share the `FakeRoom` across tabs via `BroadcastChannel`. | `data/adapters/mock/` |
| L4 | LATER | Mock panel overlays gallery content at both sizes; start it collapsed or dock it to the bottom. | `app/dev/MockPanel.tsx` |
| L5 | LATER | `ui/sheet.tsx` close button keeps shadcn's `hover:opacity-100` and a 16px icon (not 48px). Unused today (`showCloseButton={false}`), but it breaks the touch rules if a later milestone enables it. | `apps/kiosk/src/ui/sheet.tsx:75` |
| L6 | LATER | `http-client.sendCommand` calls `CommandRequest.parse` and throws a `ZodError` rather than `ApiRequestError("bad_response")`, so callers can't rely on the documented error type. | `data/adapters/http/http-client.ts` |

Checked with nothing found: no hex/rgb literals outside `tokens.css`, no arbitrary colour classes, no `as` casts
(other than `as const`), `any` or `@ts-ignore`. Every REST response and WS frame is zod-parsed (`http-client.ts`).
Env goes through zod (`data/env.ts`). Query keys are only built in `query-keys.ts`, and only `cache-port.ts` (via
`apply-event`) writes `["state"]`. `components/` doesn't import `data/` and features don't import each other.
`fetch`/`WebSocket` are only used in `data/adapters/http`. No secrets or PINs. No hardware code, core-api routes or
Pi-specific paths in this range.

## 5 Gate

AC1–AC9: **PASS** (AC7 on localhost only, because of F1). **1 fix task** (F1) appended to the plan as
`## Fix tasks (review 1)`. 6 LATER items added to `docs/milestones/M00-index.md` → Backlog.

## 6 Acceptance

2026-10-12: FX1 done (`579f28b`). Commands verified from a non-localhost origin (`isSecureContext=false`),
`pnpm verify` green (kiosk 172 tests). 0 MUST-FIX open. **M02 accepted.**
