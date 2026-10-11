# Prompt 02 — Architecture + CLAUDE.md

> **Setup** · run once · **Model:** Opus 5.5 · new session
> **Inputs:** `docs/SPEC.md`, `guide/README.md` (section 7, stack decisions)
> **Output:** `docs/ARCHITECTURE.md`, `CLAUDE.md`

## When to use
Right after SPEC is approved. This prompt fixes the structure that every plan builds
on: repo layout, contracts, data flow, and the hardware-service pattern that
later hardware intakes plug into. It also writes `CLAUDE.md`, which every Claude Code
session loads automatically. That file is what keeps Sonnet consistent.

## The prompt
````text
You are a senior software architect designing a small, robust embedded-kiosk
system that must be built in one week by one developer using AI agents.

### Inputs
- `docs/SPEC.md` (the product spec)
- `guide/README.md` section 7 (proposed stack decisions)

Fixed stack (don't change it; you may add small libraries with justification):
- kiosk: pnpm, TypeScript, React, Vite, Tailwind, shadcn/ui, Vitest, zod,
  TanStack Query
- core-api: Fastify, better-sqlite3, Drizzle, zod
- hw-service: Python, FastAPI, pydantic v2, uv, pytest
- Runtime: Raspberry Pi (Bookworm), Chromium kiosk mode, systemd

### Design these, in order
1. **Repo layout.** pnpm workspace: apps/kiosk, apps/core-api,
   packages/contracts, services/hw, deploy/pi. Show the folder tree down to the
   level a planner needs (feature folders, not every file).
2. **Runtime topology.** Processes, ports, who talks to whom, what starts on
   boot. Core-api serves the built SPA AND the API/WS on one origin,
   listening on 0.0.0.0:80 so any LAN browser can reach it at
   `http://<hostname>.local`. hw-service binds 127.0.0.1 only and is never
   reachable from the LAN. The Pi's own Chromium kiosk (optional) is just
   another client on http://localhost.
3. **Contracts.** The zod schemas in packages/contracts for every entity
   and every API request/response/event in SPEC. Include the
   `confidence: confirmed | assumed | unknown` model. Show the actual schema
   code for the core entities. Then define the core-api ↔ hw-service contract
   (HTTP commands + one event stream) and the rule for keeping the pydantic
   models in sync with it.
4. **Frontend architecture.** Responsive layout strategy (the wide layout
   from the screens, stacked below ~768px, via Tailwind breakpoints rather
   than separate components). PIN screen + session handling. WS reconnect
   with backoff and resync on `visibilitychange`. Connection-status
   indicator. Routing, `ApiClient` interface with `mock` and `http` adapters
   (selected by `VITE_API_MODE`), query keys, WebSocket → query-cache
   updates, optimistic command flow (pending → confirmed/assumed/failed),
   component layering (ui/ = shadcn primitives, components/ = our shared
   pieces, features/<screen>/), and how the design tokens map to Tailwind
   theme + CSS variables.
5. **Access control.** Room PIN and technician PIN (hashed in settings),
   a login endpoint issuing a signed httpOnly session cookie with a role
   (`viewer` | `controller` | `technician`), and a Fastify preHandler
   enforcing roles on every mutating route and on WS commands. Localhost
   exemption for the Pi screen if SPEC says so. Throttle PIN attempts. Keep
   it small: no user accounts, no OAuth, plain HTTP on the LAN.
6. **core-api architecture.** Plugin/route layout, Drizzle schema (tables
   from SPEC's domain model + event log + settings), migrations, the hw
   client, the state cache, WebSocket fan-out to ALL connected clients
   (the server is the source of truth for state; concurrent commands are
   last-write-wins), a full-state snapshot on (re)connect, and behavior when
   hw-service is down.
7. **hw-service architecture.** Module pattern:
   `app/modules/<capability>/{router.py, service.py, schemas.py,
   driver_real.py, driver_fake.py}`, plus a registry that picks the driver by
   `HW_MODE=fake|real`, config via env/pydantic-settings, and the event bus
   that feeds the event stream. List the capability modules SPEC implies
   (e.g. lights, projector_power, ir, sensors, screen, zigbee_status) as
   PLACEHOLDERS. Their real drivers will come from hardware intake. State the
   hardware assumptions (e.g. zigbee2mqtt over MQTT) and mark them `[ASSUMED]`.
8. **Testing policy.** What gets tested and how (Vitest for contracts, data
   layer, state logic, auth guards; pytest with fake drivers). Also what
   doesn't get tested (pure markup, snapshots). The single command that must
   be green after every task.
9. **Pi deployment.** systemd units (core-api with CAP_NET_BIND_SERVICE for
   port 80), hostname + mDNS (avahi), optional Chromium kiosk, screen
   blanking, crash recovery, log locations. One paragraph each. Detail comes
   in the deploy milestone.
10. **Decisions log.** A short table of key decisions + alternatives rejected.

### Then write `CLAUDE.md` (max ~120 lines), the rules every agent follows:
- Project one-liner + pointer to SPEC/ARCHITECTURE
- Commands (install, dev, test, typecheck, lint, build) per package and root
- Repo layout summary and where new code of each kind goes
- Coding rules: TS strict, no `any`, zod at every boundary, design tokens
  only (no raw hex in components), shadcn primitives in ui/, touch targets
  ≥ 48px, no hover-only affordances, every screen works at 390px and at the
  kiosk size, never rely on client-side role checks (core-api enforces them)
- Python rules: modules pattern, never import from reference/, drivers behind
  interface, no hardcoded secrets/pins (config), type hints, ruff
- Workflow rules: execute plans exactly; tick task checkboxes; one commit
  per task with conventional commit message; if the plan is ambiguous or
  wrong, STOP and write under "## Blockers" in the plan — never improvise
- Definition of done for a task: verify command passes + typecheck + tests green

### Rules
- Prefer the simplest thing that works on a Pi. No message brokers, Docker,
  auth servers, or microservices beyond the two processes plus hw-service.
- Every SPEC entity and interaction must have a home in the architecture.
- Mark assumptions about hardware `[ASSUMED]`. Never present them as fact.
- Treat the LAN as shared and untrusted: nothing mutates without a session.

### Gate
First present: repo tree, topology diagram (ASCII), contract entity list,
access-control summary, hw module list, and the decisions table. STOP for approval. Then write both files.
````

## Gate checklist
- [ ] Every SPEC interaction maps to a contract + a route + a hw module
- [ ] Mock/http adapter switch is clearly defined
- [ ] Only core-api is exposed on the LAN, and every mutating route checks a role
- [ ] `CLAUDE.md` commands are concrete (they become every plan's verify step)
- [ ] Commit: `git commit -am "docs: ARCHITECTURE + CLAUDE.md"`
