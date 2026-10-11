# REVIEW-M01 — Foundation

Reviewed: 2026-10-12 · Range: `git diff m01-start..HEAD` (`fed9d63`, 127 files, +8144/−22) ·
Inputs: `docs/milestones/M01-foundation.md`, `docs/plans/PLAN-M01-foundation.md`, `CLAUDE.md`, `docs/SPEC.md` §3,
`docs/ARCHITECTURE.md` §1, §3, §4.1–4.2.

**Verdict: PASS** — 7/7 acceptance criteria pass, 0 MUST-FIX, 5 LATER items (moved to the M00 backlog).

## 1 Verify-all

| Step | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` (inside `pnpm verify`) | ✅ contracts + kiosk (`tsconfig.json` + `tsconfig.node.json`) |
| Lint | `pnpm lint` | ✅ 0 problems |
| Tests | `pnpm test` | ✅ contracts 15 files / 134 tests · kiosk 1 file / 5 tests |
| hw | `pnpm hw:check` | ✅ no-op placeholder (M07) |
| **verify** | `pnpm verify` | ✅ exit 0 |
| Build | `pnpm build` | ✅ exit 0 — kiosk `dist/` 223 kB JS, 19 kB CSS, 12 self-hosted `.woff2` |
| Fresh clone | clone → `pnpm install` → `pnpm verify` | ✅ exit 0 |

Environment: Node v26.4.0 (`.nvmrc` says 22, see L1), pnpm 11.28.3, Arch Linux.

## 2 Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| AC1 | `pnpm install && pnpm verify` exits 0 on a fresh clone | **PASS** | `git clone . <scratch>/m01-clone && pnpm install && pnpm verify` → `exit=0` |
| AC2 | Swatch page on `bg #0E1621`, every §3.1 token labelled, sans ≠ mono, no network font requests | **PASS** | Playwright (Chrome 1280×800 and 390×844): `body` background `rgb(14, 22, 33)` = `#0E1621`; 27 labels `bg` … `badge-router-text` (all of SPEC §3.1, `badge-router` split into fill/text); computed fonts `"Inter Variable"` vs `"JetBrains Mono Variable"`, both `document.fonts` entries `loaded`; every request (incl. `inter-latin-wght-normal.woff2`, `jetbrains-mono-latin-wght-normal.woff2`) went to `localhost:5173`, **0 external requests** |
| AC3 | No hex in `apps/kiosk/src` TS/TSX | **PASS** | `grep -rEn "#[0-9A-Fa-f]{3,8}\b" apps/kiosk/src --include='*.tsx' --include='*.ts'` → no output, exit 1. Hex appears only in `styles/tokens.css` |
| AC4 | Contract tests: RoomState, every hw fixture, `observed()` confidence, SensorReading occupancy | **PASS** | verbose run shows `room-normal.json parses as RoomState` ✓, 31/31 `… parses with its schema` ✓ (31 files in `fixtures/hw/`), `observed() > rejects a missing confidence` ✓, `SensorReading > rejects {kind:"occupancy", value:"open"}` ✓ |
| AC5 | `export-hw-schema` regenerates with no diff | **PASS** | `pnpm --filter @eduscope/contracts export-hw-schema && git diff --exit-code packages/contracts/generated/` → exit 0 |
| AC6 | `const x: any = 1` makes `pnpm verify` fail | **PASS** | probe in `apps/kiosk/src/any-probe.ts` → `1:10 error Unexpected any … @typescript-eslint/no-explicit-any`; same probe in `packages/contracts/src/` → `pnpm lint` exit 1. Probes removed, `git status` clean |
| AC7 | No horizontal scrollbar at 390px | **PASS** | at 390×844: `documentElement.scrollWidth` 390 = `clientWidth` 390; no element's right edge exceeds the viewport (checked every `body *`, not just the clipped body); colour grid `173px 173px` (2 per row), type rows stack |

## 3 Visual review

Screenshots taken with Playwright against the Vite dev server (`VITE_API_MODE=mock`) at 1280×800 and 390×844
(viewport + full page). M01 has no real screen, so the only valid comparison with
`reference/screens/01-control-page.png` is the shared vocabulary: background, wordmark, faces, type scale.

| Aspect | Reference 01 | Swatch page | Diff |
|---|---|---|---|
| Page background | dark navy | `#0E1621` | none |
| Wordmark | "eduscope" bold `text-1`, "CENTRAL" bold red, wide tracking | same; "CENTRAL" `rgb(229,72,63)` = `brand`, letter-spacing 2.88px = 0.12em × 24px | none |
| Clock / values | mono semibold `10:42`, `287 W` | `text-clock` / `text-value` samples in JetBrains Mono, slashed zero | none |
| Section labels | `DISPLAY` bold uppercase, wide tracking, grey | `text-section` sample matches | none |
| Radius tokens | cards 10 / buttons 8 / chips 6 | three 360px-wide demo boxes; the 10/8/6 difference is not visible at that size | cosmetic, temporary page → L4 |

