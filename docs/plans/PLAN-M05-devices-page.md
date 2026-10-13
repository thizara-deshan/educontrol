# PLAN-M05 — Devices page (S2)
Milestone: `docs/milestones/M05-devices-page.md` · Start tag: `m05-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M05; SPEC §2.2 (S2 phone), §2.3 (S2 read-only), §3.1–3.4, S2.E1–E23, H1, H8–H11, H15, H16,
§6 (ZigbeeNode, Coordinator, Mesh, Interlock, PowerReading), R7, R11, R13; ARCHITECTURE §1, §3.2–3.3, §4.1–4.5, §4.8, §8;
CLAUDE.md; PLAN-M04 (format) + REVIEW-M04, D-20 and the M00 backlog; `reference/screens/02-devices-zigbee.png.png`
(looked at directly; there is no `reference/prototype/`); the current code (`apps/kiosk`, `packages/contracts`).
**No contract changes are needed:** `RoomState.zigbee` already has `coordinator` (with `status` online / offline /
starting), `mesh` (with `joining.until`) and `nodes[]` (role, power source, LQI, battery, `last_seen`, `online`);
`interlock`, `display.projector.{power,mains}` and `environment.{lights,sensors}` carry the rest. S2 has no commands.

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. Kiosk code imports with the `@/` alias and
  **no** file extension. `verbatimModuleSyntax`, `exactOptionalPropertyTypes`, `noUnusedLocals` and
  `noUncheckedIndexedAccess` are on.
- **Every code block in this plan was compiled, linted and tested**, and the plan was **replayed task by task by a
  script that applies the blocks exactly as written** in a fresh worktree from `main` (f81c5b2) with typecheck + lint
  + all Vitest green after every task. The finished page was driven in headless Chromium at 1280×800, 800×1000 and
  390×844 (the numbers in T33 come from those runs). Apply code blocks **verbatim**:
  - "Create `X`" / "Replace the whole file `X`" = the block is the full file content (end it with one newline);
  - "In `X` replace: … with: …" = an exact, unique text replacement (the old text occurs once);
  - "Append to `X`" = add one empty line, then the block, at the end of the file.
- Tests run in Vitest's `node` environment (no DOM). Only pure logic is tested (`*.view.ts` selectors, mock rules,
  FakeRoom, the ticker, state-styles). Components are checked by eye (CLAUDE.md: no tests of pure markup).
- No `as` casts other than `as const`. No hex/rgb literals outside `tokens.css`. Tailwind class strings stay literal.
  Arbitrary values in this plan (`lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]`) are sizes, not colours.
- S2 is **read-only** (Q11, §2.3): no `useCommand`, no padlocks, no pending/failed states on this page. The only
  interactive elements are the header's back link and Settings.
- **Decisions this plan makes** (do not re-open them):
  - **D1 — no contract change.** See the inputs paragraph.
  - **D2 — header variant.** `app/Header.tsx` renders S2 content when `useMatch("/devices")` matches: back link
    "← Controls", title, `CoordinatorStatus`, the existing `SettingsButton`. Only `CoordinatorStatus` lives in
    `features/devices/header/` (features may not import `app/`, and `SettingsButton` / `HEADER_BUTTON_CLASS` live
    there). No room chip, clock or Lock on S2 (SPEC lists S2.E1–E4 only).
  - **D3 — router identity.** The two router cards are bound to registry devices `lights` and `projector_socket`.
    A device's node is the one with `node.friendly_name === device.hw_ref`. Online = `node.online`; no node = offline.
  - **D4 — battery rows** = nodes with `power_source === "battery"` in the coordinator's order. Name from the
    registry; reading = all `environment.sensors` readings of that node joined with ` · `; stale = any reading stale.
  - **D5 — phone row line 3** reads "Battery 98% · Link 168 · 12s ago" (labels text-3, values toned).
  - **D6 — offline battery row (H8):** reading text-3, link "—", last seen red "Offline · 5 min ago".
  - **D7 — third callout variant `[INFERRED]`:** no router online → red "NO ROUTERS ONLINE" / "Battery sensors can't
    reach the coordinator. Restore the lighting switch or the projector socket." SPEC defines only green and amber.
  - **D8 — interlock copy:** Armed (green) + `rule_text`; Holding (amber) + "Waiting for projector to cool · {W}";
    Bypassed (amber) + "Projector mains can be switched off at any draw." `[INFERRED]` (Q7).
  - **D9 — one shared ticker.** `useServerNow()` keeps its signature but all callers (header clock, S1 sensors, S2
    cards) share one 1 s interval that stops when nothing listens.
  - **D10 — the sensor reading formatter moves** from `features/control/…/sensors.view.ts` to
    `components/sensor-reading.ts` (features can't import each other).
  - **D11 — mock:** node `last_seen` times are rebased to "now" at start; panel "… offline" takes the matching Zigbee
    nodes offline with `last_seen` 5 min ago; mock room status order is fault > device offline > "Sensor not
    reporting" > "Sensor battery low" (≤20%) > normal.
  - **D12 — gang tiles** stack below 600 (`grid-cols-1 sm:grid-cols-2`): two tiles don't fit 2×157px at 390.
  - **D13 — grid tracks** `minmax(0,3fr) minmax(0,1fr)` (same 3:1 as ARCHITECTURE §4.1, but long text can't shift it).
  - **D14 — `MetricTile` gains an optional `staleAgo`** (H10 for S2.E12). Extension, not a fork.
  - **D15 — S2 may scroll at 1280×800** (~854px tall). SPEC's no-scroll rule is for S1 only; screenshot 02 is cropped.
  - **D16 — gang tiles are not controls:** `div`, no pressed state, `min-h-12`.
- After each task: run the task's **Verify**, then `pnpm verify`; when both are green tick the task's checkbox in
  this file and commit **with this plan file included**: `git add -A && git commit -m "<message from the task>"`.

## File map

All paths under `apps/kiosk/src/`.

| File | Create/Modify | Responsibility |
|---|---|---|
| `lib/server-time.ts` (+ `.test.ts`) | Modify | shared 1 s ticker behind `useServerNow()` (D9) |
| `components/sensor-reading.ts` | Create | reading → text + tone, shared by S1 tiles and S2 rows (D10) |
| `features/control/environment/sensors.view.ts` | Modify | use the moved formatter |
| `components/state-styles.ts` (+ `.test.ts`) | Modify | callout box/title classes (S2.E22, D7) |
| `components/MetricTile.tsx` | Modify | optional `staleAgo` (D14) |
| `data/adapters/mock/mock-rules.ts` | Modify | H16 room status; node rebase + online helpers (D11) |
| `data/adapters/mock/mock-nodes.test.ts` | Create | tests for the above |
| `data/adapters/mock/fake-room.ts` | Modify | nodes follow offline/stale; S2 panel methods |
| `data/adapters/mock/fake-room-devices.test.ts` | Create | FakeRoom S2 tests |
| `app/dev/MockPanel.tsx` | Modify | S2 panel buttons |
| `features/devices/header/coordinator-status.view.ts` (+ `.test.ts`) | Create | S2.E3 selector |
| `features/devices/header/CoordinatorStatus.tsx` | Create | S2.E3 header item |
| `app/Header.tsx` | Modify | `/devices` header variant (D2) |
| `features/devices/DevicesPage.tsx` | Replace | the S2 grid |
| `features/devices/routers/routers.view.ts` (+ `.test.ts`) | Create | router header, gang tile, socket metrics selectors |
| `features/devices/routers/RouterCardHeader.tsx` | Create | dot · title / ids · Router badge · LQI |
| `features/devices/routers/GangTile.tsx` | Create | read-only On/Off tile |
| `features/devices/routers/LightingSwitchCard.tsx` | Create | S2.E6–E9 |
| `features/devices/routers/ProjectorSocketCard.tsx` | Create | S2.E10–E13 |
| `features/devices/battery/battery.view.ts` (+ `.test.ts`) | Create | severity, last seen, rows |
| `features/devices/battery/BatteryList.tsx` | Create | table ≥600, cards <600, loading, empty |
| `features/devices/side/side.view.ts` (+ `.test.ts`) | Create | coordinator, mesh/joining, callout, interlock selectors |
| `features/devices/side/CoordinatorCard.tsx` | Create | S2.E20 |
| `features/devices/side/MeshCard.tsx` | Create | S2.E21 |
| `features/devices/side/RedundancyCallout.tsx` | Create | S2.E22 |
| `features/devices/side/InterlockCard.tsx` | Create | S2.E23 |

## Tasks

### T1 — One shared 1 s ticker for server time
- [x] done

**Files:** `apps/kiosk/src/lib/server-time.ts`, `apps/kiosk/src/lib/server-time.test.ts`

**Context:** Milestone note: relative times ("12s ago") come from **server time** and refresh every second through **one shared ticker, not one interval per row**. Today `useServerNow()` starts its own `setInterval` per caller (header clock, S1 sensors card). This task keeps its signature and makes every caller share one interval that runs only while something is subscribed (decision D9). Header clock and S1 sensors keep working unchanged.

**Do:**
1. Replace the whole file `apps/kiosk/src/lib/server-time.ts`:
```ts
import { useSyncExternalStore } from "react";
import { createStore, useStore, type Store } from "./store";

// S1.E2: the header shows server time. offset = server − client, updated from every applied
// state frame. `null` until the first snapshot (H1: the clock shows a skeleton).
export interface ServerClock {
  offset: Store<number | null>;
  sync(serverTimeIso: string): void;
  now(): Date | null;
}

export function createServerClock(clientNow: () => number = Date.now): ServerClock {
  const offset = createStore<number | null>(null);
  return {
    offset,
    sync(serverTimeIso) {
      offset.set(new Date(serverTimeIso).getTime() - clientNow());
    },
    now() {
      const current = offset.get();
      return current === null ? null : new Date(clientNow() + current);
    },
  };
}

export const serverClock = createServerClock();

/**
 * One shared interval for every clock and "12s ago" on screen (M05: not one interval per row).
 * It runs only while something is subscribed; `get()` is a tick count that changes every period.
 */
export interface Ticker {
  get(): number;
  subscribe(listener: () => void): () => void;
}

export function createTicker(periodMs: number): Ticker {
  let tick = 0;
  let id: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => tick,
    subscribe(listener) {
      listeners.add(listener);
      if (id === null) {
        id = setInterval(() => {
          tick += 1;
          for (const l of listeners) l();
        }, periodMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && id !== null) {
          clearInterval(id);
          id = null;
        }
      };
    },
  };
}

export const secondTicker = createTicker(1000);

/** Server "now", re-rendered every second by the shared ticker; `null` before the first snapshot. */
export function useServerNow(clock: ServerClock = serverClock, ticker: Ticker = secondTicker): Date | null {
  const offset = useStore(clock.offset, (value) => value);
  useSyncExternalStore(ticker.subscribe, ticker.get, ticker.get);
  return offset === null ? null : clock.now();
}
```
2. Replace the whole file `apps/kiosk/src/lib/server-time.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClock, createTicker } from "./server-time";

describe("createServerClock", () => {
  it("is null before the first sync", () => {
    expect(createServerClock(() => 0).now()).toBeNull();
  });

  it("applies the server − client offset", () => {
    let client = Date.parse("2026-10-05T10:00:00Z");
    const clock = createServerClock(() => client);
    clock.sync("2026-10-05T10:42:00Z");
    expect(clock.now()?.toISOString()).toBe("2026-10-05T10:42:00.000Z");
    client += 60_000;
    expect(clock.now()?.toISOString()).toBe("2026-10-05T10:43:00.000Z");
  });

  it("re-syncs on every call", () => {
    const clock = createServerClock(() => Date.parse("2026-10-05T10:00:00Z"));
    clock.sync("2026-10-05T10:42:00Z");
    clock.sync("2026-10-05T09:00:00Z");
    expect(clock.offset.get()).toBe(-3_600_000);
  });
});

describe("createTicker (one shared 1 s interval)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks every period and notifies every subscriber from one interval", () => {
    const ticker = createTicker(1000);
    const a = vi.fn();
    const b = vi.fn();
    ticker.subscribe(a);
    ticker.subscribe(b);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(ticker.get()).toBe(3);
    expect(a).toHaveBeenCalledTimes(3);
    expect(b).toHaveBeenCalledTimes(3);
  });

  it("stops when the last subscriber leaves and restarts on the next one", () => {
    const ticker = createTicker(1000);
    const offA = ticker.subscribe(vi.fn());
    const offB = ticker.subscribe(vi.fn());
    offA();
    expect(vi.getTimerCount()).toBe(1);
    offB();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(ticker.get()).toBe(0);
    ticker.subscribe(vi.fn());
    vi.advanceTimersByTime(1000);
    expect(ticker.get()).toBe(1);
  });
});
```

**Test:** `apps/kiosk/src/lib/server-time.test.ts` (in the block above): one interval for many subscribers; stops at zero subscribers and restarts.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/server-time.test.ts` → 5 passed. `pnpm verify` → exit 0. Dev server: the header clock on `/` still ticks.

**Commit:** `git commit -m "feat(kiosk): shared one-second ticker for server time"`

### T2 — Sensor reading formatter moves to `components/`
- [x] done

**Files:** `apps/kiosk/src/components/sensor-reading.ts`, `apps/kiosk/src/features/control/environment/sensors.view.ts`

**Context:** S2 battery rows (S2.E16–E18) show the same readings as the S1 tiles (`26.4°`, `61%`, "Detected" accent, "Open" warn, "Closed"). The formatter is private to `features/control/environment/sensors.view.ts`, and features never import another feature (ARCHITECTURE §4.8), so it moves to `components/` unchanged (decision D10). Pure move: the existing `sensors.view.test.ts` must still pass without edits.

**Do:**
1. Create `apps/kiosk/src/components/sensor-reading.ts`:
```ts
import type { SensorReading } from "@eduscope/contracts";
import { formatCelsius, formatPercent } from "@/lib/format";
import type { ValueTone } from "./state-styles";

/**
 * One sensor reading as shown on S1 tiles (S1.E42–E45) and S2 battery rows (S2.E16–E18):
 * `26.4°`, `61%`, "Detected" (accent), "Clear", "Open" (warn), "Closed". `value` null = H11.
 */
export function sensorReadingDisplay(reading: SensorReading): { value: string | null; tone: ValueTone } {
  switch (reading.kind) {
    case "temperature":
      return { value: reading.value === null ? null : formatCelsius(reading.value, 1), tone: "default" };
    case "humidity":
      return { value: reading.value === null ? null : formatPercent(reading.value), tone: "default" };
    case "occupancy":
      if (reading.value === null) return { value: null, tone: "default" };
      return reading.value === "detected" ? { value: "Detected", tone: "accent" } : { value: "Clear", tone: "default" };
    case "contact":
      if (reading.value === null) return { value: null, tone: "default" };
      return reading.value === "open" ? { value: "Open", tone: "warn" } : { value: "Closed", tone: "default" };
  }
}
```
2. In `apps/kiosk/src/features/control/environment/sensors.view.ts` replace:
```ts
import type { Device, RoomState, SensorKind, SensorReading } from "@eduscope/contracts";
import type { StateTone, ValueTone } from "@/components/state-styles";
import { formatAgo, formatCelsius, formatPercent } from "@/lib/format";
```
   with:
