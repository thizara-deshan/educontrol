# Eduscope Central — Build Workflow

A one-week, document-driven workflow for building the Eduscope Central kiosk
(Raspberry Pi) with Claude Code. Adapted from `refrenced-guide/`, but cut down for
our situation:

| Reference guide assumes | Our reality | So we… |
|---|---|---|
| Only a raw idea | **Prototype screens already exist** | Skip discovery/PRD. The screens *are* the spec, and we extract it. |
| Weeks of build time | **One week** | Use 8 prompts, light docs, and testing where logic lives. |
| Code written from scratch | **Hardware code arrives later as messy Python/bash** | Add a dedicated **Hardware Intake** step that pulls the useful parts into FastAPI modules. |
| A single dev machine | **Arch for UI, Pi for hardware** | Use fake drivers on Arch and real drivers on the Pi, chosen by one env flag. |
| One model | **Opus 5.5 + Sonnet 5.5** | Opus does the thinking and writes plans. Sonnet follows them. |
| A single client | **Any browser on the LAN** (phone, laptop, lecturer PC), plus an optional kiosk screen | The Pi serves the UI at `http://<pi>.local`. The UI is responsive, all clients stay in sync, and control needs a PIN. |

> **Mental model:** Opus = architect, Sonnet = builder, you = the gate.
> Opus writes plans that are specific enough for Sonnet to follow without guessing.
> You review each plan before Sonnet starts on it.

---

## 1. The pipeline

```
 SETUP (once, Day 1)                       BUILD LOOP (per milestone)
 ───────────────────                       ──────────────────────────
 01 Screens → SPEC.md          [Opus]      04 Plan milestone      [Opus]   → docs/plans/PLAN-Mxx.md
 02 Architecture + CLAUDE.md   [Opus]      05 Execute plan        [Sonnet] → code + commits
 03 Milestones index           [Opus]      06 Review & verify     [Opus]   → fix tasks → back to 05
                                                     ▲
 HARDWARE LOOP (per drop from HW engineer)           │
 ──────────────────────────────────────              │
 07 Hardware intake            [Opus]  → INTAKE doc + new H-milestone ──┘

 ANY TIME: 08 Change record    [Opus]  → when reality changes a decision
```

| # | Prompt | Model | Output |
|---|---|---|---|
| 01 | [Screens → Spec](prompts/01-screens-to-spec.md) | Opus | `docs/SPEC.md` |
| 02 | [Architecture](prompts/02-architecture.md) | Opus | `docs/ARCHITECTURE.md`, `CLAUDE.md` |
| 03 | [Milestones](prompts/03-milestones.md) | Opus | `docs/milestones/M00-index.md` + `Mxx-*.md` |
| 04 | [Plan a milestone](prompts/04-plan-milestone.md) | Opus | `docs/plans/PLAN-Mxx.md` |
| 05 | [Execute a plan](prompts/05-execute-plan.md) | **Sonnet** | Code, ticked tasks, commits |
| 06 | [Review & verify](prompts/06-review-milestone.md) | Opus | `docs/reviews/REVIEW-Mxx.md` + fix tasks |
| 07 | [Hardware intake](prompts/07-hardware-intake.md) | Opus | `docs/hardware/INTAKE-NN.md` + `Hxx` milestone |
| 08 | [Change record](prompts/08-change-record.md) | Opus | `docs/decisions/NNN-*.md` |

---

## 2. Model routing

| Work | Model | Why |
|---|---|---|
| Specs, architecture, milestone split, plans, reviews, hardware intake, decisions | **Opus 5.5** | Needs judgment and cross-file reasoning. Mistakes here multiply downstream. |
| Executing a written plan task by task, applying review fix-lists | **Sonnet 5.5** | The thinking is already in the plan, so this is fast and cheap. |
| A bug Sonnet fails to fix in 2 attempts | **Opus 5.5** | Escalate instead of letting it loop. |
| Optional: renames, formatting, small doc edits | Haiku 5.5 | Only if you want to save quota. |

How to switch:
```bash
claude --model opus      # planning session
claude --model sonnet    # execution session
# or inside a session:  /model opus   |   /model sonnet
```

**Optional (faster): Opus drives Sonnet subagents.** In an Opus session, after
the plan is approved, say *"Execute PLAN-M03 using a sonnet subagent per task; review
each result against the plan before moving on."* This costs more Opus quota but
needs less babysitting. Use it for big UI milestones if your quota allows.

---

## 3. Artifact map

