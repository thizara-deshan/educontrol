# Eduscope Central

Control surface for one classroom (R-101): a Raspberry Pi serves a responsive React UI to every
browser on the room LAN at `http://r-101.local` and drives the room hardware.
**Read first:** `docs/SPEC.md` (what) · `docs/ARCHITECTURE.md` (how) · the plan you were given.
SPEC wins over everything except a decision record in `docs/decisions/`.

## Commands

| | Root (all packages) | One package |
|---|---|---|
| Install | `pnpm install` · `uv sync --directory services/hw` | — |
| Dev | `pnpm dev` (hw fake + core-api :3000 + kiosk :5173) | `pnpm --filter @eduscope/kiosk dev` (`VITE_API_MODE=mock`) · `pnpm --filter @eduscope/core-api dev` · `uv run --directory services/hw uvicorn app.main:app --reload --port 8081` |
| **Verify** | **`pnpm verify`** (typecheck + lint + vitest + ruff + pytest) | — |
| Test | `pnpm -r test` · `pnpm hw:test` | `pnpm --filter <pkg> test` · `uv run --directory services/hw pytest -m "not hardware"` |
| Typecheck | `pnpm -r typecheck` | `pnpm --filter <pkg> typecheck` |
| Lint | `pnpm lint` · `pnpm hw:lint` | `uv run --directory services/hw ruff check . && ruff format --check .` |
| Build | `pnpm build` (contracts → kiosk → core-api) | `pnpm --filter <pkg> build` |
| DB migration | — | `pnpm --filter @eduscope/core-api db:generate` (after editing `db/schema.ts`) |
| hw contract | — | `pnpm --filter @eduscope/contracts export-hw-schema` |

Packages: `@eduscope/contracts`, `@eduscope/kiosk`, `@eduscope/core-api`. Real-hardware tests
run only on the Pi: `uv run --directory services/hw pytest -m hardware`.

## Repo layout — where new code goes

| Kind of code | Location |
|---|---|
| Any schema crossing a boundary (REST, WS, hw) | `packages/contracts/src/` (zod) — **first**, before using it |
| Golden examples for the hw contract | `packages/contracts/fixtures/hw/` |
| shadcn primitive | `apps/kiosk/src/ui/` (via shadcn CLI) |
| Shared visual piece used by ≥2 features | `apps/kiosk/src/components/` |
| A screen / its cards / its hooks | `apps/kiosk/src/features/<screen>/` (control, devices, settings, pin, session, kiosk) |
| API access, WS, query keys, pending commands | `apps/kiosk/src/data/` |
| Design tokens (colours, radii, fonts, breakpoints) | `apps/kiosk/src/styles/tokens.css` only |
| HTTP route | `apps/core-api/src/routes/` (thin) |
| Domain rule (R1–R13, status, attribution) | `apps/core-api/src/domain/` as a pure function |
| Talking to hw-service | `apps/core-api/src/hw/` |
| DB tables | `apps/core-api/src/db/schema.ts` + generated migration in `apps/core-api/drizzle/` |
| Hardware capability | `services/hw/app/modules/<capability>/{router,service,schemas,driver_real,driver_fake}.py` |
| systemd, kiosk launcher, install | `deploy/pi/` |

`reference/` is read-only source material. Never edit it, never import from it.

## TypeScript / frontend rules

- TS `strict` (+ `noUncheckedIndexedAccess`). No `any`, no `as` casts to silence errors, no
  `@ts-ignore`. Use `unknown` + zod parsing.
- **zod at every boundary:** request bodies, responses, WS frames, hw events, env. Types come from
  `z.infer` of `@eduscope/contracts`; never redefine a contract type by hand.
- **Design tokens only.** No hex/rgb literals or arbitrary colour values (`bg-[#…]`) outside
  `tokens.css`. State colours come from `components/state-styles.ts`.
- shadcn primitives live in `ui/`; features use `components/` and `ui/`, never another feature.
- Touch first: every interactive target ≥ 48×48px; pressed state on touch-down; **no hover-only
  affordances**.
- Responsive with Tailwind breakpoints in one component tree: base = phone, `sm:` ≥600,
  `lg:` ≥1024. Every screen must work at **390px** and at **1280×800** (S1 with no scrolling).
  No horizontal page scroll.
- The UI shows server state only. A tap adds a pending overlay; values change only on a server push.
  Never optimistically write values into the query cache.
- **Never rely on client-side role checks for security.** The client hides/locks controls for UX;
  core-api enforces every permission. Every new mutating route declares `config.access`.
- Query keys only via `data/query-keys.ts`. Components never call `fetch` or open sockets.
- Code must work with both `VITE_API_MODE=mock` and `http`.

## Python rules (services/hw)

- Follow the module pattern exactly; register new modules in `app/registry.py`.
- Drivers implement the `Protocol` in `service.py`; services and routers never touch hardware
  directly. Every real driver has a fake that runs on Arch.
- **Never import from `reference/`** (including `reference/hardware-drops/`). Intake rewrites code
  into modules and cites the source `file:line` in a comment.
- No hardcoded secrets, PINs, topics, ports or friendly names — use `app/config.py`
  (pydantic-settings, env prefix `HW_`).
- Type hints on every function (ruff `ANN` enforced); pydantic v2 models with `extra="forbid"`.
- `ruff check` and `ruff format` clean. Bind to 127.0.0.1 only.
- A hw contract change updates zod (`packages/contracts/src/hw/`), pydantic `schemas.py` and the
  fixtures in **the same commit**.
- Mark any unconfirmed hardware behaviour `[ASSUMED]` in code comments and docs.

## Workflow rules

- **Execute the plan exactly.** Do the listed steps in the listed files. No extra scope, no
  "while I'm here" refactors.
- After each task: run its Verify command and `pnpm verify`; when green, tick the task checkbox
  in the plan and make **one commit per task** with the plan's conventional-commit message
  (`feat(kiosk): …`, `fix(core-api): …`, `test(hw): …`, `chore: …`, `docs: …`), including the
  plan file change.
- If the plan is ambiguous, contradicts the code or SPEC, or needs a decision it doesn't make:
  **STOP.** Write it under `## Blockers` in the plan (task, problem, options), commit, and stop.
  Never improvise.
- Same failure after 2 fix attempts: stop and report; don't loop.
- Never edit `docs/SPEC.md`, `docs/ARCHITECTURE.md`, milestones or other plans while executing.
  Changing a decision requires a record in `docs/decisions/`.
- Never commit secrets, `.env` files or the SQLite database. Never edit generated migrations.

## Definition of done (per task)

1. The task's Verify command passes.
2. `pnpm verify` is green (typecheck, lint, all Vitest, ruff, pytest).
3. New logic has tests (contracts, data layer, state logic, auth guards, domain rules, hw modules
   with fake drivers). No snapshot tests, no tests of pure markup.
4. Checkbox ticked, one commit made.