```ts
import type { Device, RoomState, SensorKind } from "@eduscope/contracts";
import { sensorReadingDisplay } from "@/components/sensor-reading";
import type { StateTone, ValueTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";
```
3. In `apps/kiosk/src/features/control/environment/sensors.view.ts` replace:
```ts
function formatReading(reading: SensorReading): { value: string | null; tone: ValueTone } {
  switch (reading.kind) {
    case "temperature":
      return { value: reading.value === null ? null : formatCelsius(reading.value, 1), tone: "default" };
    case "humidity":
      return { value: reading.value === null ? null : formatPercent(reading.value), tone: "default" };
    case "occupancy":
      if (reading.value === null) return { value: null, tone: "default" };
      return reading.value === "detected" ? { value: "Detected", tone: "accent" } : { value: "Clear", tone: "default" };
    case "contact":
      if (reading.value === null) return { value: null, tone: "default" };
      return reading.value === "open" ? { value: "Open", tone: "warn" } : { value: "Closed", tone: "default" };
  }
}

export function reportingLine
```
   with:
```ts
export function reportingLine
```
4. In `apps/kiosk/src/features/control/environment/sensors.view.ts` replace:
```ts
const { value, tone } = formatReading(reading);
```
   with:
```ts
const { value, tone } = sensorReadingDisplay(reading);
```

**Test:** None new (pure move; covered by `features/control/environment/sensors.view.test.ts`).

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/features/control/environment` → all pass. `pnpm verify` → exit 0.

**Commit:** `git commit -m "refactor(kiosk): share the sensor reading formatter"`

### T3 — Callout state styles (S2.E22)
- [x] done

**Files:** `apps/kiosk/src/components/state-styles.ts`, `apps/kiosk/src/components/state-styles.test.ts`

**Context:** SPEC §3.1 `callout-fill` / `callout-border` / title `accent` for "TWO ROUTERS, NO SINGLE PATH"; S2.E22 amber "ONE ROUTER LEFT"; decision D7 adds a red "NO ROUTERS ONLINE" `[INFERRED]`. State colours live only in `state-styles.ts` (CLAUDE.md). Tokens already exist in `tokens.css` (`callout-fill`, `callout-border`, `warn`, `warn-fill`, `danger`, `danger-fill`).

**Do:**
1. Append to `apps/kiosk/src/components/state-styles.ts`:
```ts
/**
 * S2.E22 mesh redundancy callout (R7): both routers online (green, screenshot 02), one left
 * (amber, SPEC), none online (`[INFERRED]` red, e.g. coordinator offline).
 */
export type CalloutVariant = "redundant" | "one_left" | "none";
export const CALLOUT_BOX_CLASS: Record<CalloutVariant, string> = {
  redundant: "border-callout-border bg-callout-fill",
  one_left: "border-warn bg-warn-fill",
  none: "border-danger/40 bg-danger-fill",
};
export const CALLOUT_TITLE_CLASS: Record<CalloutVariant, string> = {
  redundant: "text-accent",
  one_left: "text-warn",
  none: "text-danger",
};
```
2. In `apps/kiosk/src/components/state-styles.test.ts` replace:
```ts
import {
  ACTIVE_CONTROL_CLASS, CARD_VARIANT_CLASS,
```
   with:
```ts
import {
  ACTIVE_CONTROL_CLASS, CALLOUT_BOX_CLASS, CALLOUT_TITLE_CLASS, CARD_VARIANT_CLASS,
```
3. In `apps/kiosk/src/components/state-styles.test.ts` replace:
```ts
      ...Object.values(VALUE_TONE_CLASS),
    ];
```
   with:
```ts
      ...Object.values(VALUE_TONE_CLASS), ...Object.values(CALLOUT_BOX_CLASS), ...Object.values(CALLOUT_TITLE_CLASS),
    ];