```
edcontrol/
├── CLAUDE.md                     ← 02: rules auto-loaded by every Claude Code session
├── reference/
│   ├── screens/                  ← prototype PNGs (source of truth for UI)
│   ├── prototype/                ← (optional) prototype HTML/source if you can export it
│   └── hardware-drops/           ← raw files from the HW engineer, never edited
│       └── 2026-10-14-ir-blaster/
├── docs/
│   ├── SPEC.md                   ← 01
│   ├── ARCHITECTURE.md           ← 02
│   ├── milestones/               ← 03 (+ 07 adds Hxx files)
│   ├── plans/                    ← 04 (+ fix tasks from 06)
│   ├── reviews/                  ← 06
│   ├── hardware/                 ← 07 intake reports
│   └── decisions/                ← 08
├── apps/
│   ├── kiosk/                    ← React + Vite + TS + Tailwind + shadcn
│   └── core-api/                 ← Fastify + better-sqlite3 + Drizzle
├── packages/
│   └── contracts/                ← zod schemas shared by kiosk and core-api
├── services/
│   └── hw/                       ← FastAPI (uv): drivers, sensors, IR, zigbee
└── deploy/
    └── pi/                       ← systemd units, kiosk launcher, install script
```

---

## 4. One-week schedule

| Day | Where | Work | Gate at end of day |
|---|---|---|---|
| **1 (Mon)** | Arch | 01 → 02 → 03, then plan and execute **M01 Foundation** | Repo builds, tokens match the screens, mock data shows up |
| **2 (Tue)** | Arch | M02 App shell + shared components + data layer, then **M03 Control page** | Control page matches screenshot 01 with mock data |
| **3 (Wed)** | Arch | **M04 Devices**, **M05 Settings** | ✅ **Frontend complete.** Click through it at the Pi's resolution in `chromium --kiosk` |
| **4 (Thu)** | Arch → Pi | **M06 core-api** (kiosk switches from mock to HTTP, PIN auth), **M07 hw-service skeleton** (fake drivers), **M08 Pi deploy** | A phone on the same Wi-Fi opens `http://eduscope-r101.local`, enters the PIN, and stays in sync with the Pi screen |
| **5 (Fri)** | Pi | 07 Hardware intake → H01, H02… (plan → execute → review on real hardware) | Each device works from the touchscreen |
| **6 (Sat)** | Pi | More hardware drops and end-to-end testing | All controls on screen 01 drive real hardware |
| **7 (Sun)** | Pi | **M-final Hardening**: restarts, hardware offline, watchdog, logs. Buffer time | Pull the power, plug it back in, and it recovers by itself |

M06–M08 don't depend on the hardware files, so the engineer can send them any time
from Day 3. If files arrive early, run 07 in parallel because it only writes docs.

---

## 5. The daily loop (per milestone)

```bash
git tag m03-start                       # 1. mark the starting point (06 diffs against it)
claude --model opus     → prompt 04     # 2. plan            🛑 read the plan
claude --model sonnet   → prompt 05     # 3. execute         (repeat until all tasks ticked)
claude --model opus     → prompt 06     # 4. review          🛑 read the review
claude --model sonnet   → prompt 05     # 5. apply fix tasks (if any)
git tag m03-done
```

Start a new session (`/clear`) for each step. Agents should work from the files
on disk, not from chat history.

---

## 6. Golden rules (short version)

1. **Screens are the UI source of truth** for the wide layout. Every screen must also work at phone width (390px). If code and a screenshot disagree, the screenshot wins, unless a decision record says otherwise.
2. **Contracts first.** Every value crossing a boundary (kiosk ↔ core-api ↔ hw) has a zod schema in `packages/contracts` and a matching pydantic model in `services/hw`.
3. **Never skip a gate.** Read every plan before Sonnet runs it, and read every review before you call a milestone done.
4. **Sonnet doesn't improvise.** If a plan is ambiguous, Sonnet stops and writes a blocker. Opus fixes the plan.
5. **Test where logic lives.** Use Vitest for contracts, the data layer, and state mapping. Use pytest for hw modules with fake drivers. Skip snapshot tests and tests of plain markup.
6. **Hardware drops stay raw.** Never import from `reference/hardware-drops/`. Intake extracts and rewrites the code, citing `file:line`.
7. **Commit after every task.** Tag the start and end of each milestone.
8. **Changing a decision means writing a record (08).** Don't silently edit the architecture.

---

## 7. Stack decisions (my recommendations on top of your plan)