At 390px: no horizontal scroll, everything reachable by vertical scroll (page height 2833px), long token
names wrap. **Touch targets:** the page has no interactive elements (by design, plan T21) — nothing to measure.

**Not applicable to M01** (no data layer, no ApiClient, no mock adapter until M02): two-context sync,
and the pending / assumed / failed / offline states. These checks move to the M02 review.

## 4 Code review of the diff

Checked only the categories in the review brief.

| Category | Result |
|---|---|
| zod at every boundary | ✅ Every boundary schema exists in `packages/contracts` (REST, WS, hw) with `z.infer` aliases; no consumer code yet. hw schemas use `z.strictObject` (matches pydantic `extra="forbid"`). `Observed<T>` hand-written twin is type-checked against `z.infer` (`test/common.test.ts:37`) |
| Raw hex / off-token styles | ✅ Hex only in `tokens.css`; values match SPEC §3.1 one-for-one; shadcn variables are `var(--color-…)` only; `TokenSwatches.tsx` uses token classes and `var(--color-${name})`. Minor: `--radius: 8px` literal duplicates `--radius-btn` → L5 |
| Duplicated components | ✅ None (no components yet; `ui/`, `components/` empty) |
| Logic without tests | ✅ All schemas tested; fixture naming rule tested (`hw-fixture-name.test.ts`); fixture coverage enforced per event/request/response; JSON-schema export tested; `token-names.ts` kept in sync with `tokens.css` by test. `TokenSwatches` is pure markup (no test required) |
| Hardware code outside module pattern | ✅ None — `services/hw/` contains only `.gitkeep` |
| Hardcoded secrets / PINs | ✅ None. `.env.development` holds only `VITE_API_MODE=mock`; `.gitignore` covers `.env`, `*.db*`, `deploy/pi/env/*.env` |
| Breaks on a Pi | ✅ Lockfile contains `linux-arm64-gnu` variants for esbuild, rolldown and `@tailwindcss/oxide`; only `esbuild` needs build approval (`allowBuilds`); fonts self-hosted; no absolute paths (scripts use `import.meta.url`). Node version pin is loose → L1 |
| Mutating routes without role check | ✅ N/A — no routes (core-api is a placeholder) |
| Listeners on 0.0.0.0 other than core-api | ✅ Only Vite dev (`server.host: true`), which ARCHITECTURE §2 explicitly specifies for dev on Arch (“`vite :5173` (with `--host`)”) so phones on the LAN can test. Not a production listener |

## 5 Findings

### MUST-FIX
None.

### LATER (→ `docs/milestones/M00-index.md` › Backlog)

| ID | Finding | Where | Suggested fix |
|---|---|---|---|
| L1 | M01 asks for a "Node 22 pin", but `engines.node` is `>=22`, so any newer Node passes silently (this review ran on v26.4). The Pi image could get a different major than Arch | `package.json` | `"engines": { "node": "22.x" }` + `engine-strict=true` in `.npmrc`, or record a decision allowing ≥22 |
| L2 | `packages/contracts/tsconfig.json` gives `types: ["node"]` to `src/` too, so a `node:*` import could slip into contracts, which the kiosk bundles for the browser (ARCHITECTURE §1: "no runtime deps besides zod") | `packages/contracts/tsconfig.json` | Keep `src/` without Node types; put `test/`, `scripts/`, `vitest.config.ts` in a second tsconfig with `types: ["node"]` |
| L3 | The "no hex outside `tokens.css`" rule (AC3) is a manual grep; `pnpm verify` does not enforce it, so it can regress in M02+ unnoticed | root scripts / `eslint.config.js` | Add an ESLint `no-restricted-syntax` rule for string/template literals matching `#[0-9A-Fa-f]{3,8}\b` and `rgb(` in `apps/kiosk/src/**`, or a `check:tokens` script in `verify` |
| L4 | Radius demo boxes on the temporary swatch page are 360px wide, so 10/8/6px radii look identical | `apps/kiosk/src/app/TokenSwatches.tsx` | Nothing, unless the page survives M02 (it is replaced by the router) |
| L5 | `--radius: 8px` in `tokens.css` `:root` duplicates the value of `--radius-btn` | `apps/kiosk/src/styles/tokens.css` | `--radius: var(--radius-btn);` |

## 6 Gate

| AC1 | AC2 | AC3 | AC4 | AC5 | AC6 | AC7 |
|---|---|---|---|---|---|---|
| PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Fix tasks: **0**. LATER items: **5**. M01 can be accepted.