```
4. In `apps/kiosk/src/components/state-styles.test.ts` replace:
```ts
  it("never contains raw colour values", () => {
```
   with:
```ts
  it("callout: green when redundant, amber with one router left, red with none (S2.E22)", () => {
    expect(CALLOUT_BOX_CLASS.redundant).toBe("border-callout-border bg-callout-fill");
    expect(CALLOUT_TITLE_CLASS.redundant).toBe("text-accent");
    expect(CALLOUT_BOX_CLASS.one_left).toBe("border-warn bg-warn-fill");
    expect(CALLOUT_TITLE_CLASS.one_left).toBe("text-warn");
    expect(CALLOUT_BOX_CLASS.none).toBe("border-danger/40 bg-danger-fill");
    expect(CALLOUT_TITLE_CLASS.none).toBe("text-danger");
  });
  it("never contains raw colour values", () => {
```

**Test:** In `state-styles.test.ts` (blocks above): the three callout variants map to their tokens; the callout maps join the "never contains raw colour values" check.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/components` → all pass. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): callout state styles"`

### T4 — `MetricTile` shows a stale age (H10)
- [x] done

**Files:** `apps/kiosk/src/components/MetricTile.tsx`

**Context:** S2.E12 metrics have states Fresh / Stale (H10: value `text-3` + age) / Unavailable "—" (H11). `MetricTile` (M02) has no stale state. Add an optional `staleAgo` prop (extension, not a fork — milestone note). With `staleAgo` the value turns `text-3` (`STALE_TEXT_CLASS`) and a caption line `14 min ago` (`text-caption text-3`) appears under it. Existing callers (`ComponentGallery`, `LiveDemo`) are unaffected.

**Do:**
1. Replace the whole file `apps/kiosk/src/components/MetricTile.tsx`:
```tsx
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { STALE_TEXT_CLASS, VALUE_TONE_CLASS, type ValueTone } from "./state-styles";

/** S2 power metrics (POWER 287 W, VOLTAGE 231 V …). `value` null = H11; `staleAgo` = H10 ("14 min ago"). */
export function MetricTile({ label, value, tone = "default", staleAgo = null, loading = false }: {
  label: string;
  value: string | null;
  tone?: ValueTone;
  staleAgo?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sensor-label font-bold uppercase text-text-2">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : value === null ? (
        <p className="flex flex-col">
          <span className="font-mono text-value font-semibold text-text-3">—</span>
          <span className="text-caption text-text-3">No reading yet</span>
        </p>
      ) : (
        <p className="flex flex-col">
          <span className={cn("font-mono text-value font-semibold", staleAgo !== null ? STALE_TEXT_CLASS : VALUE_TONE_CLASS[tone])}>
            {value}
          </span>
          {staleAgo !== null && <span className="text-caption text-text-3">{staleAgo}</span>}
        </p>
      )}
    </div>
  );
}
```

**Test:** None (markup only).

**Verify:** `pnpm verify` → exit 0. `/dev/components` (dev server) still renders the MetricTile demo.

**Commit:** `git commit -m "feat(kiosk): stale age on metric tiles"`

### T5 — Mock room status: "Sensor battery low" (H16)
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/mock-rules.ts`, `apps/kiosk/src/data/adapters/mock/mock-nodes.test.ts`

**Context:** H16: a battery ≤20% makes S1.E4 degraded "Sensor battery low". The real rule is core-api's (M08); the mock approximates it in `deriveRoomStatus` (decision D11: order fault > device offline > "Sensor not reporting" > "Sensor battery low" > normal).

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
/** S1.E4 (approximation of core-api `status.ts`): fault > degraded > normal. */
```
   with:
```ts
/** H16: a battery at or below this is low (amber on S2, S1.E4 degraded). */
export const LOW_BATTERY_PCT = 20;

/** S1.E4 (approximation of core-api `status.ts`): fault > degraded > normal. */
```
2. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
  if (count < of) return { level: "degraded", text: "Sensor not reporting" };
  return { level: "normal", text: "All systems normal" };
```
   with:
```ts
  if (count < of) return { level: "degraded", text: "Sensor not reporting" };
  const lowBattery = state.zigbee.nodes.some((node) => node.battery_pct !== null && node.battery_pct <= LOW_BATTERY_PCT);
  if (lowBattery) return { level: "degraded", text: "Sensor battery low" }; // H16
  return { level: "normal", text: "All systems normal" };
```
3. Create `apps/kiosk/src/data/adapters/mock/mock-nodes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { deriveRoomStatus } from "./mock-rules";

describe("mock room status: low battery (H16)", () => {
  it("a battery at 20% or less degrades the room: `Sensor battery low`", () => {
    const base = roomState();
    const withBattery = (pct: number) => ({
      ...base,
      zigbee: { ...base.zigbee, nodes: base.zigbee.nodes.map((n) => (n.friendly_name === "r101_temp" ? { ...n, battery_pct: pct } : n)) },
    });
    expect(deriveRoomStatus(withBattery(21))).toEqual({ level: "normal", text: "All systems normal" });
    expect(deriveRoomStatus(withBattery(20))).toEqual({ level: "degraded", text: "Sensor battery low" });
    expect(deriveRoomStatus(withBattery(8))).toEqual({ level: "degraded", text: "Sensor battery low" });
  });
});
```

**Test:** `apps/kiosk/src/data/adapters/mock/mock-nodes.test.ts` (block above): 21% normal, 20% and 8% degraded.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock` → all pass. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock low-battery room status"`

### T6 — Mock node helpers: rebased `last_seen`, nodes online/offline
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/mock-rules.ts`, `apps/kiosk/src/data/adapters/mock/mock-nodes.test.ts`

**Context:** S2 reads `zigbee.nodes[]` (online, `last_seen`, LQI, battery). The fixture's `last_seen` times are from 2026-10-05, so in the mock every row would say "8 d ago". `rebaseNodeTimes` shifts them to the same age relative to now (S2.E16 `12s ago` on page open). `withNodesOnline` takes nodes offline with `last_seen` 5 min ago (AC5 "Offline · last seen 5 min ago") or back online seen now (decision D11).

**Do:**
1. Append to `apps/kiosk/src/data/adapters/mock/mock-rules.ts`:
```ts
// ── Zigbee nodes (S2) ────────────────────────────────────────────────────────────────

/** "… offline" in the panel backdates the node's last_seen this much (S2.E6 "last seen 5 min ago"). */
export const NODE_OFFLINE_AGE_MS = 5 * 60_000;

/**
 * The fixture's node `last_seen` times are relative to its own `server_time`; shift them so they
 * are the same age relative to `nowMs` (S2.E16 "12s ago" when the page opens).
 */
export function rebaseNodeTimes(state: RoomState, nowMs: number): RoomState {
  const shift = nowMs - Date.parse(state.server_time);
  const nodes = state.zigbee.nodes.map((node) =>
    node.last_seen === null ? node : { ...node, last_seen: new Date(Date.parse(node.last_seen) + shift).toISOString() },
  );
  return { ...state, zigbee: { ...state.zigbee, nodes } };
}

/** H8/H9 on S2: matching nodes go offline (last seen 5 min ago) or come back (last seen now). */
export function withNodesOnline(state: RoomState, friendlyNames: ReadonlySet<string>, online: boolean, nowMs: number): RoomState {
  const lastSeen = new Date(online ? nowMs : nowMs - NODE_OFFLINE_AGE_MS).toISOString();
  const nodes = state.zigbee.nodes.map((node) =>
    friendlyNames.has(node.friendly_name) ? { ...node, online, last_seen: lastSeen } : node,
  );
  return { ...state, zigbee: { ...state.zigbee, nodes } };
}
```
2. In `apps/kiosk/src/data/adapters/mock/mock-nodes.test.ts` replace:
```ts
import { deriveRoomStatus } from "./mock-rules";
```
   with:
```ts
import { deriveRoomStatus, NODE_OFFLINE_AGE_MS, rebaseNodeTimes, withNodesOnline } from "./mock-rules";
```
3. Append to `apps/kiosk/src/data/adapters/mock/mock-nodes.test.ts`:
```ts
const NOW = Date.parse("2026-10-13T09:00:00Z");

describe("mock Zigbee nodes (S2)", () => {
  it("rebases last_seen so every node keeps its age (fixture r101_temp is 12 s old)", () => {
    const state = rebaseNodeTimes(roomState(), NOW);
    const temp = state.zigbee.nodes.find((n) => n.friendly_name === "r101_temp");
    expect(temp?.last_seen).toBe("2026-10-13T08:59:48.000Z");
  });

  it("offline nodes were last seen 5 min ago; back online = seen now", () => {
    const off = withNodesOnline(roomState(), new Set(["r101_lights"]), false, NOW);
    const lights = off.zigbee.nodes.find((n) => n.friendly_name === "r101_lights");
    expect(lights).toMatchObject({ online: false, last_seen: new Date(NOW - NODE_OFFLINE_AGE_MS).toISOString() });
    expect(off.zigbee.nodes.find((n) => n.friendly_name === "r101_proj_plug")?.online).toBe(true);
    const on = withNodesOnline(off, new Set(["r101_lights"]), true, NOW);
    expect(on.zigbee.nodes.find((n) => n.friendly_name === "r101_lights")).toMatchObject({ online: true, last_seen: new Date(NOW).toISOString() });
  });
});
```

**Test:** `mock-nodes.test.ts` (blocks above): rebase keeps r101_temp 12 s old; offline = 5 min ago; back online = now.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock` → all pass. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock zigbee node helpers"`

### T7 — FakeRoom: Zigbee nodes follow the panel's offline and stale actions
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room-devices.test.ts`

**Context:** So S2 reacts to the existing panel buttons: "Toggle lights offline" / "Toggle power meter offline" (router offline, S2.E6/E10, R7), "Toggle coordinator offline" (H9: every node offline) and "Toggle climate stale" (H10: the r101_temp row's last seen is 14 min old). Nodes are matched to registry devices by `device.hw_ref === node.friendly_name` (decision D3). The FakeRoom also starts from rebased node times (T6).

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import {
  applyCommandToState, applyProjectorStep, describeCommand, observe, projectorRamp, setProjectorPhase, statusFor,
  withDerived, type RampTimes,
} from "./mock-rules";
```
   with:
```ts
import {
  applyCommandToState, applyProjectorStep, describeCommand, observe, projectorRamp, rebaseNodeTimes, setProjectorPhase,
  statusFor, withDerived, withNodesOnline, type RampTimes,
} from "./mock-rules";
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    this.state = RoomState.parse(roomNormal);
```
   with:
```ts
    this.state = rebaseNodeTimes(RoomState.parse(roomNormal), this.now());
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    const blasterOnline = devices.find((device) => device.id === "ir_blaster")?.online.value !== false;
    const irBlaster = this.state.ir_blaster;
    return { ...this.state, devices, ir_blaster: { ...irBlaster, online: observe(irBlaster.online, blasterOnline, ctx) } };
```
   with:
```ts
    const blasterOnline = devices.find((device) => device.id === "ir_blaster")?.online.value !== false;
    const irBlaster = this.state.ir_blaster;
    // S2: the matching Zigbee nodes follow (online flag + last seen).
    const nodeNames = new Set(
      this.state.devices.flatMap((device) => (match(device) && device.transport === "zigbee" && device.hw_ref !== null ? [device.hw_ref] : [])),
    );
    const next = { ...this.state, devices, ir_blaster: { ...irBlaster, online: observe(irBlaster.online, blasterOnline, ctx) } };
    return withNodesOnline(next, nodeNames, online, this.now());
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  /** H10: the climate sensor (temperature + humidity) is 14 min old; again → fresh. */
  toggleClimateStale(): void {
    const { sensors } = this.state.environment;
    const stale = !sensors.temperature.stale;
    const at = stale ? new Date(this.now() - MOCK_STALE_AGE_MS).toISOString() : this.iso();
    this.setSensors({ ...sensors, temperature: { ...sensors.temperature, stale, at }, humidity: { ...sensors.humidity, stale, at } });
  }
```
   with:
```ts
  /** H10: the climate sensor (temperature + humidity) is 14 min old, and so is its node's last seen; again → fresh. */
  toggleClimateStale(): void {
    const { environment, zigbee } = this.state;
    const { sensors } = environment;
    const stale = !sensors.temperature.stale;
    const at = stale ? new Date(this.now() - MOCK_STALE_AGE_MS).toISOString() : this.iso();
    const nodes = zigbee.nodes.map((node) => (node.friendly_name === sensors.temperature.node ? { ...node, last_seen: at } : node));
    this.commit({
      ...this.state,
      environment: { ...environment, sensors: { ...sensors, temperature: { ...sensors.temperature, stale, at }, humidity: { ...sensors.humidity, stale, at } } },
      zigbee: { ...zigbee, nodes },
    });
  }
```
5. Create `apps/kiosk/src/data/adapters/mock/fake-room-devices.test.ts`:
```ts
import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS, MOCK_STALE_AGE_MS } from "./fake-room";
import { NODE_OFFLINE_AGE_MS } from "./mock-rules";

function connected() {
  const room = new FakeRoom({ random: () => 1 });
  const events: ServerEvent[] = [];
  room.connect("phone", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  const last = (): RoomState => {
    const found = events.findLast((e) => e.type === "state" || e.type === "snapshot");
    if (found === undefined || (found.type !== "state" && found.type !== "snapshot")) throw new Error("no state");
    return found.state;
  };
  return { room, last };
}

const node = (state: RoomState, name: string) => state.zigbee.nodes.find((n) => n.friendly_name === name);

describe("FakeRoom: Zigbee nodes follow the room (S2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with node ages as in the fixture (r101_temp seen 12 s before the snapshot)", () => {
    const { last } = connected();
    const state = last();
    const age = Date.parse(state.server_time) - Date.parse(node(state, "r101_temp")?.last_seen ?? "");
    expect(age).toBe(12_000 + MOCK_LATENCY_MAX_MS);
  });

  it("lights offline takes its router node offline, last seen 5 min ago (S2.E6, R7)", () => {
    const { room, last } = connected();
    room.toggleDeviceOffline("lights");
    expect(node(last(), "r101_lights")).toMatchObject({ online: false, last_seen: new Date(Date.now() - NODE_OFFLINE_AGE_MS).toISOString() });
    expect(node(last(), "r101_proj_plug")?.online).toBe(true);
    room.toggleDeviceOffline("lights");
    expect(node(last(), "r101_lights")?.online).toBe(true);
  });

  it("coordinator offline takes every node offline (H9)", () => {
    const { room, last } = connected();
    room.toggleCoordinatorOffline();
    expect(last().zigbee.nodes.every((n) => !n.online)).toBe(true);
  });

  it("climate stale backdates the r101_temp node too (H10)", () => {
    const { room, last } = connected();
    room.toggleClimateStale();
    expect(node(last(), "r101_temp")?.last_seen).toBe(new Date(Date.now() - MOCK_STALE_AGE_MS).toISOString());
  });
});
```

**Test:** `apps/kiosk/src/data/adapters/mock/fake-room-devices.test.ts` (block above): start ages, lights offline → node offline 5 min ago and back, coordinator offline → all nodes offline, climate stale → node last seen 14 min ago.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock` → all pass (the M04 panel tests too). `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock zigbee nodes follow offline and stale"`

### T8 — FakeRoom: panel methods for the S2 hidden states
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room-devices.test.ts`

**Context:** Milestone scope "Mock panel additions": battery low (≤20, ≤10), no battery devices, joining open with countdown, interlock holding/bypassed, coordinator starting. Router offline, sensor stale and coordinator offline already exist (T7). Joining opens with 4:12 left (`MOCK_JOIN_WINDOW_MS` = 252 s, real time, not time-scaled) so AC6 reads "Open · 4:12 left". Interlock holding = projector cooling at 112 W (H15), reusing `applyProjectorStep`, which already sets `interlock.status` from the projector state.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import {
  applyCommandToState, applyProjectorStep, describeCommand, observe, projectorRamp, rebaseNodeTimes, setProjectorPhase,
  statusFor, withDerived, withNodesOnline, type RampTimes,
} from "./mock-rules";
```
   with:
```ts
import {
  applyCommandToState, applyProjectorStep, describeCommand, observe, projectorRamp, rebaseNodeTimes, RUNNING_WATTS,
  setProjectorPhase, statusFor, withDerived, withNodesOnline, type ProjectorStep, type RampTimes,
} from "./mock-rules";
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
/** "Toggle climate stale" backdates the reading by this much (H10 "· 14 min ago"). */
export const MOCK_STALE_AGE_MS = 14 * 60_000;
```
   with:
```ts
/** "Toggle climate stale" backdates the reading by this much (H10 "· 14 min ago"). */
export const MOCK_STALE_AGE_MS = 14 * 60_000;
/** "Open joining": the window the panel opens, so S2.E21 starts at "Open · 4:12 left". Not time-scaled. */
export const MOCK_JOIN_WINDOW_MS = (4 * 60 + 12) * 1000;
/** "Toggle interlock holding": the projector is cooling at this draw (H15 "… · 112 W"). */
export const MOCK_HOLDING_WATTS = 112;
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private noDrawChangeNext = false;
```
   with:
```ts
  private noDrawChangeNext = false;
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  /** H24: the session times out on the server → remote `view`, kiosk `control`. */
```
   with:
```ts
  /** S2.E16 / H16: set one battery node's level (18 → amber, 8 → red, 98 → back to normal). */
  setBattery(friendlyName: string, pct: number): void {
    const { zigbee } = this.state;
    const nodes = zigbee.nodes.map((node) => (node.friendly_name === friendlyName ? { ...node, battery_pct: pct } : node));
    this.commit({ ...this.state, zigbee: { ...zigbee, nodes } });
  }

  /** S2.E19: every battery end device is unpaired (reload the page to undo). */
  noBatteryDevices(): void {
    const { zigbee } = this.state;
    const nodes = zigbee.nodes.filter((node) => node.power_source !== "battery");
    const routers = nodes.filter((node) => node.role === "router").length;
    this.commit({
      ...this.state,
      zigbee: { ...zigbee, nodes, mesh: { ...zigbee.mesh, paired: nodes.length, routers, end_devices: nodes.length - routers } },
    });
  }

  /** S2.E3 "Coordinator starting…" ↔ online. */
  toggleCoordinatorStarting(): void {
    const { zigbee } = this.state;
    const status = zigbee.coordinator.status === "starting" ? "online" : "starting";
    this.commit({ ...this.state, zigbee: { ...zigbee, coordinator: { ...zigbee.coordinator, status } } });
  }

  /** S2.E21: joining opens for 4:12 and closes by itself (permit join itself is S3d, M06). */
  openJoining(): void {
    if (this.joinTimer !== null) clearTimeout(this.joinTimer);
    const until = new Date(this.now() + MOCK_JOIN_WINDOW_MS).toISOString();
    this.setJoining({ state: "open", until });
    this.joinTimer = setTimeout(() => {
      this.joinTimer = null;
      this.setJoining({ state: "closed" });
    }, MOCK_JOIN_WINDOW_MS);
  }

  /** H15 / S2.E23: the projector is cooling at 112 W and the interlock holds; again → running, armed. */
  toggleInterlockHolding(): void {
    const step: ProjectorStep =
      this.state.interlock.status === "holding"
        ? { watts: RUNNING_WATTS, state: "running", phase: "idle", done: true }
        : { watts: MOCK_HOLDING_WATTS, state: "cooling_down", phase: "idle", done: true };
    this.commit(applyProjectorStep(this.state, step, this.iso())); // cooling_down → holding, running → armed
  }

  /** S2.E23 "Bypassed" ↔ armed (the bypass itself is a technician action, not built). */
  toggleInterlockBypassed(): void {
    const status = this.state.interlock.status === "bypassed" ? "armed" : "bypassed";
    this.commit({ ...this.state, interlock: { ...this.state.interlock, status } });
  }

  /** H24: the session times out on the server → remote `view`, kiosk `control`. */
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private setSensors(sensors
```
   with:
```ts
  private setJoining(joining: RoomState["zigbee"]["mesh"]["joining"]): void {
    const { zigbee } = this.state;
    this.commit({ ...this.state, zigbee: { ...zigbee, mesh: { ...zigbee.mesh, joining } } });
  }

  private setSensors(sensors
```
6. In `apps/kiosk/src/data/adapters/mock/fake-room-devices.test.ts` replace:
```ts
import { FakeRoom, MOCK_LATENCY_MAX_MS, MOCK_STALE_AGE_MS } from "./fake-room";
```
   with:
```ts
import { FakeRoom, MOCK_JOIN_WINDOW_MS, MOCK_LATENCY_MAX_MS, MOCK_STALE_AGE_MS } from "./fake-room";
```
7. Append to `apps/kiosk/src/data/adapters/mock/fake-room-devices.test.ts`:
```ts
describe("FakeRoom panel actions (S2 hidden states)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("battery 18% / 8% degrade the room; 98% restores it (H16)", () => {
    const { room, last } = connected();
    room.setBattery("r101_temp", 18);
    expect(node(last(), "r101_temp")?.battery_pct).toBe(18);
    expect(last().room.status).toEqual({ level: "degraded", text: "Sensor battery low" });
    room.setBattery("r101_temp", 8);
    expect(node(last(), "r101_temp")?.battery_pct).toBe(8);
    room.setBattery("r101_temp", 98);
    expect(last().room.status.level).toBe("normal");
  });

  it("no battery devices: only the two routers remain (S2.E19)", () => {
    const { room, last } = connected();
    room.noBatteryDevices();
    expect(last().zigbee.nodes.map((n) => n.friendly_name)).toEqual(["r101_lights", "r101_proj_plug"]);
    expect(last().zigbee.mesh).toMatchObject({ paired: 2, routers: 2, end_devices: 0 });
  });

  it("coordinator starting ↔ online (S2.E3)", () => {
    const { room, last } = connected();
    room.toggleCoordinatorStarting();
    expect(last().zigbee.coordinator.status).toBe("starting");
    room.toggleCoordinatorStarting();
    expect(last().zigbee.coordinator.status).toBe("online");
  });

  it("joining opens for 4:12 and closes by itself (S2.E21)", () => {
    const { room, last } = connected();
    room.openJoining();
    expect(last().zigbee.mesh.joining).toEqual({ state: "open", until: new Date(Date.now() + MOCK_JOIN_WINDOW_MS).toISOString() });
    vi.advanceTimersByTime(MOCK_JOIN_WINDOW_MS);
    expect(last().zigbee.mesh.joining).toEqual({ state: "closed" });
  });

  it("interlock holding at 112 W while cooling; again → running, armed (H15)", () => {
    const { room, last } = connected();
    room.toggleInterlockHolding();
    expect(last().interlock.status).toBe("holding");
    expect(last().display.projector.power.value?.watts).toBe(112);
    expect(last().display.projector.state.value).toBe("cooling_down");
    room.toggleInterlockHolding();
    expect(last().interlock.status).toBe("armed");
    expect(last().display.projector.power.value?.watts).toBe(287);
  });

  it("interlock bypassed ↔ armed (S2.E23)", () => {
    const { room, last } = connected();
    room.toggleInterlockBypassed();
    expect(last().interlock.status).toBe("bypassed");
    room.toggleInterlockBypassed();
    expect(last().interlock.status).toBe("armed");
  });
});
```

**Test:** `fake-room-devices.test.ts` (block above): battery 18/8/98 and the room status, no battery devices, coordinator starting ↔ online, joining opens for 4:12 and closes itself, interlock holding at 112 W and back, bypassed and back.

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock` → all pass. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock panel methods for S2 states"`

### T9 — Mock panel buttons for S2
- [x] done

**Files:** `apps/kiosk/src/app/dev/MockPanel.tsx`

**Context:** One button per T8 method. Labels are what the acceptance task (T33) clicks.

**Do:**
1. In `apps/kiosk/src/app/dev/MockPanel.tsx` replace:
```tsx
  { label: "Door: no reading", run: () => fakeRoom.doorNoReading() },
];
```
   with:
```tsx
  { label: "Door: no reading", run: () => fakeRoom.doorNoReading() },
  // M05: S2 hidden states. Router offline = "Toggle lights offline" / "Toggle power meter offline".
  { label: "Climate battery 18%", run: () => fakeRoom.setBattery("r101_temp", 18) },
  { label: "Climate battery 8%", run: () => fakeRoom.setBattery("r101_temp", 8) },
  { label: "Climate battery 98%", run: () => fakeRoom.setBattery("r101_temp", 98) },
  { label: "No battery devices (reload to undo)", run: () => fakeRoom.noBatteryDevices() },
  { label: "Toggle coordinator starting", run: () => fakeRoom.toggleCoordinatorStarting() },
  { label: "Open joining (4:12)", run: () => fakeRoom.openJoining() },
  { label: "Toggle interlock holding", run: () => fakeRoom.toggleInterlockHolding() },
  { label: "Toggle interlock bypassed", run: () => fakeRoom.toggleInterlockBypassed() },
];
```

**Test:** None (dev-only markup).

**Verify:** Dev server `/devices?mock-panel`: the panel lists the eight new buttons. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock panel buttons for S2"`

### T10 — Selector: coordinator status (S2.E3)
- [x] done

**Files:** `apps/kiosk/src/features/devices/header/coordinator-status.view.ts`, `apps/kiosk/src/features/devices/header/coordinator-status.view.test.ts`

**Context:** S2.E3: online "● Coordinator online" (green dot, text-2 text as in screenshot 02); `[INFERRED]` "Coordinator offline" (red) and "Coordinator starting…" (amber, solid dot = the M04 `warning` tone); before the first snapshot (H1) a hollow grey ring + "Connecting…".

**Do:**
1. Create `apps/kiosk/src/features/devices/header/coordinator-status.view.ts`:
```ts
import type { Coordinator } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";

// S2.E3 (H9). `undefined` = no snapshot yet (H1).

export interface CoordinatorStatusView {
  tone: StateTone;
  text: string;
}

export function coordinatorStatusView(status: Coordinator["status"] | undefined): CoordinatorStatusView {
  switch (status) {
    case undefined:
      return { tone: "unknown", text: "Connecting…" };
    case "online":
      return { tone: "confirmed", text: "Coordinator online" };
    case "starting":
      return { tone: "warning", text: "Coordinator starting…" };
    case "offline":
      return { tone: "offline", text: "Coordinator offline" };
  }
}
```
2. Create `apps/kiosk/src/features/devices/header/coordinator-status.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { coordinatorStatusView } from "./coordinator-status.view";

describe("coordinatorStatusView (S2.E3)", () => {
  it.each([
    ["online", { tone: "confirmed", text: "Coordinator online" }],
    ["starting", { tone: "warning", text: "Coordinator starting…" }],
    ["offline", { tone: "offline", text: "Coordinator offline" }],
    [undefined, { tone: "unknown", text: "Connecting…" }],
  ] as const)("%s", (status, expected) => {
    expect(coordinatorStatusView(status)).toEqual(expected);
  });
});
```

**Test:** `coordinator-status.view.test.ts` (block above): the four states.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): coordinator status selector"`

### T11 — Selector: router card header (S2.E6/E10)
- [x] done

**Files:** `apps/kiosk/src/features/devices/routers/routers.view.ts`, `apps/kiosk/src/features/devices/routers/routers.view.test.ts`

**Context:** Screen 02, main column, both router card headers: dot · "Lighting switch" over `ZBM5-2C-86W · r101_lights` (mono), "Router" badge, `LQI 214`. `[INFERRED]` offline: red dot, "Offline · last seen 5 min ago" replaces the LQI. Decision D3: the card is bound to a registry device (`lights`, `projector_socket`); its node is the one whose `friendly_name` equals `device.hw_ref`; online = `node.online` (no node = offline). Ages use server time (`formatAgo`, M02).

**Do:**
1. Create `apps/kiosk/src/features/devices/routers/routers.view.ts`:
```ts
import type { Device, ZigbeeNode } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";

// S2.E5–E13: the two mains-powered routers (H8, H10, H11).

export interface RouterHeaderView {
  title: string;
  /** `ZBM5-2C-86W · r101_lights` (mono). */
  ids: string;
  online: boolean;
  tone: StateTone;
  /** Online: `LQI 214`. Offline: `Offline · last seen 5 min ago` in its place (S2.E6). */
  link: string;
}

/** `device` = the registry entry ("lights", "projector_socket"); `node` = its Zigbee node by friendly name. */
export function routerHeaderView(device: Device, node: ZigbeeNode | undefined, now: Date): RouterHeaderView {
  const online = node?.online === true;
  const lastSeen = node?.last_seen ?? null;
  return {
    title: device.name,
    ids: `${node?.model ?? device.model ?? "—"} · ${node?.friendly_name ?? device.hw_ref ?? "—"}`,
    online,
    tone: online ? "confirmed" : "offline",
    link: online
      ? `LQI ${node.lqi === null ? "—" : String(node.lqi)}`
      : lastSeen === null
        ? "Offline"
        : `Offline · last seen ${formatAgo(lastSeen, now)}`,
  };
}
```
2. Create `apps/kiosk/src/features/devices/routers/routers.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { routerHeaderView } from "./routers.view";

const NOW = new Date("2026-10-05T10:42:00Z");

function lights() {
  const state = roomState();
  const device = state.devices.find((d) => d.id === "lights");
  if (device === undefined) throw new Error("fixture has no lights device");
  return { state, device, node: state.zigbee.nodes.find((n) => n.friendly_name === device.hw_ref) };
}

describe("routerHeaderView (S2.E6/E10)", () => {
  it("online: green dot, ids, `LQI 214`", () => {
    const { device, node } = lights();
    expect(routerHeaderView(device, node, NOW)).toEqual({
      title: "Lighting switch", ids: "ZBM5-2C-86W · r101_lights", online: true, tone: "confirmed", link: "LQI 214",
    });
  });
  it("offline: red dot, `Offline · last seen 5 min ago` instead of LQI", () => {
    const { device, node } = lights();
    if (node === undefined) throw new Error("fixture has no r101_lights node");
    const view = routerHeaderView(device, { ...node, online: false, last_seen: "2026-10-05T10:37:00Z" }, NOW);
    expect(view).toMatchObject({ online: false, tone: "offline", link: "Offline · last seen 5 min ago" });
  });
  it("no node paired: offline, ids from the registry", () => {
    const { device } = lights();
    expect(routerHeaderView(device, undefined, NOW)).toMatchObject({ ids: "ZBM5-2C-86W · r101_lights", link: "Offline", online: false });
  });
});
```

**Test:** `routers.view.test.ts` (block above): online, offline with last seen, no node paired.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): router card header selector"`

### T12 — Selector: read-only gang tile (S2.E7/E8/E11)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/routers/routers.view.ts`, `apps/kiosk/src/features/devices/routers/routers.view.test.ts`

**Context:** S2.E7: On = green fill/border (`ACTIVE_CONTROL_CLASS.confirmed`), green dot, "On"; Off = neutral, grey dot, "Off" text-3. Never-reported value → hollow ring, "Unknown". Uses `stateTone()` (M02) so an assumed value would get the amber fill. Read-only (Q11).

**Do:**
1. In `apps/kiosk/src/features/devices/routers/routers.view.ts` replace:
```ts
import type { Device, ZigbeeNode } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";
```
   with:
```ts
import type { Device, Observed, ZigbeeNode } from "@eduscope/contracts";
import { stateTone, type ActiveVariant, type StateTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";
```
2. Append to `apps/kiosk/src/features/devices/routers/routers.view.ts`:
```ts
export interface GangTileView {
  tone: StateTone;
  text: "On" | "Off" | "Unknown";
  /** Tile fill: green for confirmed On (screenshot 02), amber for an assumed On, neutral otherwise. */
  fill: ActiveVariant | null;
}

/** S2.E7/E8/E11: a read-only On/Off tile (Q11). */
export function gangTileView(state: Observed<boolean>): GangTileView {
  const tone = stateTone({ confidence: state.confidence, active: state.value === true, hasValue: state.value !== null });
  if (state.value === null) return { tone, text: "Unknown", fill: null };
  if (!state.value) return { tone, text: "Off", fill: null };
  return { tone, text: "On", fill: tone === "assumed" ? "assumed" : "confirmed" };
}
```
3. In `apps/kiosk/src/features/devices/routers/routers.view.test.ts` replace:
```ts
import { routerHeaderView } from "./routers.view";
```
   with:
```ts
import { gangTileView, routerHeaderView } from "./routers.view";
```
4. Append to `apps/kiosk/src/features/devices/routers/routers.view.test.ts`:
```ts
describe("gangTileView (S2.E7/E8/E11)", () => {
  it("front On (green fill), rear Off (neutral), unknown", () => {
    const { state } = lights();
    expect(gangTileView(state.environment.lights.front)).toEqual({ tone: "confirmed", text: "On", fill: "confirmed" });
    expect(gangTileView(state.environment.lights.rear)).toEqual({ tone: "off", text: "Off", fill: null });
    expect(gangTileView({ ...state.environment.lights.rear, value: null, confidence: "unknown" })).toEqual({
      tone: "unknown", text: "Unknown", fill: null,
    });
  });
});
```

**Test:** `routers.view.test.ts` (block above): front On, rear Off, unknown.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): gang tile selector"`

