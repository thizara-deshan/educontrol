# M01 — Foundation
Depends on: —            Machine: Arch        Est: ½ day

## Goal
Create the pnpm workspace with the kiosk app, the contracts package and the tooling every later
milestone relies on. At the end, `pnpm verify` is green, the kiosk dev server shows a token
swatch page in the dark theme, and every contract schema from ARCHITECTURE §3 exists with
fixtures and tests.

## Scope
- Root: `package.json` scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `verify`,
  `hw:check` as a no-op placeholder that M07 fills), `pnpm-workspace.yaml`,
  `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
  `eslint.config.js` (typescript-eslint strict, `no-explicit-any: error`), `.gitignore`,
  `.editorconfig`, Node 22 pin (`.nvmrc` + `engines`).
- `packages/contracts` (ARCHITECTURE §3.2, §3.3, §3.4): `common.ts`, all `domain/*`, `state.ts`,
  `api/*`, `ws.ts`, `hw/*`, `index.ts`; `fixtures/state/room-normal.json`,
  `fixtures/hw/*.json` (one per hw request/response/event type);
  `scripts/export-hw-schema.ts` + committed `generated/hw.schema.json`; Vitest tests.
- `apps/kiosk`: Vite + React + TS, Tailwind v4, `styles/tokens.css` exactly as ARCHITECTURE §4.2
  (SPEC §3.1–3.3 values, breakpoints `sm` 600 / `lg` 1024, `md`/`xl`/`2xl` removed),
  self-hosted fonts (`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`),
  shadcn initialised with `ui/` as the components path and its variables mapped onto tokens,
  `.env.development` with `VITE_API_MODE=mock`, Vitest config, folder skeleton from
  ARCHITECTURE §1 (empty `index.ts` where needed).
- A temporary `/` page `TokenSwatches` showing every colour token, the type scale and radii.
- `CLAUDE.md` commands verified to exist (create stubs for scripts that later milestones fill).

## Out of scope
core-api and hw-service code (empty folders only), any real screen, ApiClient, routing.

## Acceptance criteria
1. `pnpm install && pnpm verify` exits 0 on a fresh clone.
2. `pnpm --filter @eduscope/kiosk dev` → `http://localhost:5173` shows the swatch page on `bg`
   `#0E1621`, every SPEC §3.1 token labelled with its name, sans and mono samples visibly
   different fonts, with no network font requests (DevTools Network tab).
3. `grep -rEn "#[0-9A-Fa-f]{3,8}\b" apps/kiosk/src --include=*.tsx --include=*.ts` returns
   nothing (hex only in `tokens.css`).
4. `pnpm --filter @eduscope/contracts test` shows: `room-normal.json` parses as `RoomState`;
   every file in `fixtures/hw/` parses with its schema; `observed()` rejects a missing
   `confidence`; `SensorReading` rejects `{kind:"occupancy", value:"open"}`.
5. `pnpm --filter @eduscope/contracts export-hw-schema` regenerates `generated/hw.schema.json`
   with no git diff.
6. Adding `const x: any = 1` to any TS file makes `pnpm verify` fail (then remove it).
7. Resizing the browser to 390px wide shows no horizontal scrollbar on the swatch page.

## Notes for the planner
- Use zod v4 (`z.iso.datetime`, `z.uuid`, `z.toJSONSchema`). Wire format is snake_case.
- `observed()` is a generic factory; also export a hand-written `Observed<T>` type (ARCHITECTURE
  §3.2) so components can be generic without zod type gymnastics.
- Fixture file names map 1:1 to schema names (`hw/event.lights.state.json` →
  `HwEvent` with `type: "lights.state"`); M07's pytest relies on this naming, so write the rule
  in `fixtures/README.md`.
- `room-normal.json` must reproduce the screenshot values (SPEC S1/S2: `287 W`, `62`, `38`,
  `26.4°`, `61%`, Detected, Closed, LQI 214/231, 5 paired…). M02's mock seeds from it.
- shadcn with Tailwind v4: run the CLI, then rewrite its generated CSS variables to reference our
  tokens (no new colours). Keep `ui/` free of app logic.
- Tailwind v4 removes a breakpoint with `--breakpoint-md: initial;` inside `@theme`.
- Do not add react-router, TanStack Query or other runtime libraries yet beyond what M01 needs;
  M02 adds them.