| Area | Choice | Why |
|---|---|---|
| Repo | **pnpm workspaces monorepo** | Kiosk and core-api share `packages/contracts` (zod) with no publishing step |
| Kiosk build | **Vite** (not Next) | Builds a static SPA that core-api serves. Same origin, so no CORS, and nothing else runs on the Pi |
| Server state | **TanStack Query** + one WebSocket that pushes updates into the query cache | Handles optimistic commands and "confirmed vs assumed" state cleanly |
| Kiosk data layer | An `ApiClient` interface with a **mock adapter** (Days 1–3) and an **http adapter** (Day 4+) | The frontend is built once and switching is one env var. The mock simulates latency and state changes |
| Device state model | Each controllable thing carries `state` + `confidence: confirmed \| assumed \| unknown` + `source` | The screens show this everywhere ("confirmed by draw", "assumed", "confirmed by the switch") |
| core-api ↔ hw | Commands: HTTP `POST` core → hw. State: hw → core over **one WebSocket/SSE stream** | Core-api is the only client of hw. Hw is bound to `127.0.0.1` |
| hw-service layout | `app/modules/<capability>/{router,service,driver_real,driver_fake,schemas}.py`, with `HW_MODE=fake\|real` | Runs fully on Arch with fakes. Intake only adds or changes modules |
| Python tooling | **uv**, ruff, pytest, pydantic v2 | Fast installs on the Pi and one lockfile |
| ORM | **Drizzle** + better-sqlite3 (WAL mode) | better-sqlite3 compiles natively on the Pi, so install `build-essential python3` first |
| LAN access | core-api listens on **`0.0.0.0:80`** (systemd `AmbientCapabilities=CAP_NET_BIND_SERVICE`). hw-service stays on `127.0.0.1` | Anyone on the network opens `http://eduscope-r101.local` (avahi/mDNS, on by default in Pi OS) or the IP. Use a DHCP reservation so the IP doesn't change |
| Access control | **Room PIN** to control from a remote browser, a separate **technician PIN** for Settings, **enforced in core-api** (signed httpOnly cookie). The kiosk on `localhost` can skip the room PIN | Otherwise anyone on the same Wi-Fi, students included, can switch off the projector mid-lecture |
| Multi-client | Every state change is broadcast over the WebSocket to **all** clients. Commands are last-write-wins, and the UI shows the result, not what the user tapped | Phone and kiosk always show the same truth. Clients reconnect and resync after sleep |
| Layout | Responsive: kiosk/desktop layout as in the screens, and a **stacked single column under ~768px** | The screens are landscape-only, but phones are now first-class clients |
| Pi display (optional) | Raspberry Pi OS Bookworm (Wayland/labwc) + `chromium --kiosk http://localhost`, systemd for core-api + hw | If the Pi has a screen, it boots into the UI. If it's headless, skip it, and LAN access still works |

The screens suggest the hardware is a Zigbee coordinator (ZG-808Z),
SONOFF ZBM5/S60/SNZB sensors, and a ZS06 IR blaster, which is likely
zigbee2mqtt + MQTT. **Don't lock this in until the first hardware drop confirms it.**
Prompt 02 treats it as an assumption, and prompt 07 confirms or corrects it.

---

## 8. Moving from Arch to the Pi (Day 4)

- Push the repo to a private git remote. Clone it on the Pi.
- Run Claude Code **on the Pi over SSH** for hardware milestones, because the agent
  must be able to run the real drivers and tests. A Pi 4/5 with 4GB+ RAM is enough.
- Keep UI-only fixes on Arch if you like. Both machines push and pull the same repo.
- `HW_MODE=fake` on Arch, `HW_MODE=real` on the Pi. CI isn't needed this week.
- **Test LAN access early, from Day 1.** Run `pnpm dev --host` on Arch and open
  `http://<arch-ip>:5173` on your phone. On the Pi, set the hostname
  (`sudo hostnamectl set-hostname eduscope-r101`), ask IT for a DHCP reservation,
  and check that the campus network doesn't isolate clients from each other
  (common on guest Wi-Fi). If it does, find out early.
- Plain HTTP on the LAN is fine this week. HTTPS on a LAN needs certificate
  handling, so record it as a decision (08) if IT requires it.

---

## 9. Before you start (15 min)

```bash
cd ~/edcontrol && git init && git add -A && git commit -m "chore: reference material"
mkdir -p docs/{milestones,plans,reviews,hardware,decisions} reference/hardware-drops
```
- Know your **Pi model, whether it has a display (resolution, orientation, touch)
  or is headless, and which devices will open the UI over the LAN**. Prompt 01
  asks for these.
- If the prototype is an HTML page or artifact, save its source into
  `reference/prototype/`. Exact colors and spacing beat estimates from PNGs.
- Install Node 22 LTS, pnpm, Python 3.11+, and uv on Arch.