### T13 — Selector: projector socket metrics (S2.E12)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/routers/routers.view.ts`, `apps/kiosk/src/features/devices/routers/routers.view.test.ts`

**Context:** S2.E12: "POWER" `287 W` (accent) · "VOLTAGE" `231 V` · "TODAY" `1.84 kWh` · "RATING" `13 A`. Stale (H10): the three live values get the age (`14 min ago`); RATING is static and gets none. No reading ever (H11): all null → `MetricTile` shows "—" + "No reading yet".

**Do:**
1. In `apps/kiosk/src/features/devices/routers/routers.view.ts` replace:
```ts
import type { Device, Observed, ZigbeeNode } from "@eduscope/contracts";
import { stateTone, type ActiveVariant, type StateTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";
```
   with:
```ts
import type { Device, Observed, PowerReading, ZigbeeNode } from "@eduscope/contracts";
import { stateTone, type ActiveVariant, type StateTone, type ValueTone } from "@/components/state-styles";
import { formatAgo, formatWatts } from "@/lib/format";
```
2. Append to `apps/kiosk/src/features/devices/routers/routers.view.ts`:
```ts
export interface MetricView {
  label: "Power" | "Voltage" | "Today" | "Rating";
  value: string | null;
  tone: ValueTone;
  staleAgo: string | null;
}

/** S2.E12: `287 W` (accent) · `231 V` · `1.84 kWh` · `13 A`. Stale → text-3 + age (H10); null → "—" (H11). */
export function socketMetricsView(power: Observed<PowerReading>, now: Date): MetricView[] {
  const reading = power.value;
  const staleAgo = power.stale && power.updated_at !== null ? formatAgo(power.updated_at, now) : null;
  return [
    { label: "Power", value: reading === null ? null : formatWatts(reading.watts), tone: "accent", staleAgo },
    { label: "Voltage", value: reading === null ? null : `${Math.round(reading.volts)} V`, tone: "default", staleAgo },
    { label: "Today", value: reading === null ? null : `${reading.kwh_today.toFixed(2)} kWh`, tone: "default", staleAgo },
    { label: "Rating", value: reading === null ? null : `${reading.rating_a} A`, tone: "default", staleAgo: null },
  ];
}
```
3. In `apps/kiosk/src/features/devices/routers/routers.view.test.ts` replace:
```ts
import { gangTileView, routerHeaderView } from "./routers.view";
```
   with:
```ts
import { gangTileView, routerHeaderView, socketMetricsView } from "./routers.view";
```
4. Append to `apps/kiosk/src/features/devices/routers/routers.view.test.ts`:
```ts
describe("socketMetricsView (S2.E12)", () => {
  it("screenshot 02: 287 W accent · 231 V · 1.84 kWh · 13 A", () => {
    const { state } = lights();
    expect(socketMetricsView(state.display.projector.power, NOW)).toEqual([
      { label: "Power", value: "287 W", tone: "accent", staleAgo: null },
      { label: "Voltage", value: "231 V", tone: "default", staleAgo: null },
      { label: "Today", value: "1.84 kWh", tone: "default", staleAgo: null },
      { label: "Rating", value: "13 A", tone: "default", staleAgo: null },
    ]);
  });
  it("stale: age on the live metrics, not on the static rating (H10)", () => {
    const { state } = lights();
    const power = { ...state.display.projector.power, stale: true, updated_at: "2026-10-05T10:28:00Z" };
    expect(socketMetricsView(power, NOW).map((m) => m.staleAgo)).toEqual(["14 min ago", "14 min ago", "14 min ago", null]);
  });
  it("no reading ever: every value null (H11)", () => {
    const { state } = lights();
    const power = { ...state.display.projector.power, value: null, updated_at: null };
    expect(socketMetricsView(power, NOW).map((m) => m.value)).toEqual([null, null, null, null]);
  });
});
```

**Test:** `routers.view.test.ts` (block above): screenshot values, stale ages, no reading.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): socket metrics selector"`

### T14 — Selector: battery severity and last-seen text (H16, S2.E16)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/battery/battery.view.ts`, `apps/kiosk/src/features/devices/battery/battery.view.test.ts`

**Context:** H16: battery ≤20% amber, ≤10% red. S2.E16 LAST SEEN: `12s ago` from **server** time (`formatAgo`, M02); offline (H8) `Offline · 5 min ago` (decision D6). Milestone AC9 asks for tests of exactly these.

**Do:**
1. Create `apps/kiosk/src/features/devices/battery/battery.view.ts`:
```ts
import { formatAgo } from "@/lib/format";

// S2.E14–E19: battery end devices (H8, H10, H11, H16, R13).

export type BatterySeverity = "ok" | "low" | "critical" | "unknown";

/** H16: ≤20% low (amber), ≤10% critical (red). */
export function batterySeverity(pct: number | null): BatterySeverity {
  if (pct === null) return "unknown";
  if (pct <= 10) return "critical";
  if (pct <= 20) return "low";
  return "ok";
}

/** S2.E16 LAST SEEN: `12s ago` (server time), `Offline · 5 min ago`, `Offline`, `—`. */
export function lastSeenText(lastSeen: string | null, online: boolean, now: Date): string {
  if (!online) return lastSeen === null ? "Offline" : `Offline · ${formatAgo(lastSeen, now)}`;
  return lastSeen === null ? "—" : formatAgo(lastSeen, now);
}
```
2. Create `apps/kiosk/src/features/devices/battery/battery.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { batterySeverity, lastSeenText } from "./battery.view";

const NOW = new Date("2026-10-05T10:42:00Z");

describe("batterySeverity (H16)", () => {
  it.each([
    [98, "ok"],
    [21, "ok"],
    [20, "low"],
    [18, "low"],
    [11, "low"],
    [10, "critical"],
    [8, "critical"],
    [0, "critical"],
    [null, "unknown"],
  ] as const)("%s%% → %s", (pct, expected) => {
    expect(batterySeverity(pct)).toBe(expected);
  });
});

describe("lastSeenText (S2.E6, S2.E16)", () => {
  it("online: relative to server time", () => {
    expect(lastSeenText("2026-10-05T10:41:48Z", true, NOW)).toBe("12s ago");
    expect(lastSeenText("2026-10-05T10:28:00Z", true, NOW)).toBe("14 min ago");
    expect(lastSeenText(null, true, NOW)).toBe("—");
  });
  it("offline: `Offline · 5 min ago`, or `Offline` if never seen", () => {
    expect(lastSeenText("2026-10-05T10:37:00Z", false, NOW)).toBe("Offline · 5 min ago");
    expect(lastSeenText(null, false, NOW)).toBe("Offline");
  });
});
```

**Test:** `battery.view.test.ts` (block above): severity boundaries 21/20/11/10/0/null; last seen online, offline, never.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): battery severity and last-seen selectors"`

### T15 — Selector: battery rows (S2.E16–E19)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/battery/battery.view.ts`, `apps/kiosk/src/features/devices/battery/battery.view.test.ts`

**Context:** Screen 02, BATTERY — END DEVICES: Room climate `SNZB-02P · r101_temp` `26.4° · 61%` `98%` `168` `12s ago`; Motion "Detected" (green); Door "Closed". Decision D4: rows = nodes with `power_source === "battery"` in the coordinator's order; name from the registry device whose `hw_ref` is the node's friendly name; reading = every `environment.sensors` reading of that node joined with ` · ` (formatter from T2); stale = any of its readings stale. H10: last seen amber, reading text-3. H8 offline: reading text-3, link "—", last seen red. H11: reading null. Empty list = S2.E19 "No battery devices paired".

**Do:**
1. In `apps/kiosk/src/features/devices/battery/battery.view.ts` replace:
```ts
import { formatAgo } from "@/lib/format";
```
   with:
```ts
import type { Device, RoomState, ZigbeeNode } from "@eduscope/contracts";
import { sensorReadingDisplay } from "@/components/sensor-reading";
import type { ValueTone } from "@/components/state-styles";
import { formatAgo } from "@/lib/format";
```
2. Append to `apps/kiosk/src/features/devices/battery/battery.view.ts`:
```ts
export interface BatteryRowView {
  key: string;
  /** Device name from the registry ("Room climate"), else the friendly name. */
  name: string;
  /** `SNZB-02P · r101_temp` (mono). */
  ids: string;
  /** `26.4° · 61%`, "Detected", "Closed"; null = no reading ever (H11). */
  reading: string | null;
  readingTone: ValueTone;
  battery: string;
  batteryTone: ValueTone;
  link: string;
  lastSeen: string;
  lastSeenTone: ValueTone;
}

type Sensors = RoomState["environment"]["sensors"];

const BATTERY_TONE: Record<BatterySeverity, ValueTone> = { ok: "muted", low: "warn", critical: "danger", unknown: "faint" };

/** One row per battery node, in the coordinator's order. Empty = S2.E19 "No battery devices paired". */
export function batteryRows(nodes: readonly ZigbeeNode[], devices: readonly Device[], sensors: Sensors, now: Date): BatteryRowView[] {
  const readings = [sensors.temperature, sensors.humidity, sensors.occupancy, sensors.contact];
  return nodes
    .filter((node) => node.power_source === "battery")
    .map((node): BatteryRowView => {
      const own = readings.filter((reading) => reading.node === node.friendly_name);
      const shown = own.map(sensorReadingDisplay);
      const values = shown.flatMap((item) => (item.value === null ? [] : [item.value]));
      const stale = own.some((reading) => reading.stale);
      const dim = stale || !node.online; // H10 / H8: the last value stays, in text-3
      const single = shown.length === 1 ? shown[0] : undefined;
      return {
        key: node.ieee,
        name: devices.find((device) => device.hw_ref === node.friendly_name)?.name ?? node.friendly_name,
        ids: `${node.model} · ${node.friendly_name}`,
        reading: values.length === 0 ? null : values.join(" · "),
        readingTone: dim ? "faint" : (single?.tone ?? "default"),
        battery: node.battery_pct === null ? "—" : `${node.battery_pct}%`,
        batteryTone: BATTERY_TONE[batterySeverity(node.battery_pct)],
        link: !node.online || node.lqi === null ? "—" : String(node.lqi),
        lastSeen: lastSeenText(node.last_seen, node.online, now),
        lastSeenTone: !node.online ? "danger" : stale ? "warn" : "muted",
      };
    });
}
```
3. In `apps/kiosk/src/features/devices/battery/battery.view.test.ts` replace:
```ts
import { describe, expect, it } from "vitest";
import { batterySeverity, lastSeenText } from "./battery.view";
```
   with:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { batteryRows, batterySeverity, lastSeenText } from "./battery.view";
```
4. Append to `apps/kiosk/src/features/devices/battery/battery.view.test.ts`:
```ts
describe("batteryRows (S2.E16–E19)", () => {
  it("screenshot 02: Room climate, Motion, Door", () => {
    const { zigbee, devices, environment } = roomState();
    expect(batteryRows(zigbee.nodes, devices, environment.sensors, NOW)).toEqual([
      {
        key: "0x00124b0029b70003", name: "Room climate", ids: "SNZB-02P · r101_temp", reading: "26.4° · 61%", readingTone: "default",
        battery: "98%", batteryTone: "muted", link: "168", lastSeen: "12s ago", lastSeenTone: "muted",
      },
      {
        key: "0x00124b0029b70004", name: "Motion", ids: "SNZB-03P · r101_motion", reading: "Detected", readingTone: "accent",
        battery: "91%", batteryTone: "muted", link: "142", lastSeen: "3 min ago", lastSeenTone: "muted",
      },
      {
        key: "0x00124b0029b70005", name: "Door", ids: "SNZB-04PR2 · r101_door", reading: "Closed", readingTone: "default",
        battery: "87%", batteryTone: "muted", link: "155", lastSeen: "8 min ago", lastSeenTone: "muted",
      },
    ]);
  });

  it("battery 18% amber, 8% red (H16)", () => {
    const { zigbee, devices, environment } = roomState();
    const nodes = zigbee.nodes.map((n) =>
      n.friendly_name === "r101_temp" ? { ...n, battery_pct: 18 } : n.friendly_name === "r101_door" ? { ...n, battery_pct: 8 } : n,
    );
    const rows = batteryRows(nodes, devices, environment.sensors, NOW);
    expect(rows[0]).toMatchObject({ battery: "18%", batteryTone: "warn" });
    expect(rows[2]).toMatchObject({ battery: "8%", batteryTone: "danger" });
  });

  it("stale: last seen amber, reading text-3 (H10)", () => {
    const { zigbee, devices, environment } = roomState();
    const { sensors } = environment;
    const stale = { ...sensors, temperature: { ...sensors.temperature, stale: true }, humidity: { ...sensors.humidity, stale: true } };
    expect(batteryRows(zigbee.nodes, devices, stale, NOW)[0]).toMatchObject({ readingTone: "faint", lastSeenTone: "warn" });
  });

  it("offline: last seen red `Offline · …`, link —, reading text-3 (H8)", () => {
    const { zigbee, devices, environment } = roomState();
    const nodes = zigbee.nodes.map((n) => (n.friendly_name === "r101_motion" ? { ...n, online: false, last_seen: "2026-10-05T10:37:00Z" } : n));
    expect(batteryRows(nodes, devices, environment.sensors, NOW)[1]).toMatchObject({
      reading: "Detected", readingTone: "faint", link: "—", lastSeen: "Offline · 5 min ago", lastSeenTone: "danger",
    });
  });

  it("no reading ever: reading null (H11)", () => {
    const { zigbee, devices, environment } = roomState();
    const sensors = { ...environment.sensors, contact: { kind: "contact" as const, value: null, node: "r101_door", at: null, stale: false } };
    expect(batteryRows(zigbee.nodes, devices, sensors, NOW)[2]?.reading).toBeNull();
  });

  it("no battery nodes: empty list (S2.E19)", () => {
    const { zigbee, devices, environment } = roomState();
    const routersOnly = zigbee.nodes.filter((n) => n.power_source === "mains");
    expect(batteryRows(routersOnly, devices, environment.sensors, NOW)).toEqual([]);
  });
});
```

**Test:** `battery.view.test.ts` (block above): screenshot rows, 18%/8%, stale, offline, no reading, empty.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): battery rows selector"`

### T16 — Selector: coordinator card (S2.E20)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/side.view.ts`, `apps/kiosk/src/features/devices/side/side.view.test.ts`

**Context:** Screen 02, side column, COORDINATOR: `ZG-808Z`; Chipset `CC2652P1`; Firmware `Z-Stack 3.x.0`; Channel `25`; Transmit `+20 dBm`; Port `zigbee-coord`; Antenna `SMA, external`. H9 offline: values greyed (`faint` = text-3). "starting" keeps normal values (only the header dot is amber).

**Do:**
1. Create `apps/kiosk/src/features/devices/side/side.view.ts`:
```ts
import type { Coordinator } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";

// S2.E20–E23: the side column (H9, H15, R7, R11).

export interface SideRow {
  label: string;
  value: string;
  tone: ValueTone;
}

export interface CoordinatorView {
  model: string;
  /** H9: values greyed while the coordinator is offline. */
  greyed: boolean;
  rows: SideRow[];
}

/** S2.E20: `ZG-808Z`, Chipset … Antenna (values mono, right-aligned). */
export function coordinatorView(coordinator: Coordinator): CoordinatorView {
  const greyed = coordinator.status === "offline";
  const tone: ValueTone = greyed ? "faint" : "default";
  const tx = coordinator.tx_power_dbm;
  return {
    model: coordinator.model,
    greyed,
    rows: [
      { label: "Chipset", value: coordinator.chipset, tone },
      { label: "Firmware", value: coordinator.firmware, tone },
      { label: "Channel", value: String(coordinator.channel), tone },
      { label: "Transmit", value: `${tx >= 0 ? "+" : ""}${tx} dBm`, tone },
      { label: "Port", value: coordinator.port, tone },
      { label: "Antenna", value: coordinator.antenna, tone },
    ],
  };
}
```
2. Create `apps/kiosk/src/features/devices/side/side.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { coordinatorView } from "./side.view";

describe("coordinatorView (S2.E20)", () => {
  it("screenshot 02 values", () => {
    expect(coordinatorView(roomState().zigbee.coordinator)).toEqual({
      model: "ZG-808Z",
      greyed: false,
      rows: [
        { label: "Chipset", value: "CC2652P1", tone: "default" },
        { label: "Firmware", value: "Z-Stack 3.x.0", tone: "default" },
        { label: "Channel", value: "25", tone: "default" },
        { label: "Transmit", value: "+20 dBm", tone: "default" },
        { label: "Port", value: "zigbee-coord", tone: "default" },
        { label: "Antenna", value: "SMA, external", tone: "default" },
      ],
    });
  });
  it("offline greys every value (H9)", () => {
    const view = coordinatorView({ ...roomState().zigbee.coordinator, status: "offline" });
    expect(view.greyed).toBe(true);
    expect(view.rows.every((row) => row.tone === "faint")).toBe(true);
  });
});
```

**Test:** `side.view.test.ts` (block above): screenshot values; offline greys every value.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): coordinator card selector"`

### T17 — Selector: mesh card and joining countdown (S2.E21)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/side.view.ts`, `apps/kiosk/src/features/devices/side/side.view.test.ts`

**Context:** S2.E21: `5` devices paired; Routers `2` (accent, SPEC §3.1 "counts"); End devices `3`; Joining "Closed", or `[INFERRED]` "Open · 4:12 left" in amber counting down on server time (`formatCountdown`, M03; `0:00` once passed, until the server closes it). Coordinator offline (H9) greys the values. Counts are what the coordinator reports (Q4; never counted in the UI).

**Do:**
1. In `apps/kiosk/src/features/devices/side/side.view.ts` replace:
```ts
import type { Coordinator } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";
```
   with:
```ts
import type { Coordinator, Mesh } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";
import { formatCountdown } from "@/lib/format";
```
2. Append to `apps/kiosk/src/features/devices/side/side.view.ts`:
```ts
/** S2.E21 Joining: "Closed", or "Open · 4:12 left" (amber) counting down on server time. */
export function joiningText(joining: Mesh["joining"], now: Date): { text: string; tone: ValueTone } {
  if (joining.state === "closed") return { text: "Closed", tone: "default" };
  const leftS = (Date.parse(joining.until) - now.getTime()) / 1000;
  return { text: `Open · ${formatCountdown(leftS)} left`, tone: "warn" };
}

export interface MeshView {
  paired: string;
  greyed: boolean;
  rows: SideRow[];
}

/** S2.E21: `5` devices paired; Routers `2` (accent), End devices `3`, Joining. Greyed when the coordinator is offline (H9). */
export function meshView(mesh: Mesh, coordinatorStatus: Coordinator["status"], now: Date): MeshView {
  const greyed = coordinatorStatus === "offline";
  const tone = (normal: ValueTone): ValueTone => (greyed ? "faint" : normal);
  const joining = joiningText(mesh.joining, now);
  return {
    paired: String(mesh.paired),
    greyed,
    rows: [
      { label: "Routers", value: String(mesh.routers), tone: tone("accent") },
      { label: "End devices", value: String(mesh.end_devices), tone: tone("default") },
      { label: "Joining", value: joining.text, tone: tone(joining.tone) },
    ],
  };
}
```
3. In `apps/kiosk/src/features/devices/side/side.view.test.ts` replace:
```ts
import { coordinatorView } from "./side.view";
```
   with:
```ts
import { coordinatorView, joiningText, meshView } from "./side.view";
```
4. Append to `apps/kiosk/src/features/devices/side/side.view.test.ts`:
```ts
const NOW = new Date("2026-10-05T10:42:00Z");

describe("joiningText (S2.E21)", () => {
  it("closed", () => {
    expect(joiningText({ state: "closed" }, NOW)).toEqual({ text: "Closed", tone: "default" });
  });
  it("open: `Open · 4:12 left` in amber, counting down", () => {
    const joining = { state: "open" as const, until: "2026-10-05T10:46:12Z" };
    expect(joiningText(joining, NOW)).toEqual({ text: "Open · 4:12 left", tone: "warn" });
    expect(joiningText(joining, new Date("2026-10-05T10:42:01Z")).text).toBe("Open · 4:11 left");
    expect(joiningText(joining, new Date("2026-10-05T10:47:00Z")).text).toBe("Open · 0:00 left");
  });
});

describe("meshView (S2.E21)", () => {
  it("5 paired; routers accent; greyed when the coordinator is offline", () => {
    const { mesh } = roomState().zigbee;
    expect(meshView(mesh, "online", NOW)).toEqual({
      paired: "5",
      greyed: false,
      rows: [
        { label: "Routers", value: "2", tone: "accent" },
        { label: "End devices", value: "3", tone: "default" },
        { label: "Joining", value: "Closed", tone: "default" },
      ],
    });
    expect(meshView(mesh, "offline", NOW).rows.map((r) => r.tone)).toEqual(["faint", "faint", "faint"]);
  });
});
```

**Test:** `side.view.test.ts` (block above): Closed; `Open · 4:12 left` → `4:11` one second later → `0:00` after; mesh rows and greying.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mesh card selector"`

### T18 — Selector: redundancy callout (S2.E22, R7)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/side.view.ts`, `apps/kiosk/src/features/devices/side/side.view.test.ts`

**Context:** S2.E22: both routers online → green "TWO ROUTERS, NO SINGLE PATH" + screenshot copy. One router offline → amber "ONE ROUTER LEFT": "Battery sensors are relying on a single path. Restore the {offline router} soon." (router name = registry name lower-cased, matching the green copy: "the lighting switch"). Decision D7 `[INFERRED]`: no router online (both offline, or coordinator offline) → red "NO ROUTERS ONLINE".

**Do:**
1. In `apps/kiosk/src/features/devices/side/side.view.ts` replace:
```ts
import type { Coordinator, Mesh } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";
import { formatCountdown } from "@/lib/format";
```
   with:
```ts
import type { Coordinator, Device, Mesh, ZigbeeNode } from "@eduscope/contracts";
import type { CalloutVariant, ValueTone } from "@/components/state-styles";
import { formatCountdown } from "@/lib/format";
```
2. Append to `apps/kiosk/src/features/devices/side/side.view.ts`:
```ts
export interface CalloutView {
  variant: CalloutVariant;
  title: string;
  body: string;
}

const REDUNDANT_BODY =
  "Battery sensors can reach the coordinator through either the lighting switch or the projector socket. Losing one still leaves the room reporting.";

/** S2.E22 (R7): routers = mains nodes with role `router`; names from the device registry, lower-cased in the copy. */
export function calloutView(nodes: readonly ZigbeeNode[], devices: readonly Device[]): CalloutView {
  const routers = nodes
    .filter((node) => node.role === "router")
    .map((node) => ({
      name: (devices.find((device) => device.hw_ref === node.friendly_name)?.name ?? node.friendly_name).toLowerCase(),
      online: node.online,
    }));
  const online = routers.filter((router) => router.online).length;
  const offline = routers.filter((router) => !router.online).map((router) => router.name);
  if (online >= 2) return { variant: "redundant", title: "TWO ROUTERS, NO SINGLE PATH", body: REDUNDANT_BODY };
  if (online === 1) {
    const restore = offline.length === 0 ? "" : ` Restore the ${offline.join(" and the ")} soon.`;
    return { variant: "one_left", title: "ONE ROUTER LEFT", body: `Battery sensors are relying on a single path.${restore}` };
  }
  // [INFERRED] SPEC defines only the two variants above; this covers both routers (or the coordinator) down.
  const restore = offline.length === 0 ? "" : ` Restore the ${offline.join(" or the ")}.`;
  return { variant: "none", title: "NO ROUTERS ONLINE", body: `Battery sensors can't reach the coordinator.${restore}` };
}
```
3. In `apps/kiosk/src/features/devices/side/side.view.test.ts` replace:
```ts
import { coordinatorView, joiningText, meshView } from "./side.view";
```
   with:
```ts
import { calloutView, coordinatorView, joiningText, meshView } from "./side.view";
```
4. Append to `apps/kiosk/src/features/devices/side/side.view.test.ts`:
```ts
describe("calloutView (S2.E22, R7)", () => {
  const offline = (names: string[]) => {
    const { zigbee, devices } = roomState();
    return calloutView(zigbee.nodes.map((n) => (names.includes(n.friendly_name) ? { ...n, online: false } : n)), devices);
  };
  it("both routers online: green TWO ROUTERS", () => {
    expect(offline([])).toEqual({
      variant: "redundant",
      title: "TWO ROUTERS, NO SINGLE PATH",
      body: "Battery sensors can reach the coordinator through either the lighting switch or the projector socket. Losing one still leaves the room reporting.",
    });
  });
  it("lighting switch offline: amber ONE ROUTER LEFT naming it", () => {
    expect(offline(["r101_lights"])).toEqual({
      variant: "one_left",
      title: "ONE ROUTER LEFT",
      body: "Battery sensors are relying on a single path. Restore the lighting switch soon.",
    });
  });
  it("projector socket offline names the socket", () => {
    expect(offline(["r101_proj_plug"]).body).toBe("Battery sensors are relying on a single path. Restore the projector socket soon.");
  });
  it("both offline: red NO ROUTERS ONLINE [INFERRED]", () => {
    expect(offline(["r101_lights", "r101_proj_plug"])).toEqual({
      variant: "none",
      title: "NO ROUTERS ONLINE",
      body: "Battery sensors can't reach the coordinator. Restore the lighting switch or the projector socket.",
    });
  });
});
```

**Test:** `side.view.test.ts` (block above): the three variants, and the socket named when it is the one offline.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): redundancy callout selector"`

### T19 — Selector: shutdown interlock (S2.E23, H15)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/side.view.ts`, `apps/kiosk/src/features/devices/side/side.view.test.ts`

**Context:** S2.E23 `[INFERRED]` (Q7): "Armed" (green dot) + `interlock.rule_text` ("Projector mains stays on until draw is below 5 W."); "Holding" (amber) + "Waiting for projector to cool · 112 W" with the live projector watts (H15; `— W` when no reading); "Bypassed" (amber) + "Projector mains can be switched off at any draw." (decision D8, `[INFERRED]`).

**Do:**
1. In `apps/kiosk/src/features/devices/side/side.view.ts` replace:
```ts
import type { Coordinator, Device, Mesh, ZigbeeNode } from "@eduscope/contracts";
import type { CalloutVariant, ValueTone } from "@/components/state-styles";
import { formatCountdown } from "@/lib/format";
```
   with:
```ts
import type { Coordinator, Device, Interlock, Mesh, ZigbeeNode } from "@eduscope/contracts";
import type { CalloutVariant, StateTone, ValueTone } from "@/components/state-styles";
import { formatCountdown, formatWatts } from "@/lib/format";
```
2. Append to `apps/kiosk/src/features/devices/side/side.view.ts`:
```ts
export interface InterlockView {
  tone: StateTone;
  status: "Armed" | "Holding" | "Bypassed";
  body: string;
}

/** S2.E23 (R11, H15, Q7). `watts` = live projector draw (null = no reading). */
export function interlockView(interlock: Interlock, watts: number | null): InterlockView {
  switch (interlock.status) {
    case "armed":
      return { tone: "confirmed", status: "Armed", body: interlock.rule_text };
    case "holding":
      return { tone: "warning", status: "Holding", body: `Waiting for projector to cool · ${formatWatts(watts)}` };
    case "bypassed":
      // [INFERRED] SPEC names the state only (Q7).
      return { tone: "warning", status: "Bypassed", body: "Projector mains can be switched off at any draw." };
  }
}
```
3. In `apps/kiosk/src/features/devices/side/side.view.test.ts` replace:
```ts
import { calloutView, coordinatorView, joiningText, meshView } from "./side.view";
```
   with:
```ts
import { calloutView, coordinatorView, interlockView, joiningText, meshView } from "./side.view";
```
4. Append to `apps/kiosk/src/features/devices/side/side.view.test.ts`:
```ts
describe("interlockView (S2.E23, H15)", () => {
  it("armed shows the rule", () => {
    expect(interlockView(roomState().interlock, 287)).toEqual({
      tone: "confirmed", status: "Armed", body: "Projector mains stays on until draw is below 5 W.",
    });
  });
  it("holding: `Waiting for projector to cool · 112 W`", () => {
    expect(interlockView({ ...roomState().interlock, status: "holding" }, 112)).toEqual({
      tone: "warning", status: "Holding", body: "Waiting for projector to cool · 112 W",
    });
    expect(interlockView({ ...roomState().interlock, status: "holding" }, null).body).toBe("Waiting for projector to cool · — W");
  });
  it("bypassed is amber", () => {
    expect(interlockView({ ...roomState().interlock, status: "bypassed" }, 3)).toMatchObject({ tone: "warning", status: "Bypassed" });
  });
});
```

**Test:** `side.view.test.ts` (block above): armed, holding (with and without a reading), bypassed.

**Verify:** `pnpm --filter @eduscope/kiosk test` → all files pass (the new cases included); then `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): shutdown interlock selector"`

### T20 — `CoordinatorStatus` header item (S2.E3)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/header/CoordinatorStatus.tsx`

**Context:** Screen 02 header right: "● Coordinator online" (dot + text-2 caption). Not a control (S2.E3 "On tap: Nothing"), so no pressed state. Text colour per tone from `HEADER_LINE_CLASS` (confirmed → text-2, warning → warn, offline → danger, unknown → text-3). **Phone (<600):** dot only; the text stays as `sr-only` (`sr-only sm:not-sr-only`). States: Connecting… (hollow ring), online, starting…, offline. It is placed in the header by T21.

**Do:**
1. Create `apps/kiosk/src/features/devices/header/CoordinatorStatus.tsx`:
```tsx
import { StateDot } from "@/components/StateDot";
import { HEADER_LINE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { coordinatorStatusView } from "./coordinator-status.view";

/** S2.E3 (not a control). ≥600: dot + text. Phone: the dot only (SPEC §2.2); the text stays for screen readers. */
export function CoordinatorStatus() {
  const view = coordinatorStatusView(useRoomState((state) => state.zigbee.coordinator.status));
  return (
    <p className={cn("flex min-h-12 shrink-0 items-center gap-2 px-2 text-caption", HEADER_LINE_CLASS[view.tone])}>
      <StateDot tone={view.tone} />
      <span className="sr-only whitespace-nowrap sm:not-sr-only">{view.text}</span>
    </p>
  );
}
```

**Test:** None (markup).

**Verify:** `pnpm verify` → exit 0 (not on screen yet).

**Commit:** `git commit -m "feat(kiosk): coordinator status header item"`

### T21 — Header variant for `/devices` (S2.E1–E4)
- [ ] done

**Files:** `apps/kiosk/src/app/Header.tsx`

**Context:** Screen 02 header: "← Controls" button, title "Zigbee devices", right: "● Coordinator online" + "Settings". Decision D2: one `Header` (ARCHITECTURE §4.1) picks its content with `useMatch("/devices")`; the S2 content lives in `app/Header.tsx` because it reuses `HEADER_BUTTON_CLASS` and `SettingsButton` (S2.E4 "As S1.E7": technician → `/settings/remote`, else S4 technician PIN first — the M03 gate). Features may not import `app/`, so only `CoordinatorStatus` comes from `features/devices`. S2 has no room chip, clock or Lock (SPEC S2 lists E1–E4 only).

Layout: same 56px (`h-14`) / 64px (`sm:h-16`) sticky row. Back link = `HEADER_BUTTON_CLASS` + `px-3`, arrow icon + label "Controls" at **every** width (SPEC §2.2 phone: icon + label). Title: `text-card-title` (16px) bold on the phone so the row fits 390px, `sm:text-title` (22px) from 600; `truncate`. Right group: `CoordinatorStatus` + `SettingsButton` (label from `lg`, icon below — unchanged). Phone budget at 390: 16 + back 113 + 8 + title ~115 + 8 + dot 26 + 4 + Settings 48 + 16 ≈ 354 ≤ 390.

**Do:**
The S1 content moves unchanged into `ControlHeaderContent`.

1. Replace the whole file `apps/kiosk/src/app/Header.tsx`:
```tsx
import { ArrowLeft, Settings, Wifi, type LucideIcon } from "lucide-react";
import { Link, useMatch, useNavigate } from "react-router";
import { kioskEnv } from "@/data/env";
import { useRequireAccess, useRoomState } from "@/data/hooks";
import { CoordinatorStatus } from "@/features/devices/header/CoordinatorStatus";
import { HeaderLockButton } from "@/features/session/HeaderLockButton";
import { formatDate, formatTime } from "@/lib/format";
import { useServerNow } from "@/lib/server-time";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { StatusIndicator } from "./StatusIndicator";

const HEADER_BUTTON_CLASS =
  "flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-btn border border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 lg:px-4";

function HeaderLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const pressed = usePressed();
  return (
    <Link to={to} aria-label={label} {...pressed} className={HEADER_BUTTON_CLASS}>
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="hidden whitespace-nowrap lg:inline">{label}</span>
    </Link>
  );
}

/** S1.E7: technician → S3; otherwise S4 (technician PIN) first. Cancel stays where you are. */
function SettingsButton() {
  const pressed = usePressed();
  const { ensure } = useRequireAccess("technician");
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label="Settings"
      {...pressed}
      onClick={() => {
        void ensure().then((granted) => {
          if (granted) void navigate("/settings/remote");
        });
      }}
      className={HEADER_BUTTON_CLASS}
    >
      <Settings aria-hidden="true" className="size-5 shrink-0" />
      <span className="hidden whitespace-nowrap lg:inline">Settings</span>
    </button>
  );
}

/** S2.E1–E4. Phone: back "Controls" keeps its label, the title shrinks to 16px, dot only, Settings icon (SPEC §2.2). */
function DevicesHeaderContent() {
  const pressed = usePressed();
  return (
    <>
      <Link to="/" {...pressed} className={cn(HEADER_BUTTON_CLASS, "px-3")}>
        <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
        <span className="whitespace-nowrap">Controls</span>
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-card-title font-bold text-text-1 sm:text-title">Zigbee devices</h1>
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3">
        <CoordinatorStatus />
        <SettingsButton />
      </div>
    </>
  );
}

/** S1.E1–E8. Phone (<600): one 56px row (SPEC §2.2). */
function ControlHeaderContent() {
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const now = useServerNow();

  return (
    <>
      {/* Phone: two short lines so the row fits status, R-101, Devices, Settings and Lock (SPEC §2.2). */}
      <p className="flex min-w-0 flex-1 flex-col text-caption font-bold text-text-1 sm:block sm:truncate sm:text-wordmark">
        eduscope <span className="tracking-wordmark text-brand">CENTRAL</span>
      </p>

      <div className="hidden items-baseline gap-3 lg:flex" aria-label="Controller time">
        {now === null ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <>
            <time className="font-mono text-clock font-semibold text-text-1">{formatTime(now)}</time>
            <span className="font-mono text-date text-text-2">{formatDate(now)}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3 lg:flex-1">
        <StatusIndicator />
        <span className="flex h-10 shrink-0 items-center whitespace-nowrap rounded-chip border border-border-strong bg-control px-2 font-mono text-card-title font-semibold text-text-1 sm:h-12 sm:px-3">
          {roomId}
        </span>
        <HeaderLink to="/devices" icon={Wifi} label="Devices" />
        <SettingsButton />
        <HeaderLockButton />
      </div>
    </>
  );
}

/** One header (ARCHITECTURE §4.1); `/devices` gets the S2 variant. */
export function Header() {
  const onDevices = useMatch("/devices") !== null;
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
      {onDevices ? <DevicesHeaderContent /> : <ControlHeaderContent />}
    </header>
  );
}
```

**Test:** None (markup; the gate logic is M03's, already tested).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. At 1280: header reads "← Controls | Zigbee devices … ● Coordinator online | ⚙ Settings"; "← Controls" goes to `/`; Settings opens "Technician PIN" (enter `123456` → `/settings/remote`). `/` still shows the S1 header (clock, status, R-101, Devices, Settings). At 390: back with label, title, dot, gear; `document.documentElement.scrollWidth === 390`. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): devices header variant"`

### T22 — `DevicesPage` grid: main ~75% + side ~25%
- [ ] done

**Files:** `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** SPEC S2 layout + §2.2 + ARCHITECTURE §4.1: ≥1024 two columns 3:1 with a 16px gap (`gap-4`); below 1024 one column and the side column drops under the main one. Tracks are `minmax(0,3fr) minmax(0,1fr)` (decision D13: plain `3fr_1fr` lets long content, e.g. "Offline · last seen 5 min ago", shift the split by ~12px). Section labels "MAINS POWERED — ROUTERS" and "BATTERY — END DEVICES" (`SectionLabel`, uppercase by CSS; the battery label gets `mt-3` = 24px above, as in screen 02). The page gutter comes from `AppShell` (`px-4` / `lg:px-6`). DOM order is the phone order. Cards are added by T25–T32. The S2 page may scroll at 1280×800 (decision D15).

**Do:**
1. Replace the whole file `apps/kiosk/src/features/devices/DevicesPage.tsx`:
```tsx
import { SectionLabel } from "@/components/SectionLabel";

// SPEC S2 / §2.2 / ARCHITECTURE §4.1: ≥1024 main ~75% + side ~25%; below, the side column drops under
// the main one. DOM order = phone order: routers → battery → coordinator → mesh → callout → interlock.
export function DevicesPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <SectionLabel>Mains powered — routers</SectionLabel>
        <SectionLabel className="mt-3">Battery — end devices</SectionLabel>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
      </div>
    </div>
  );
}
```

**Test:** None (layout).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. Two section labels at the left; the placeholder text is gone. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): devices page grid"`

### T23 — `RouterCardHeader`
- [ ] done

**Files:** `apps/kiosk/src/features/devices/routers/RouterCardHeader.tsx`

**Context:** Screen 02, each router card's top row. Left: `StateDot` (green / red) · title `text-card-title font-semibold text-1` over ids `font-mono text-caption text-3`. Right: badge "Router" (`rounded-chip bg-badge-router-fill px-2 py-1 text-caption font-semibold text-badge-router-text`, SPEC §3.1 `badge-router`) and `LQI 214` (`font-mono text-caption text-2`) or, offline, `Offline · last seen 5 min ago` in `TEXT_CLASS.offline`. `flex-wrap`: on the phone the right group wraps under the title, indented `pl-5.5` (22px = dot + gap), `sm:pl-0`. Loading (H1): skeleton dot + two bars. States: loading, online, offline.

**Do:**
1. Create `apps/kiosk/src/features/devices/routers/RouterCardHeader.tsx`:
```tsx
import { StateDot } from "@/components/StateDot";
import { TEXT_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import type { RouterHeaderView } from "./routers.view";

/**
 * S2.E6/E10: dot · title over `model · friendly name` (mono) · "Router" badge · `LQI 214`.
 * Offline: red dot and "Offline · last seen 5 min ago" in place of the LQI. Phone: badge + LQI wrap
 * below the title, indented to the title (dot 10 + gap 12 = 22px = `pl-5.5`).
 */
export function RouterCardHeader({ view }: { view: RouterHeaderView | null }) {
  if (view === null) {
    return (
      <div className="flex items-start gap-3">
        <Skeleton className="mt-1.5 size-2.5 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-start gap-3">
        <StateDot tone={view.tone} className="mt-1.5" />
        <div className="flex min-w-0 flex-col">
          <h3 className="text-card-title font-semibold text-text-1">{view.title}</h3>
          <p className="break-all font-mono text-caption text-text-3">{view.ids}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 pl-5.5 sm:pl-0">
        <span className="rounded-chip bg-badge-router-fill px-2 py-1 text-caption font-semibold text-badge-router-text">Router</span>
        <span className={cn("font-mono text-caption", view.online ? "text-text-2" : TEXT_CLASS.offline)}>{view.link}</span>
      </div>
    </div>
  );
}
```

**Test:** None (markup).

**Verify:** `pnpm verify` → exit 0 (shown by T25).

**Commit:** `git commit -m "feat(kiosk): router card header"`

### T24 — `GangTile` (read-only On/Off tile)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/routers/GangTile.tsx`

**Context:** Screen 02: "Front of room — On" (green fill + 2px green border, green dot, "On" green), "Rear of room — Off" (`control` fill, `border-strong`, grey dot, "Off" text-3), "Mains to projector — On". Decision D16: not a control (Q11) → a `div`, no pressed state, `min-h-12`. Classes come from `state-styles.ts` (`ACTIVE_CONTROL_CLASS.confirmed` / `.assumed`, `INACTIVE_CONTROL_CLASS`, `TEXT_CLASS`). States: loading (skeleton `h-12`), On, Off, Unknown, assumed On (amber fill), greyed (`GREYED_CLASS`) when the router is offline (H8: last known state, greyed).

**Do:**
1. Create `apps/kiosk/src/features/devices/routers/GangTile.tsx`:
```tsx
import type { Observed } from "@eduscope/contracts";
import { StateDot } from "@/components/StateDot";
import { ACTIVE_CONTROL_CLASS, GREYED_CLASS, INACTIVE_CONTROL_CLASS, TEXT_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { gangTileView } from "./routers.view";

/**
 * S2.E7/E8/E11: read-only On/Off tile (Q11: no control on S2, so no pressed state and no 48px rule).
 * On = green fill + border, green dot, "On". Off = neutral, grey dot, "Off" text-3. `greyed` = the
 * router is offline: last known state, greyed (H8). `state` undefined = no snapshot (H1).
 */
export function GangTile({ label, state, greyed }: { label: string; state: Observed<boolean> | undefined; greyed: boolean }) {
  if (state === undefined) return <Skeleton className="h-12 rounded-btn" />;
  const view = gangTileView(state);
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-btn border-2 px-4 py-2",
        view.fill === null ? INACTIVE_CONTROL_CLASS : ACTIVE_CONTROL_CLASS[view.fill],
        greyed && GREYED_CLASS,
      )}
    >
      <StateDot tone={view.tone} />
      <span className="min-w-0 flex-1 text-card-title font-semibold text-text-1">{label}</span>
      <span className={cn("text-caption font-semibold", TEXT_CLASS[view.tone])}>{view.text}</span>
    </div>
  );
}
```

**Test:** None (markup).

**Verify:** `pnpm verify` → exit 0 (shown by T25).

**Commit:** `git commit -m "feat(kiosk): read-only gang tile"`

### T25 — `LightingSwitchCard` (S2.E6–E9)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/routers/LightingSwitchCard.tsx`, `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** Screen 02, main column, first card. `Card` (solid; `danger` variant when the switch is offline, SPEC §3.4) with `flex flex-col gap-3`: `RouterCardHeader`, the two gang tiles (`grid grid-cols-1 gap-3 sm:grid-cols-2` — decision D12: two tiles side by side don't fit 390px, so they stack below 600), caption S2.E9 in `text-caption text-2`. Data: device `lights`, its node, `environment.lights.front/rear`. `now` from `useServerNow()` (shared ticker, T1), falling back to `server_time` before the clock syncs. States: loading, online, offline (red dot, "Offline · last seen 5 min ago", tiles greyed, danger border).

**Do:**
1. Create `apps/kiosk/src/features/devices/routers/LightingSwitchCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { GangTile } from "./GangTile";
import { RouterCardHeader } from "./RouterCardHeader";
import { routerHeaderView } from "./routers.view";

const DEVICE_ID = "lights";

/** S2.E6–E9. Gang tiles side by side from 600px, stacked on the phone. Offline → danger border (SPEC §3.4). */
export function LightingSwitchCard() {
  const now = useServerNow();
  const data = useRoomState((s) => ({
    device: s.devices.find((d) => d.id === DEVICE_ID),
    nodes: s.zigbee.nodes,
    lights: s.environment.lights,
    serverTime: s.server_time,
  }));
  const device = data?.device;
  const header =
    data === undefined || device === undefined
      ? null
      : routerHeaderView(device, data.nodes.find((n) => n.friendly_name === device.hw_ref), now ?? new Date(data.serverTime));
  const offline = header !== null && !header.online;

  return (
    <Card variant={offline ? "danger" : "solid"} className="flex flex-col gap-3">
      <RouterCardHeader view={header} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GangTile label="Front of room" state={data?.lights.front} greyed={offline} />
        <GangTile label="Rear of room" state={data?.lights.rear} greyed={offline} />
      </div>
      <p className="text-caption text-text-2">
        Wired with neutral, so it carries the mesh for every battery sensor in the room. The wall plate still works by
        hand if the network stops.
      </p>
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
import { SectionLabel } from "@/components/SectionLabel";
```
   with:
```tsx
import { SectionLabel } from "@/components/SectionLabel";
import { LightingSwitchCard } from "./routers/LightingSwitchCard";
```
3. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
        <SectionLabel>Mains powered — routers</SectionLabel>
```
   with:
```tsx
        <SectionLabel>Mains powered — routers</SectionLabel>
        <LightingSwitchCard />
```

**Test:** None (markup; logic tested in T11/T12).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. 1280: matches screen 02's Lighting switch card (green dot, `ZBM5-2C-86W · r101_lights`, Router, `LQI 214`, Front On green / Rear Off). Panel "Toggle lights offline": red dot, "Offline · last seen 5 min ago", tiles greyed, red border; again → back. 390: tiles stacked, badge + LQI under the title. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): lighting switch card"`

### T26 — `ProjectorSocketCard` (S2.E10–E13)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/routers/ProjectorSocketCard.tsx`, `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** Screen 02, main column, second card: header (`S60ZBTPG · r101_proj_plug`, `LQI 231`), full-width tile "Mains to projector" (`display.projector.mains`), four `MetricTile`s (`grid grid-cols-2 gap-4 sm:grid-cols-4`: 2×2 on the phone per SPEC §2.2, one row from 600), caption S2.E13. States: loading (tiles `loading`), fresh (`287 W` green), stale (T4 age), no reading ("—" + "No reading yet"), offline (danger border, tile + metrics `GREYED_CLASS`).

**Do:**
1. Create `apps/kiosk/src/features/devices/routers/ProjectorSocketCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { GREYED_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { GangTile } from "./GangTile";
import { RouterCardHeader } from "./RouterCardHeader";
import { routerHeaderView, socketMetricsView } from "./routers.view";

const DEVICE_ID = "projector_socket";
const METRIC_LABELS = ["Power", "Voltage", "Today", "Rating"] as const;

/** S2.E10–E13. Metrics: one row of four from 600px, 2×2 on the phone (SPEC §2.2). */
export function ProjectorSocketCard() {
  const now = useServerNow();
  const data = useRoomState((s) => ({
    device: s.devices.find((d) => d.id === DEVICE_ID),
    nodes: s.zigbee.nodes,
    mains: s.display.projector.mains,
    power: s.display.projector.power,
    serverTime: s.server_time,
  }));
  const device = data?.device;
  const at = data === undefined ? null : (now ?? new Date(data.serverTime));
  const header =
    data === undefined || device === undefined || at === null
      ? null
      : routerHeaderView(device, data.nodes.find((n) => n.friendly_name === device.hw_ref), at);
  const metrics = data === undefined || at === null ? null : socketMetricsView(data.power, at);
  const offline = header !== null && !header.online;

  return (
    <Card variant={offline ? "danger" : "solid"} className="flex flex-col gap-3">
      <RouterCardHeader view={header} />
      <GangTile label="Mains to projector" state={data?.mains} greyed={offline} />
      <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", offline && GREYED_CLASS)}>
        {metrics === null
          ? METRIC_LABELS.map((label) => <MetricTile key={label} label={label} value={null} loading />)
          : metrics.map((m) => <MetricTile key={m.label} label={m.label} value={m.value} tone={m.tone} staleAgo={m.staleAgo} />)}
      </div>
      <p className="text-caption text-text-2">
        The power reading is what turns the projector from a guess into a fact. Above about 50 W it is running; below 5 W
        it is in standby.
      </p>
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
import { LightingSwitchCard } from "./routers/LightingSwitchCard";
```
   with:
```tsx
import { LightingSwitchCard } from "./routers/LightingSwitchCard";
import { ProjectorSocketCard } from "./routers/ProjectorSocketCard";
```
3. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
        <LightingSwitchCard />
```
   with:
```tsx
        <LightingSwitchCard />
        <ProjectorSocketCard />
```

**Test:** None (markup; logic tested in T11/T13).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. 1280: `287 W` green · `231 V` · `1.84 kWh` · `13 A` in one row. Panel "Toggle power meter offline": red dot, "Offline · last seen …", metrics greyed. Panel "Toggle interlock holding": `112 W`. 390: metrics 2×2. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): projector socket card"`

### T27 — `BatteryList` table (≥600px) with loading and empty states
- [ ] done

**Files:** `apps/kiosk/src/features/devices/battery/BatteryList.tsx`, `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** Screen 02, BATTERY — END DEVICES table: header row on `surface` (`text-section uppercase text-2`, DEVICE · READING · BATTERY · LINK · LAST SEEN), rows on `surface-2` with a top `border`. Device cell: name `text-card-title font-semibold text-1` over ids `font-mono text-caption text-3`. READING `font-mono text-card-title font-semibold` in the row tone (Detected green, stale/offline text-3; null → "—" + "No reading yet" H11). BATTERY / LINK mono caption (battery tone from T14; link text-2, "—" text-3). LAST SEEN caption in its tone (text-2 / warn / danger). Narrow columns: `w-24`, `w-20`, `w-40`. Table wrapper: `hidden sm:block` + `rounded-card border bg-surface overflow-hidden`. Loading (H1): a card with three `h-10` skeletons. Empty (S2.E19): a card with "No battery devices paired" (`text-caption text-2`) at every width. **Below 600 the list is empty until T28.**

**Do:**
1. Create `apps/kiosk/src/features/devices/battery/BatteryList.tsx`:
```tsx
import { Card } from "@/components/Card";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { batteryRows, type BatteryRowView } from "./battery.view";

/** READING cell: the value, or H11 "—" + "No reading yet". */
function Reading({ row }: { row: BatteryRowView }) {
  if (row.reading === null) {
    return (
      <span className="flex flex-col font-mono text-card-title font-semibold text-text-3">
        —<span className="font-sans text-caption font-normal">No reading yet</span>
      </span>
    );
  }
  return <span className={cn("font-mono text-card-title font-semibold", VALUE_TONE_CLASS[row.readingTone])}>{row.reading}</span>;
}

/**
 * S2.E14–E19. ≥600: a table (DEVICE · READING · BATTERY · LINK · LAST SEEN). <600: one card per device
 * (line 1 name + reading, line 2 model · friendly name, line 3 battery · link · last seen). Two markups
 * of the same rows in one component: allowed for tables only (ARCHITECTURE §4.1).
 */
export function BatteryList() {
  const now = useServerNow();
  const data = useRoomState((s) => ({ nodes: s.zigbee.nodes, devices: s.devices, sensors: s.environment.sensors, serverTime: s.server_time }));
  const rows = data === undefined ? null : batteryRows(data.nodes, data.devices, data.sensors, now ?? new Date(data.serverTime));

  if (rows === null) {
    return (
      <Card className="flex flex-col gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-caption text-text-2">No battery devices paired</p>
      </Card>
    );
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-border bg-surface sm:block">
        <table className="w-full text-left">
          <thead>
            <tr className="text-section uppercase text-text-2">
              <th scope="col" className="px-4 py-3 font-bold">Device</th>
              <th scope="col" className="px-4 py-3 font-bold">Reading</th>
              <th scope="col" className="w-24 px-4 py-3 font-bold">Battery</th>
              <th scope="col" className="w-20 px-4 py-3 font-bold">Link</th>
              <th scope="col" className="w-40 px-4 py-3 font-bold">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border bg-surface-2">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="block text-card-title font-semibold text-text-1">{row.name}</span>
                  <span className="block font-mono text-caption text-text-3">{row.ids}</span>
                </th>
                <td className="px-4 py-3">
                  <Reading row={row} />
                </td>
                <td className={cn("px-4 py-3 font-mono text-caption", VALUE_TONE_CLASS[row.batteryTone])}>{row.battery}</td>
                <td className={cn("px-4 py-3 font-mono text-caption", row.link === "—" ? "text-text-3" : "text-text-2")}>{row.link}</td>
                <td className={cn("px-4 py-3 text-caption", VALUE_TONE_CLASS[row.lastSeenTone])}>{row.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```
2. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
import { SectionLabel } from "@/components/SectionLabel";
```
   with:
```tsx
import { SectionLabel } from "@/components/SectionLabel";
import { BatteryList } from "./battery/BatteryList";
```
3. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
        <SectionLabel className="mt-3">Battery — end devices</SectionLabel>
```
   with:
```tsx
        <SectionLabel className="mt-3">Battery — end devices</SectionLabel>
        <BatteryList />
```

**Test:** None (markup; logic tested in T14/T15).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. 1280: rows Room climate `26.4° · 61%` `98%` `168` `12s ago` (counting up each second), Motion "Detected" green, Door "Closed". Panel "Climate battery 18%" → `18%` amber; "Climate battery 8%" → `8%` red; "Toggle climate stale" → reading grey, last seen `14 min ago` amber. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): battery table"`

### T28 — `BatteryList` phone cards (<600px)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/battery/BatteryList.tsx`

**Context:** SPEC §2.2 phone: one card per device — line 1 name + reading (reading right-aligned, same font/tone as the table), line 2 `model · friendly name` (mono text-3, `break-all`), line 3 "Battery 98% · Link 168 · 12s ago" (decision D5: labels text-3, values in their tones). `ul.sm:hidden`, cards `rounded-card border bg-surface p-4`, `gap-3` between cards. Same `rows` as the table (ARCHITECTURE §4.1: two markups in one component, tables only).

**Do:**
1. In `apps/kiosk/src/features/devices/battery/BatteryList.tsx` replace:
```tsx
        </table>
      </div>
    </>
```
   with:
```tsx
        </table>
      </div>
      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-card-title font-semibold text-text-1">{row.name}</span>
              <Reading row={row} />
            </div>
            <p className="break-all font-mono text-caption text-text-3">{row.ids}</p>
            <p className="flex flex-wrap gap-x-2 text-caption text-text-3">
              <span>
                Battery <span className={cn("font-mono", VALUE_TONE_CLASS[row.batteryTone])}>{row.battery}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Link <span className="font-mono text-text-2">{row.link}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className={VALUE_TONE_CLASS[row.lastSeenTone]}>{row.lastSeen}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
```

**Test:** None (markup).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. 390×844: three cards, each 3 lines; no horizontal scroll; at 600 the table is back. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): battery cards on phone"`

### T29 — `CoordinatorCard` (S2.E20)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/CoordinatorCard.tsx`, `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** Screen 02, side column top: label "COORDINATOR" (`text-section font-bold uppercase text-2`), model `ZG-808Z` (`font-mono text-card-title font-semibold`), six `KeyValueRow`s (M02: label text-2 left, value mono right). States: loading (skeleton model + loading rows), online, offline (model and values text-3, H9).

**Do:**
1. Create `apps/kiosk/src/features/devices/side/CoordinatorCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { KeyValueRow } from "@/components/KeyValueRow";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { coordinatorView } from "./side.view";

const LABELS = ["Chipset", "Firmware", "Channel", "Transmit", "Port", "Antenna"] as const;

/** S2.E20. Offline → every value text-3 (H9). */
export function CoordinatorCard() {
  const coordinator = useRoomState((s) => s.zigbee.coordinator);
  const view = coordinator === undefined ? null : coordinatorView(coordinator);
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-section font-bold uppercase text-text-2">Coordinator</h3>
      {view === null ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className={cn("font-mono text-card-title font-semibold", VALUE_TONE_CLASS[view.greyed ? "faint" : "default"])}>{view.model}</p>
      )}
      <div className="flex flex-col">
        {view === null
          ? LABELS.map((label) => <KeyValueRow key={label} label={label} value={null} loading />)
          : view.rows.map((row) => <KeyValueRow key={row.label} label={row.label} value={row.value} tone={row.tone} />)}
      </div>
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
import { ProjectorSocketCard } from "./routers/ProjectorSocketCard";
```
   with:
```tsx
import { ProjectorSocketCard } from "./routers/ProjectorSocketCard";
import { CoordinatorCard } from "./side/CoordinatorCard";
```
3. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
      <div className="flex min-w-0 flex-col gap-3">
      </div>
```
   with:
```tsx
      <div className="flex min-w-0 flex-col gap-3">
        <CoordinatorCard />
      </div>
```

**Test:** None (markup; logic tested in T16).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. 1280: matches screen 02's COORDINATOR card. Panel "Toggle coordinator offline": values grey, header "Coordinator offline" red. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): coordinator card"`

### T30 — `MeshCard` (S2.E21)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/MeshCard.tsx`, `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** Screen 02: "MESH", big `5` (`font-mono text-value font-semibold`) + "devices paired" (`text-caption text-2`), rows Routers `2` (accent), End devices `3`, Joining `Closed`. Uses `useServerNow()` so "Open · 4:12 left" counts down each second from the shared ticker. States: loading, closed, open (amber countdown), greyed (coordinator offline).

**Do:**
1. Create `apps/kiosk/src/features/devices/side/MeshCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { KeyValueRow } from "@/components/KeyValueRow";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { meshView } from "./side.view";

const LABELS = ["Routers", "End devices", "Joining"] as const;

/** S2.E21. "Open · 4:12 left" counts down every second on server time (shared ticker). */
export function MeshCard() {
  const now = useServerNow();
  const data = useRoomState((s) => ({ mesh: s.zigbee.mesh, status: s.zigbee.coordinator.status, serverTime: s.server_time }));
  const view = data === undefined ? null : meshView(data.mesh, data.status, now ?? new Date(data.serverTime));
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-section font-bold uppercase text-text-2">Mesh</h3>
      {view === null ? (
        <Skeleton className="h-7 w-32" />
      ) : (
        <p className="flex items-baseline gap-2">
          <span className={cn("font-mono text-value font-semibold", VALUE_TONE_CLASS[view.greyed ? "faint" : "default"])}>{view.paired}</span>
          <span className="text-caption text-text-2">devices paired</span>
        </p>
      )}
      <div className="flex flex-col">
        {view === null
          ? LABELS.map((label) => <KeyValueRow key={label} label={label} value={null} loading />)
          : view.rows.map((row) => <KeyValueRow key={row.label} label={row.label} value={row.value} tone={row.tone} />)}
      </div>
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
import { CoordinatorCard } from "./side/CoordinatorCard";
```
   with:
```tsx
import { CoordinatorCard } from "./side/CoordinatorCard";
import { MeshCard } from "./side/MeshCard";
```
3. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
        <CoordinatorCard />
```
   with:
```tsx
        <CoordinatorCard />
        <MeshCard />
```

**Test:** None (markup; logic tested in T17).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. Panel "Open joining (4:12)": Joining "Open · 4:12 left" in amber, then 4:11, 4:10…. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mesh card"`

### T31 — `RedundancyCallout` (S2.E22)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/RedundancyCallout.tsx`, `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** Screen 02: green-bordered callout (`CALLOUT_BOX_CLASS` / `CALLOUT_TITLE_CLASS` from T3), title `text-section font-bold uppercase`, body `text-caption text-1`, `rounded-card border p-4`. States: loading (skeleton `h-28`), redundant (green), one left (amber), none (red).

**Do:**
1. Create `apps/kiosk/src/features/devices/side/RedundancyCallout.tsx`:
```tsx
import { CALLOUT_BOX_CLASS, CALLOUT_TITLE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { calloutView } from "./side.view";

/** S2.E22 (R7): green "TWO ROUTERS, NO SINGLE PATH"; amber "ONE ROUTER LEFT"; red "NO ROUTERS ONLINE" [INFERRED]. */
export function RedundancyCallout() {
  const data = useRoomState((s) => ({ nodes: s.zigbee.nodes, devices: s.devices }));
  if (data === undefined) return <Skeleton className="h-28 rounded-card" />;
  const view = calloutView(data.nodes, data.devices);
  return (
    <section className={cn("flex flex-col gap-2 rounded-card border p-4", CALLOUT_BOX_CLASS[view.variant])}>
      <h3 className={cn("text-section font-bold uppercase", CALLOUT_TITLE_CLASS[view.variant])}>{view.title}</h3>
      <p className="text-caption text-text-1">{view.body}</p>
    </section>
  );
}
```
2. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
import { MeshCard } from "./side/MeshCard";
```
   with:
```tsx
import { MeshCard } from "./side/MeshCard";
import { RedundancyCallout } from "./side/RedundancyCallout";
```
3. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
        <MeshCard />
```
   with:
```tsx
        <MeshCard />
        <RedundancyCallout />
```

**Test:** None (markup; logic tested in T18).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. Green "TWO ROUTERS, NO SINGLE PATH". Panel "Toggle lights offline" → amber "ONE ROUTER LEFT … Restore the lighting switch soon." Plus "Toggle power meter offline" → red "NO ROUTERS ONLINE". `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): redundancy callout"`

### T32 — `InterlockCard` (S2.E23)
- [ ] done

**Files:** `apps/kiosk/src/features/devices/side/InterlockCard.tsx`, `apps/kiosk/src/features/devices/DevicesPage.tsx`

**Context:** Screen 02 (cut off at the bottom): "SHUTDOWN INTERLOCK" card. `ObservedLine` (M02) with the status word and dot (Armed green / Holding amber / Bypassed amber, `font-semibold`), body `text-caption text-2`. States: loading (skeleton line), armed, holding, bypassed.

**Do:**
1. Create `apps/kiosk/src/features/devices/side/InterlockCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { ObservedLine } from "@/components/ObservedLine";
import { useRoomState } from "@/data/hooks";
import { interlockView } from "./side.view";

/** S2.E23 (R11, H15, Q7): Armed (green) + rule; Holding (amber) + "Waiting for projector to cool · 112 W"; Bypassed (amber). */
export function InterlockCard() {
  const data = useRoomState((s) => ({ interlock: s.interlock, watts: s.display.projector.power.value?.watts ?? null }));
  const view = data === undefined ? null : interlockView(data.interlock, data.watts);
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-section font-bold uppercase text-text-2">Shutdown interlock</h3>
      <ObservedLine tone={view?.tone ?? "unknown"} text={view?.status ?? ""} loading={view === null} className="font-semibold" />
      {view !== null && <p className="text-caption text-text-2">{view.body}</p>}
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
import { CoordinatorCard } from "./side/CoordinatorCard";
```
   with:
```tsx
import { CoordinatorCard } from "./side/CoordinatorCard";
import { InterlockCard } from "./side/InterlockCard";
```
3. In `apps/kiosk/src/features/devices/DevicesPage.tsx` replace:
```tsx
        <RedundancyCallout />
```
   with:
```tsx
        <RedundancyCallout />
        <InterlockCard />
```

**Test:** None (markup; logic tested in T19).

**Verify:** Dev server: `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/devices?mock-panel`. "● Armed" + rule. Panel "Toggle interlock holding" → "● Holding" amber, "Waiting for projector to cool · 112 W". "Toggle interlock bypassed" → "● Bypassed". `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): shutdown interlock card"`

### T33 — Acceptance walk-through (M05 criteria)
- [ ] done

**Files:** this plan file only (tick the boxes below; write any failure under `## Blockers` and stop).

**Context:** Every M05 acceptance criterion with its exact check. Start once: `pnpm --filter @eduscope/kiosk dev`.
Use Chromium DevTools device mode (1280×800; 390×844 with touch). Console one-liners are pasted into DevTools.
"Panel" = the mock panel (`?mock-panel`); collapse it ("Mock panel −") before comparing layouts. Panel actions are
toggles unless their label says otherwise; reload the page to get back to screenshot 02.

**Do:** check each item; tick it when it holds.

- [ ] **AC1 — 1280×800 matches screenshot 02.** Open `/devices?mock-panel`, collapse the panel. Compare with
  `reference/screens/02-devices-zigbee.png.png`: main column ≈75% with "MAINS POWERED — ROUTERS", Lighting switch and
  Projector socket cards, "BATTERY — END DEVICES" table; side column with COORDINATOR, MESH, "TWO ROUTERS, NO SINGLE
  PATH", SHUTDOWN INTERLOCK. Console:
  `[...document.querySelectorAll("main > div > div")].map(e=>Math.round(e.getBoundingClientRect().width))` →
  `[901, 300]` (±2). Expected differences: the page scrolls ~50px at 800 tall (decision D15; screenshot 02 is cropped
  too); gang tiles are 48px tall.
- [ ] **AC2 — navigation.** "← Controls" → `/` (S1). Back on `/devices`, "Settings" as `view`: the "Technician PIN"
  overlay opens; Cancel stays on `/devices`; `123456` → `/settings/remote` (M03 gate).
- [ ] **AC3 — router cards.** Mono ids `ZBM5-2C-86W · r101_lights` and `S60ZBTPG · r101_proj_plug`, "Router" badges,
  `LQI 214` / `LQI 231`; tiles Front of room On (green), Rear of room Off (neutral), Mains to projector On; metrics
  `287 W` (green) · `231 V` · `1.84 kWh` · `13 A`.
- [ ] **AC4 — battery table.** Rows Room climate (`26.4° · 61%`, `98%`, `168`, `12s ago` counting up), Motion
  ("Detected" green), Door ("Closed") with reading, battery, link, last seen. Panel "Climate battery 18%" → `18%` amber;
  "Climate battery 8%" → `8%` red; go to `/` → header status amber "Sensor battery low" (H16 is S1.E4; the S2 header
  shows the coordinator instead); back to `/devices`. "Climate battery 98%" → normal. "Toggle climate stale" → Room
  climate last seen `14 min ago` amber, reading grey (H10). Reload; "No battery devices (reload to undo)" → "No battery
  devices paired".
- [ ] **AC5 — router offline (R7).** Reload; panel "Toggle lights offline": Lighting switch red dot, "Offline · last
  seen 5 min ago" instead of the LQI, tiles greyed, red border; callout amber "ONE ROUTER LEFT" "… Restore the lighting
  switch soon."
- [ ] **AC6 — coordinator and joining.** Reload; "Toggle coordinator offline": header "● Coordinator offline" red,
  coordinator and mesh values grey (H9), both routers offline, callout red "NO ROUTERS ONLINE". Toggle back;
  "Toggle coordinator starting": header "Coordinator starting…" amber. Reload; "Open joining (4:12)": Joining
  "Open · 4:12 left" in amber, counting down each second.
- [ ] **AC7 — interlock holding (H15).** Reload; "Toggle interlock holding": "● Holding", "Waiting for projector to cool
  · 112 W"; POWER shows `112 W`. "Toggle interlock bypassed" (after toggling holding off): "● Bypassed".
- [ ] **AC8 — 390px.** Reload at 390×844 (touch). Header: "← Controls" with label, "Zigbee devices", coordinator dot,
  gear icon. Order: Lighting switch → Projector socket → three battery cards (3 lines each) → Coordinator → Mesh →
  callout → interlock. Power metrics 2×2. Console: `document.documentElement.scrollWidth === innerWidth` → `true`;
  `[...document.querySelectorAll("header a, header button, main a, main button")].filter(e=>{const r=e.getBoundingClientRect();return r.width<48||r.height<48}).length`
  → `0`.
- [ ] **AC9 — `pnpm verify` green** with the S2 selector tests: `battery.view.test.ts` (last-seen formatting, battery
  severity, empty state), `side.view.test.ts` (callout variant, joining countdown text), plus
  `routers.view.test.ts`, `coordinator-status.view.test.ts`, `mock-nodes.test.ts`, `fake-room-devices.test.ts`,
  `server-time.test.ts`. `pnpm build` → exit 0 (the >500 kB chunk warning is M02-L1).
- [ ] **S1 regression.** `/` at 1280×800: `[document.documentElement.scrollHeight, innerHeight]` → `[800, 800]`; header
  clock ticks; S1 sensors unchanged.

**Verify:** all boxes ticked; `pnpm verify` → exit 0.

**Commit:** `git commit -m "chore: M05 acceptance walk-through"`

## Checkpoints

- After T9: "Human: nothing on S2 yet; skim the new mock panel buttons and `fake-room-devices.test.ts` (two minutes)."
- After T21: "Human: run `pnpm --filter @eduscope/kiosk dev`; open `/devices` at 1280×800 and 390×844; compare the header
  with screen 02 (back, title, coordinator status, Settings → technician PIN)."
- After T28: "Human: compare the main column with screen 02 at 1280×800, and the phone order and battery cards at 390×844;
  try "Toggle lights offline", "Climate battery 8%", "Toggle climate stale"."
- After T32: "Human: compare the whole page with screen 02 at 1280×800 and 800×1000; drive every side-column state from the
  panel."

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- Mock: refresh online nodes' `last_seen` every minute so "12s ago" doesn't drift to "40 min ago" in a long dev session.
- Mock panel: a toggle (not one-way) for "No battery devices".
- Highlight a stale or low-battery row with a small icon, not only colour (colour-blind users).
- Show the joining countdown in the S2 header too while joining is open.
- Dock the mock panel above the content at 1280 (it covers the interlock card; M02-L4 / M04-L1).
