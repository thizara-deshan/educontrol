# PLAN-M02 — App shell & data layer
Milestone: `docs/milestones/M02-shell-data-layer.md` · Start tag: `m02-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M02; SPEC §2.2, §2.4, §2.5, §3.1–3.4, S1.E1–E9, S4/S5, H1–H6b, H13, §6, R12;
ARCHITECTURE §1, §3.2–3.3, §4.1, §4.3–4.6, §4.8, §8, §10; CLAUDE.md; PLAN-M01 + REVIEW-M01;
`reference/screens/01-control-page.png` (header row), `02-devices-zigbee.png.png` (S2 header, for scope only);
the current code (`apps/kiosk`, `packages/contracts`).

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. Kiosk code imports with the `@/` alias
  and **no** file extension. `verbatimModuleSyntax` is on: type-only imports use `import type` / `type`.
- **Every code block in this plan was compiled, linted and tested** in a throw-away copy of this repo on
  2026-10-12 (`pnpm verify` green, 169 kiosk tests, `pnpm --filter @eduscope/kiosk build` OK). Write code
  blocks **verbatim** as the full file content unless the step says "replace" or "insert".
- Toolchain additions decided by this plan (do not change): `react-router@^7.18.4` (the milestone says v7;
  v8 exists — do not take it), `@tanstack/react-query@^5.104.1`, `lucide-react@^1.55.0`, `zod@^4.6.5`
  (same as contracts), shadcn CLI `shadcn@4.21.4`, which brings `radix-ui` and `sonner`.
- pnpm 11 has a minimum-release-age gate. **Never** add `minimumReleaseAgeExclude` to
  `pnpm-workspace.yaml`. After any `pnpm add`, `git diff pnpm-workspace.yaml` must be empty; if not, revert
  it (`git checkout pnpm-workspace.yaml`) and write a Blocker.
- Tests run in Vitest's `node` environment (no DOM library). Only pure logic is tested; components are
  checked by eye (CLAUDE.md: no tests of pure markup). Tests must also pass on Node 22 (`.nvmrc`): do not use
  `CloseEvent` or other globals newer than Node 22.
- No `as` casts other than `as const`. No hex/rgb literals outside `tokens.css`. Tailwind class strings
  must be literal (no string building) so Tailwind generates them.
- **Decisions this plan makes** (do not re-open them; they are explained in the task Context):
  1. `["state"]` is written **only** by `apply-event` from WS frames (the `snapshot` comes first on every
     connect). The UI never calls `getState()` (kept in `ApiClient` for M08 and tests). This is what makes
     AC3 (skeletons until the snapshot) hold.
  2. The slider throttle lives in `lib/level-slider.ts`, not `data/commands/` (ARCHITECTURE §1), because
     `components/` may not import `data/` (ARCHITECTURE §4.8) and `LevelSlider` needs it.
  3. In M02 the mock session is remote **`control`** so the demo controls can be used. M03 makes `view` the
     mock default and adds the PIN overlay.
  4. Mock panel: "Drop connection" closes the sockets now and refuses reconnects until "Restore" (AC4).
     "Make unreachable" goes **silent** (no close, no frames, refuses reconnects): the client detects it
     through the 25 s ping-miss timer — the only difference that makes the two buttons test different paths.
  5. The room id shown before the first snapshot (H1: "Header shows R-101") comes from `VITE_ROOM_ID`
     (default `R-101`) in `data/env.ts`.
  6. `ir_capture` frames are a no-op until M06 adds the capture store.
- After each task: run the task's **Verify**, then `pnpm verify`; when both are green tick the task's
  checkbox in this file and commit **with this plan file included**, e.g.
  `git add -A && git commit -m "<message from the task>"`.

## File map

| File | Create/Modify | Responsibility |
|---|---|---|
| `apps/kiosk/package.json`, `pnpm-lock.yaml` | Modify | New deps (T1, T3) |
| `packages/contracts/package.json` | Modify | Export `./fixtures/*` so the mock can import `room-normal.json` (T2) |
| `apps/kiosk/src/ui/{sheet,sonner,skeleton}.tsx` | Create (shadcn CLI) | Primitives: bottom sheet (status), toaster (H13), skeleton (H1) |
| `apps/kiosk/src/types/css-custom-properties.d.ts` | Create | Type CSS custom properties in `style` without casts |
| `apps/kiosk/src/lib/utils.ts` (+ `.test.ts`) | Modify | `cn()` aware of our token names (tailwind-merge) |
| `apps/kiosk/src/lib/store.ts` (+ test) | Create | `createStore` / `useStore` (useSyncExternalStore) |
| `apps/kiosk/src/lib/format.ts` (+ test) | Create | Time, date, W, °C, %, "x min ago", H13 attribution |
| `apps/kiosk/src/lib/client-label.ts` (+ test) | Create | `phone`/`tablet`/`laptop`/`podium PC` (Q19) |
| `apps/kiosk/src/lib/server-time.ts` (+ test) | Create | Server-clock offset, `useServerNow()` |
| `apps/kiosk/src/lib/level-slider.ts` (+ test) | Create | Slider throttle (200 ms, final on release) and drag/settle reducer |
| `apps/kiosk/src/lib/use-pressed.ts` | Create | `data-pressed` on pointerdown |
| `apps/kiosk/src/styles/tokens.css` | Modify | `animate-pending` token (H5 border pulse) |
| `apps/kiosk/src/components/state-styles.ts` (+ test) | Create | SPEC §3.4 → class names, in one place |
| `apps/kiosk/src/components/{StateDot,ObservedLine,Card,SectionLabel,CommandButton,ToggleRow,LevelSlider,SensorTile,MetricTile,KeyValueRow,InlineError,LockBadge,DashedAddButton,PlaceholderPage}.tsx` | Create | Shared components |
| `apps/kiosk/src/data/api-client.ts` | Create | `ApiClient` interface (M02 subset), `RealtimeHandlers`, `ApiRequestError` |
| `apps/kiosk/src/data/query-keys.ts`, `queries.ts`, `query-client.ts` | Create | Keys (only place), typed `["state"]`/`["session"]` options, QueryClient |
| `apps/kiosk/src/data/env.ts` (+ test) | Create | zod-parsed `VITE_API_MODE`, `VITE_ROOM_ID` |
| `apps/kiosk/src/data/test/room-state.ts` | Create | Test helper: parsed `room-normal` fixture |
| `apps/kiosk/src/data/adapters/http/http-client.ts` (+ test) | Create | fetch + WebSocket adapter, zod-parsed |
| `apps/kiosk/src/data/commands/{pending-store,inline-errors,command-sender}.ts` (+ tests) | Create | H5 pending, H6 inline errors (6 s), send flow |
| `apps/kiosk/src/data/realtime/apply-event.ts` (+ test) | Create | ServerEvent → cache / pending / toasts |
| `apps/kiosk/src/data/realtime/cache-port.ts` (+ test) | Create | apply-event's view of the QueryClient |
| `apps/kiosk/src/data/realtime/connection.ts` (+ test), `connection-store.ts` | Create | Connection state machine (H1–H4), page store |
| `apps/kiosk/src/data/adapters/mock/{mock-rules,fake-room,mock-client}.ts` (+ tests) | Create | In-memory room emitting real ServerEvents |
| `apps/kiosk/src/data/gate.ts` (+ test) | Create | `computeControlGate` (connection + access + device online) |
| `apps/kiosk/src/data/realtime/runtime.ts`, `data/api-context.tsx`, `data/create-api-client.ts` | Create | Wiring: adapter choice, realtime runtime, React context |
| `apps/kiosk/src/data/hooks.ts` | Create | `useRoomState`, `useSession`, `useConnectionStatus`, `useControlGate`, `usePending`, `useInlineError`, `useCommand` |
| `apps/kiosk/src/features/{control/ControlPage,devices/DevicesPage,settings/SettingsPage}.tsx` | Create | Placeholder pages |
| `apps/kiosk/src/app/{StatusIndicator,Header,ConnectionBanner,ErrorBoundary,AppShell,providers,router,mock-panel-flag}.tsx/ts` | Create | Shell |
| `apps/kiosk/src/app/dev/{MockPanel,LiveDemo,ComponentGallery}.tsx` | Create | `?mock-panel`, `/dev/components` (dev only) |
| `apps/kiosk/src/main.tsx` | Modify | Providers + RouterProvider |
| `apps/kiosk/src/app/TokenSwatches.tsx` | Delete | Temporary M01 page, replaced by the router |

## Tasks

### T1 — Kiosk runtime dependencies
- [x] done

**Files:** `apps/kiosk/package.json`, `pnpm-lock.yaml`

**Context:** M02 "Notes for the planner" (react-router v7, TanStack Query, lucide); CLAUDE.md "zod at every
boundary" (the kiosk parses env with zod, so it needs zod directly). `sonner` and `radix-ui` arrive in T3 via
the shadcn CLI.

**Do:**
1. `pnpm --filter @eduscope/kiosk add react-router@^7.18.4 @tanstack/react-query@^5.104.1 lucide-react@^1.55.0 zod@^4.6.5`
2. `git diff pnpm-workspace.yaml` → must print nothing (see Executor notes).
3. `grep -E '"(react-router|@tanstack/react-query|lucide-react|zod)"' apps/kiosk/package.json` → four lines
   under `dependencies`; react-router's range starts with `^7.`.

**Verify:** `pnpm verify` → exit 0 (nothing uses the deps yet).

**Commit:** `git commit -m "chore(kiosk): router, query, icons and zod dependencies"`

---

### T2 — Contracts: export the fixtures subpath
- [x] done

**Files:** `packages/contracts/package.json`

**Context:** ARCHITECTURE §4.4 — the mock `FakeRoom` is "seeded from `fixtures/state/room-normal.json`".
The package `exports` map only exposes `.`, so `@eduscope/contracts/fixtures/...` does not resolve. Contracts
change first (CLAUDE.md).

**Do:**
1. In `packages/contracts/package.json` replace
   ```json
     "exports": {
       ".": "./src/index.ts"
     },
   ```
   with
   ```json
     "exports": {
       ".": "./src/index.ts",
       "./fixtures/*": "./fixtures/*"
     },
   ```

**Verify:** `pnpm verify` → exit 0. (The import is exercised from T13 on.)

**Commit:** `git commit -m "chore(contracts): export fixtures subpath"`

---

### T3 — shadcn primitives: sheet, sonner, skeleton
- [x] done

**Files:** `apps/kiosk/src/ui/sheet.tsx`, `apps/kiosk/src/ui/sonner.tsx`, `apps/kiosk/src/ui/skeleton.tsx`,
`apps/kiosk/src/types/css-custom-properties.d.ts`, `apps/kiosk/package.json`, `pnpm-lock.yaml`

**Context:** ARCHITECTURE §1 (`ui/` = shadcn primitives only, restyled with tokens only), M02 Scope
("`Toaster` (sonner)", "`Skeleton` usage"; S1.E4 phone sheet). The shadcn 4.21.4 CLI has four quirks with this
repo, all checked on 2026-10-12; the steps below undo them:
(a) it writes `import { cn } from "cn"` and installs an unrelated npm package `cn`;
(b) `sonner.tsx` imports `next-themes` and uses `as` casts (and fails `exactOptionalPropertyTypes`);
(c) `skeleton.tsx` uses `bg-accent`, which in this repo is the **green** accent token (tokens.css keeps
`accent` ours), while H1 wants skeletons in `surface-2`;
(d) `sheet.tsx` uses `bg-black/50` (not a token) and borders without a colour.

**Do:**
1. `cd apps/kiosk && pnpm dlx shadcn@4.21.4 add sheet sonner skeleton --yes; cd ../..`
   → creates `src/ui/sheet.tsx`, `src/ui/sonner.tsx`, `src/ui/skeleton.tsx`.
2. `pnpm --filter @eduscope/kiosk remove cn next-themes`
3. `git diff pnpm-workspace.yaml` → must print nothing.
4. In `apps/kiosk/src/ui/sheet.tsx` make exactly these replacements (each string occurs once):
   - `from "cn"` → `from "@/lib/utils"`
   - `bg-black/50` → `bg-bg/80`
   - `bg-background shadow-lg` → `bg-surface shadow-lg`
   - `h-full w-3/4 border-l data-` → `h-full w-3/4 border-l border-border data-`
   - `h-full w-3/4 border-r data-` → `h-full w-3/4 border-r border-border data-`
   - `top-0 h-auto border-b data-` → `top-0 h-auto border-b border-border data-`
   - `bottom-0 h-auto border-t data-` → `bottom-0 h-auto border-t border-border data-`
5. Replace `apps/kiosk/src/ui/skeleton.tsx` with:
   ```tsx
   import { cn } from "@/lib/utils"

   function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
     return (
       <div
         data-slot="skeleton"
         className={cn("animate-pulse rounded-btn bg-surface-2", className)}
         {...props}
       />
     )
   }

   export { Skeleton }
   ```
6. Replace `apps/kiosk/src/ui/sonner.tsx` with:
```tsx
import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn `sonner`, adapted: dark-only (no next-themes), colours from tokens, H13 defaults
// (bottom, 4 s).
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      duration={4000}
      className="toaster group"
      style={{
        "--normal-bg": "var(--color-surface-2)",
        "--normal-text": "var(--color-text-1)",
        "--normal-border": "var(--color-border-strong)",
        "--border-radius": "var(--radius-btn)",
      }}
      toastOptions={{ classNames: { toast: "font-sans text-button" } }}
      {...props}
    />
  );
}

export { Toaster };
```
7. Create `apps/kiosk/src/types/css-custom-properties.d.ts`:
```ts
import "react";

// Lets `style` carry CSS custom properties (e.g. sonner's `--normal-bg`) without casts.
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
```
8. `grep -rn '"cn"\|next-themes\|bg-black\|bg-accent' apps/kiosk/src/ui` → no output.
   `grep -E '"(sonner|radix-ui)"' apps/kiosk/package.json` → two lines.

**Verify:** `pnpm verify` → exit 0 (typecheck proves the three files compile; nothing renders them yet).

**Commit:** `git commit -m "feat(kiosk): shadcn sheet, sonner and skeleton primitives"`

---

### T4 — `cn()` that knows our design tokens
- [x] done

**Files:** `apps/kiosk/src/lib/utils.ts`, `apps/kiosk/src/lib/utils.test.ts`

**Context:** Found while prototyping this plan: `tailwind-merge` does not know our `--text-*` type tokens, so
`cn("text-section font-bold text-text-2")` **drops `text-section`** (it thinks both are colours) and section
labels render at the default 16px. Every component that passes classes through `cn()` is affected. The token
lists already exist in `styles/token-names.ts` (M01).

**Do:**
1. Replace `apps/kiosk/src/lib/utils.ts` with:
```ts
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_TOKENS } from "@/styles/token-names";

// tailwind-merge must know our token names: otherwise it reads `text-section` (a font size)
// as a colour and drops it when `text-text-2` follows.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...TYPE_TOKENS],
      color: [...COLOR_TOKENS],
      radius: [...RADIUS_TOKENS],
    },
  },
});

/** shadcn class combiner: later Tailwind classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

**Test:** `apps/kiosk/src/lib/utils.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a type token next to a colour token", () => {
    expect(cn("text-section font-bold text-text-2")).toBe("text-section font-bold text-text-2");
    expect(cn("text-value", "text-accent")).toBe("text-value text-accent");
  });
  it("later type tokens replace earlier ones", () => {
    expect(cn("text-caption", "text-button")).toBe("text-button");
  });
  it("later colour tokens replace earlier ones", () => {
    expect(cn("text-text-2", "text-accent")).toBe("text-accent");
    expect(cn("bg-control", "bg-accent-fill")).toBe("bg-accent-fill");
  });
  it("later radius tokens replace earlier ones", () => {
    expect(cn("rounded-card", "rounded-btn")).toBe("rounded-btn");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/utils.test.ts` → 4 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "fix(kiosk): teach cn() the design token names"`

---

### T5 — `lib/store.ts`: tiny external store
- [x] done

**Files:** `apps/kiosk/src/lib/store.ts`, `apps/kiosk/src/lib/store.test.ts`

**Context:** ARCHITECTURE §4.5 ("a `lib/store.ts` external store (`useSyncExternalStore`, no extra
library)"). Used by the connection status, pending store, inline errors and server clock. `set` and `update`
are separate so no cast is needed when `T` is itself a function type.

**Do:**
1. Create `apps/kiosk/src/lib/store.ts`:
```ts
import { useSyncExternalStore } from "react";

/** A tiny external store (ARCHITECTURE §4.5). Snapshots are replaced, never mutated. */
export interface Store<T> {
  get(): T;
  set(next: T): void;
  update(fn: (prev: T) => T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const set = (next: T): void => {
    if (Object.is(next, value)) return;
    value = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => value,
    set,
    update: (fn) => set(fn(value)),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Subscribe a component to part of a store. The selector must return a primitive or an object
 * that is already part of the snapshot (never a new object), or React re-renders forever.
 */
export function useStore<T, S>(store: Store<T>, selector: (value: T) => S): S {
  const read = (): S => selector(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}
```

**Test:** `apps/kiosk/src/lib/store.test.ts`
```ts
import { describe, expect, it, vi } from "vitest";
import { createStore } from "./store";

describe("createStore", () => {
  it("returns the initial value", () => {
    expect(createStore(1).get()).toBe(1);
  });

  it("notifies subscribers on set and update", () => {
    const store = createStore(1);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(2);
    store.update((n) => n + 1);
    expect(store.get()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not notify when the value is identical", () => {
    const store = createStore("a");
    const listener = vi.fn();
    store.subscribe(listener);
    store.set("a");
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/store.test.ts` → 4 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): external store helper"`

---

### T6 — `lib/format.ts`: formatters
- [x] done

**Files:** `apps/kiosk/src/lib/format.ts`, `apps/kiosk/src/lib/format.test.ts`

**Context:** SPEC §3.2 (clock `10:42`, date `Mon 5 Oct`, `287 W`, `26.4°`, `61%`), S1.E2/E3, §3.4 stale
suffix "· 14 min ago", H13 toast copy "Rear of room turned on · from phone", §2.4 "· by hand", "· by schedule".
Local getters (`getHours`) are used on purpose; tests build dates with the local `Date` constructor so they
pass in any time zone.

**Do:**
1. Create `apps/kiosk/src/lib/format.ts`:
```ts
import type { ChangedBy } from "@eduscope/contracts";

// SPEC §3.2 formats. Local getters: the browser and the Pi are in the same room (same zone).
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** S1.E2: 24 h `HH:mm`, e.g. `10:42`. */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** S1.E3: `ddd d MMM`, e.g. `Mon 5 Oct`. */
export function formatDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()] ?? ""} ${date.getDate()} ${MONTHS[date.getMonth()] ?? ""}`;
}

/** `287 W`; unknown → `— W` (S1.E13). */
export function formatWatts(watts: number | null): string {
  return watts === null ? "— W" : `${Math.round(watts)} W`;
}

/** `26.4°` (1 dp, sensors) or `24°` (0 dp, setpoint); unknown → `—`. */
export function formatCelsius(celsius: number | null, decimals: 0 | 1 = 1): string {
  return celsius === null ? "—" : `${celsius.toFixed(decimals)}°`;
}

/** `61%`; unknown → `—`. */
export function formatPercent(percent: number | null): string {
  return percent === null ? "—" : `${Math.round(percent)}%`;
}

/** Stale suffix value (SPEC §3.4, H10): `12s ago`, `14 min ago`, `3 h ago`, `2 d ago`. */
export function formatAgo(fromIso: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** H13 attribution suffix: `from phone`, `by hand`, `by schedule`. */
export function formatAttribution(by: ChangedBy): string {
  if (by === "by hand") return "by hand";
  if (by === "schedule") return "by schedule";
  return `from ${by}`;
}

/** H13 toast copy: "Rear of room turned on · from phone". */
export function formatActivity(text: string, by: ChangedBy): string {
  return `${text} · ${formatAttribution(by)}`;
}
```

**Test:** `apps/kiosk/src/lib/format.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  formatActivity, formatAgo, formatAttribution, formatCelsius, formatDate, formatPercent,
  formatTime, formatWatts,
} from "./format";

describe("formatTime", () => {
  it("pads to HH:mm in 24 h", () => {
    expect(formatTime(new Date(2026, 9, 5, 10, 42, 59))).toBe("10:42");
    expect(formatTime(new Date(2026, 9, 5, 7, 5))).toBe("07:05");
    expect(formatTime(new Date(2026, 9, 5, 23, 0))).toBe("23:00");
  });
});

describe("formatDate", () => {
  it("renders ddd d MMM", () => {
    expect(formatDate(new Date(2026, 9, 5))).toBe("Mon 5 Oct");
    expect(formatDate(new Date(2026, 0, 31))).toBe("Sat 31 Jan");
  });
});

describe("formatWatts", () => {
  it("rounds to whole watts", () => {
    expect(formatWatts(287.4)).toBe("287 W");
    expect(formatWatts(3)).toBe("3 W");
  });
  it("shows a dash when unknown", () => {
    expect(formatWatts(null)).toBe("— W");
  });
});

describe("formatCelsius", () => {
  it("uses one decimal by default", () => {
    expect(formatCelsius(26.4)).toBe("26.4°");
    expect(formatCelsius(26)).toBe("26.0°");
  });
  it("supports whole degrees for the setpoint", () => {
    expect(formatCelsius(24, 0)).toBe("24°");
  });
  it("shows a dash when unknown", () => {
    expect(formatCelsius(null)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("renders an integer percentage", () => {
    expect(formatPercent(61)).toBe("61%");
    expect(formatPercent(60.6)).toBe("61%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatAgo", () => {
  const now = new Date("2026-10-05T10:42:00Z");
  it.each([
    ["2026-10-05T10:41:48Z", "12s ago"],
    ["2026-10-05T10:28:00Z", "14 min ago"],
    ["2026-10-05T07:42:00Z", "3 h ago"],
    ["2026-10-03T10:42:00Z", "2 d ago"],
    ["2026-10-05T10:43:00Z", "0s ago"],
  ])("%s → %s", (from, expected) => {
    expect(formatAgo(from, now)).toBe(expected);
  });
});

describe("attribution", () => {
  it.each([
    ["phone", "from phone"],
    ["room screen", "from room screen"],
    ["podium PC", "from podium PC"],
    ["by hand", "by hand"],
    ["schedule", "by schedule"],
  ] as const)("%s → %s", (by, expected) => {
    expect(formatAttribution(by)).toBe(expected);
  });
  it("builds the H13 toast text", () => {
    expect(formatActivity("Rear of room turned on", "phone")).toBe("Rear of room turned on · from phone");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/format.test.ts` → 19 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): time, date, unit and attribution formatters"`

---

### T7 — `lib/client-label.ts`
- [x] done

**Files:** `apps/kiosk/src/lib/client-label.ts`, `apps/kiosk/src/lib/client-label.test.ts`

**Context:** ARCHITECTURE §4.5 ("kiosk is decided by the server; otherwise width/touch → phone/tablet/laptop;
`?podium=1` once stores "podium PC" in localStorage, Q19"). The label is sent in `hello {label}` on connect.
Uses the screen's short side (stable under rotation), not the viewport width.

**Do:**
1. Create `apps/kiosk/src/lib/client-label.ts`:
```ts
import type { ClientLabel } from "@eduscope/contracts";

// ARCHITECTURE §4.5, SPEC Q19 (assumption: automatic from form factor). The kiosk label
// ("room screen") is decided by the server, never by the client.
export const PODIUM_STORAGE_KEY = "eduscope.podium";
const PHONE_MAX_SHORT_SIDE = 600; // SPEC §2.2 phone breakpoint

export interface ClientTraits {
  /** `?podium=1` was seen once on this browser. */
  podium: boolean;
  /** `(pointer: coarse)` matches. */
  coarsePointer: boolean;
  /** The shorter side of the screen in CSS px. */
  shortSide: number;
}

export function detectClientLabel(traits: ClientTraits): ClientLabel {
  if (traits.podium) return "podium PC";
  if (!traits.coarsePointer) return "laptop";
  return traits.shortSide < PHONE_MAX_SHORT_SIDE ? "phone" : "tablet";
}

/** `?podium=1` is remembered in localStorage; blocked storage falls back to form factor. */
function readPodiumFlag(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("podium") === "1") {
      window.localStorage.setItem(PODIUM_STORAGE_KEY, "1");
    }
    return window.localStorage.getItem(PODIUM_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Reads the browser once at startup. */
export function getClientLabel(): ClientLabel {
  return detectClientLabel({
    podium: readPodiumFlag(),
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    shortSide: Math.min(window.screen.width, window.screen.height),
  });
}
```

**Test:** `apps/kiosk/src/lib/client-label.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { detectClientLabel } from "./client-label";

describe("detectClientLabel", () => {
  it.each([
    [{ podium: true, coarsePointer: false, shortSide: 1080 }, "podium PC"],
    [{ podium: true, coarsePointer: true, shortSide: 390 }, "podium PC"],
    [{ podium: false, coarsePointer: false, shortSide: 1080 }, "laptop"],
    [{ podium: false, coarsePointer: false, shortSide: 390 }, "laptop"],
    [{ podium: false, coarsePointer: true, shortSide: 390 }, "phone"],
    [{ podium: false, coarsePointer: true, shortSide: 599 }, "phone"],
    [{ podium: false, coarsePointer: true, shortSide: 600 }, "tablet"],
    [{ podium: false, coarsePointer: true, shortSide: 800 }, "tablet"],
  ] as const)("%o → %s", (traits, expected) => {
    expect(detectClientLabel(traits)).toBe(expected);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/client-label.test.ts` → 8 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): client attribution label"`

---

### T8 — `lib/server-time.ts`: server clock offset
- [x] done

**Files:** `apps/kiosk/src/lib/server-time.ts`, `apps/kiosk/src/lib/server-time.test.ts`

**Context:** SPEC S1.E2 "Server time, not client time"; ARCHITECTURE §4.5 "`server_time` from each state
frame updates a time-offset". Offset is `null` until the first snapshot so the header clock can show a
skeleton (H1).

**Do:**
1. Create `apps/kiosk/src/lib/server-time.ts`:
```ts
import { useEffect, useState } from "react";
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

/** Server "now", re-rendered every second; `null` before the first snapshot. */
export function useServerNow(clock: ServerClock = serverClock): Date | null {
  const offset = useStore(clock.offset, (value) => value);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return offset === null ? null : clock.now();
}
```

**Test:** `apps/kiosk/src/lib/server-time.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { createServerClock } from "./server-time";

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
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/server-time.test.ts` → 3 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): server clock offset"`

---

### T9 — `lib/level-slider.ts`: throttle and drag rules
- [x] done

**Files:** `apps/kiosk/src/lib/level-slider.ts`, `apps/kiosk/src/lib/level-slider.test.ts`

**Context:** SPEC §2.4 (thumb follows the finger; limited-rate updates while dragging; final on release;
another client's change does not move a dragged slider and applies on release; after release "the thumb
settles to the server-pushed value"); ARCHITECTURE §4.6 (200 ms, `final:true` on release); M02 notes. Placed in
`lib/` (Executor note decision 2). The "settling" state keeps the released value until the server value
changes (or 1.5 s) so the thumb does not jump back to the old level while the command is in flight.

**Do:**
1. Create `apps/kiosk/src/lib/level-slider.ts`:
```ts
// LevelSlider logic (SPEC §2.4, ARCHITECTURE §4.6): throttle while dragging, final value on
// release, server pushes ignored while the finger is down. Pure so it can be unit-tested.

export const LEVEL_THROTTLE_MS = 200;
/** After release the thumb holds the released value until the server pushes, at most this long. */
export const SETTLE_TIMEOUT_MS = 1500;

export const clampLevel = (level: number): number => Math.min(100, Math.max(0, Math.round(level)));

/** Pointer x → level 0–100 on a track starting at `left` with `width` px. */
export function levelFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0;
  return clampLevel(((clientX - left) / width) * 100);
}

export interface LevelThrottle {
  /** Finger moved: sends `final:false` at most every LEVEL_THROTTLE_MS (leading + trailing). */
  move(level: number): void;
  /** Finger lifted: cancels the trailing send and sends `final:true` once. */
  release(level: number): void;
  /** Unmount: drop any trailing send. */
  cancel(): void;
}

export function createLevelThrottle(
  send: (level: number, final: boolean) => void,
  now: () => number = Date.now,
  intervalMs: number = LEVEL_THROTTLE_MS,
): LevelThrottle {
  let lastSentAt: number | null = null;
  let lastSentLevel: number | null = null;
  let latest: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const sendNow = (level: number): void => {
    lastSentAt = now();
    lastSentLevel = level;
    send(level, false);
  };

  return {
    move(level) {
      latest = level;
      const elapsed = lastSentAt === null ? Infinity : now() - lastSentAt;
      if (elapsed >= intervalMs) {
        clearTimer();
        sendNow(level);
        return;
      }
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (latest !== null && latest !== lastSentLevel) sendNow(latest);
      }, intervalMs - elapsed);
    },
    release(level) {
      clearTimer();
      lastSentAt = null;
      lastSentLevel = null;
      latest = null;
      send(level, true);
    },
    cancel() {
      clearTimer();
    },
  };
}

/** What the thumb shows: the finger while dragging, the released value while settling, else the server. */
export type SliderState =
  | { mode: "idle" }
  | { mode: "dragging"; level: number }
  | { mode: "settling"; level: number; serverAtRelease: number | null };

export type SliderAction =
  | { type: "down"; level: number }
  | { type: "move"; level: number }
  | { type: "up"; level: number; server: number | null }
  | { type: "server"; value: number | null }
  | { type: "settle-timeout" };

export const SLIDER_IDLE: SliderState = { mode: "idle" };

export function sliderReducer(state: SliderState, action: SliderAction): SliderState {
  switch (action.type) {
    case "down":
      return { mode: "dragging", level: action.level };
    case "move":
      return state.mode === "dragging" ? { mode: "dragging", level: action.level } : state;
    case "up":
      return state.mode === "dragging"
        ? { mode: "settling", level: action.level, serverAtRelease: action.server }
        : state;
    case "server":
      // While dragging, another client's change is ignored (SPEC §2.4); it applies on release.
      if (state.mode === "settling" && action.value !== state.serverAtRelease) return SLIDER_IDLE;
      return state;
    case "settle-timeout":
      return state.mode === "settling" ? SLIDER_IDLE : state;
  }
}

export function sliderDisplayLevel(state: SliderState, server: number | null): number | null {
  return state.mode === "idle" ? server : state.level;
}
```

**Test:** `apps/kiosk/src/lib/level-slider.test.ts`
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampLevel, createLevelThrottle, levelFromPointer, SLIDER_IDLE, sliderDisplayLevel,
  sliderReducer, type SliderState,
} from "./level-slider";

describe("levelFromPointer", () => {
  it("maps the track to 0–100 and clamps", () => {
    expect(levelFromPointer(100, 100, 200)).toBe(0);
    expect(levelFromPointer(200, 100, 200)).toBe(50);
    expect(levelFromPointer(300, 100, 200)).toBe(100);
    expect(levelFromPointer(50, 100, 200)).toBe(0);
    expect(levelFromPointer(400, 100, 200)).toBe(100);
    expect(levelFromPointer(150, 100, 0)).toBe(0);
  });
  it("rounds to integers", () => {
    expect(clampLevel(61.6)).toBe(62);
  });
});

describe("createLevelThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the first move immediately", () => {
    const send = vi.fn();
    createLevelThrottle(send).move(10);
    expect(send).toHaveBeenCalledWith(10, false);
  });

  it("sends at most once per 200 ms and then the latest value", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    vi.advanceTimersByTime(50);
    throttle.move(20);
    vi.advanceTimersByTime(50);
    throttle.move(30);
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100); // t = 200
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(30, false);
  });

  it("sends again immediately once 200 ms have passed", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    vi.advanceTimersByTime(250);
    throttle.move(40);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(40, false);
  });

  it("release cancels the trailing send and sends final once", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    throttle.move(20);
    throttle.release(25);
    vi.advanceTimersByTime(1000);
    expect(send.mock.calls).toEqual([[10, false], [25, true]]);
  });

  it("release without a move sends final only", () => {
    const send = vi.fn();
    createLevelThrottle(send).release(70);
    expect(send.mock.calls).toEqual([[70, true]]);
  });

  it("starts a fresh drag after release", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    throttle.release(10);
    throttle.move(15);
    expect(send).toHaveBeenLastCalledWith(15, false);
  });

  it("cancel drops a pending trailing send", () => {
    const send = vi.fn();
    const throttle = createLevelThrottle(send);
    throttle.move(10);
    throttle.move(20);
    throttle.cancel();
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("sliderReducer", () => {
  const dragging: SliderState = { mode: "dragging", level: 40 };

  it("follows the finger while dragging", () => {
    let state = sliderReducer(SLIDER_IDLE, { type: "down", level: 30 });
    state = sliderReducer(state, { type: "move", level: 45 });
    expect(sliderDisplayLevel(state, 62)).toBe(45);
  });

  it("ignores server pushes while dragging", () => {
    expect(sliderReducer(dragging, { type: "server", value: 90 })).toBe(dragging);
  });

  it("ignores moves when not dragging", () => {
    expect(sliderReducer(SLIDER_IDLE, { type: "move", level: 10 })).toBe(SLIDER_IDLE);
  });

  it("holds the released value until the server value changes", () => {
    let state = sliderReducer(dragging, { type: "up", level: 40, server: 62 });
    expect(sliderDisplayLevel(state, 62)).toBe(40);
    state = sliderReducer(state, { type: "server", value: 62 });
    expect(state.mode).toBe("settling");
    state = sliderReducer(state, { type: "server", value: 40 });
    expect(state).toBe(SLIDER_IDLE);
    expect(sliderDisplayLevel(state, 40)).toBe(40);
  });

  it("falls back to the server value after the settle timeout", () => {
    const settling = sliderReducer(dragging, { type: "up", level: 40, server: 62 });
    const state = sliderReducer(settling, { type: "settle-timeout" });
    expect(sliderDisplayLevel(state, 62)).toBe(62);
  });

  it("shows the server value when idle", () => {
    expect(sliderDisplayLevel(SLIDER_IDLE, null)).toBeNull();
    expect(sliderDisplayLevel(SLIDER_IDLE, 38)).toBe(38);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/lib/level-slider.test.ts` → 15 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): level slider throttle and drag rules"`

---

### T10 — `components/state-styles.ts` and the pending pulse token
- [x] done

**Files:** `apps/kiosk/src/components/state-styles.ts`, `apps/kiosk/src/components/state-styles.test.ts`,
`apps/kiosk/src/styles/tokens.css`

**Context:** SPEC §3.4 table (dot / text / active control / card border per state); ARCHITECTURE §4.2 ("State
styling lives in one place: `components/state-styles.ts`"); H5 ("border pulses `text-2`"); H19 (40% opacity);
H2/H3 ("values greyed"); S1.E4 dot colours (normal green, degraded amber, fault red). "Stale" is a modifier on
top of a tone (dot 40%, value `text-3`), not a tone of its own. Active controls always use `border-2` so a state
change never shifts layout. The keyframes go in `tokens.css` because it is the only file that defines theme
values (CLAUDE.md).

**Do:**
1. In `apps/kiosk/src/styles/tokens.css`, inside the `@theme static { … }` block, replace
   ```css
     --tracking-wordmark: 0.12em;
   }
   ```
   with
   ```css
     --tracking-wordmark: 0.12em;

     /* H5 pending: the tapped control's border pulses text-2 (SPEC §3.4). */
     --animate-pending: pending-pulse 1.2s ease-in-out infinite;
     @keyframes pending-pulse {
       0%, 100% { border-color: var(--color-border-strong); }
       50% { border-color: var(--color-text-2); }
     }
   }
   ```
2. Create `apps/kiosk/src/components/state-styles.ts`:
```ts
import type { Confidence } from "@eduscope/contracts";

// SPEC §3.4 state language in ONE place (ARCHITECTURE §4.2). Components never pick state
// colours themselves; they ask for a tone and use these class maps. Literal strings only, so
// Tailwind generates every class.

export type StateTone = "confirmed" | "selected" | "assumed" | "off" | "unknown" | "offline";

export interface StateInput {
  confidence: Confidence;
  /** The value means on / active / detected. */
  active: boolean;
  /** A choice that is the current one (source tile, S3 device). */
  selected?: boolean;
  /** The device is offline or the command failed. */
  offline?: boolean;
  /** `false` when the observed value is null (never reported). */
  hasValue?: boolean;
}

/** Priority: offline > unknown > assumed > selected > confirmed (active) > off. */
export function stateTone(input: StateInput): StateTone {
  if (input.offline === true) return "offline";
  if (input.confidence === "unknown" || input.hasValue === false) return "unknown";
  if (input.confidence === "assumed") return "assumed";
  if (input.selected === true) return "selected";
  return input.active ? "confirmed" : "off";
}

/** Dot (StateDot). Hollow rings for assumed and unknown. */
export const DOT_CLASS: Record<StateTone, string> = {
  confirmed: "bg-accent",
  selected: "bg-accent",
  assumed: "border-2 border-warn bg-transparent",
  off: "bg-text-3",
  unknown: "border-2 border-text-3 bg-transparent",
  offline: "bg-danger",
};

/** State text (ObservedLine, "On"/"Off" labels). */
export const TEXT_CLASS: Record<StateTone, string> = {
  confirmed: "text-accent",
  selected: "text-accent",
  assumed: "text-warn",
  off: "text-text-3",
  unknown: "text-text-3",
  offline: "text-danger",
};

/** Card border variants (SPEC §3.4 "Card border" column) and which tone uses which. */
export type CardVariant = "solid" | "dashed" | "danger";
export const CARD_VARIANT_CLASS: Record<CardVariant, string> = {
  solid: "border-border",
  dashed: "border-dashed border-border-dashed",
  danger: "border-danger/40",
};
export const CARD_VARIANT_FOR_TONE: Record<StateTone, CardVariant> = {
  confirmed: "solid",
  selected: "solid",
  assumed: "dashed",
  off: "solid",
  unknown: "dashed",
  offline: "danger",
};

/** Stale (H10): dot at 40%, value in text-3. Applied on top of the tone. */
export const STALE_DOT_CLASS = "opacity-40";
export const STALE_TEXT_CLASS = "text-text-3";

/** CommandButton fills. Always border-2 so switching state never shifts layout. */
export type ActiveVariant = "confirmed" | "selected" | "assumed" | "neutral";
export const ACTIVE_CONTROL_CLASS: Record<ActiveVariant, string> = {
  confirmed: "border-accent-border bg-accent-fill text-text-1",
  selected: "border-accent-border bg-selected-fill text-text-1",
  assumed: "border-warn bg-warn-fill text-text-1",
  neutral: "border-text-2 bg-surface-2 text-text-1",
};
export const INACTIVE_CONTROL_CLASS = "border-border-strong bg-control text-text-1";
/** H5: the tapped control's border pulses text-2; its label does not change. */
export const PENDING_CONTROL_CLASS = "animate-pending";
/** H19 and every disabled control: 40% opacity, no pointer events. */
export const DISABLED_CONTROL_CLASS = "pointer-events-none opacity-40";

/** H2/H3: last known values stay visible but greyed (applied to the page while not live). */
export const GREYED_CLASS = "opacity-60 grayscale";

/** S1.E4 room status dot. */
export type StatusLevel = "normal" | "degraded" | "fault" | "connecting";
export const STATUS_DOT_CLASS: Record<StatusLevel, string> = {
  normal: "bg-accent",
  degraded: "bg-warn",
  fault: "bg-danger",
  connecting: "border-2 border-text-3 bg-transparent",
};

/** Sensor/metric value accents (S1.E44 "Detected", S1.E45 "Open", S2 power). */
export type ValueTone = "default" | "accent" | "warn" | "danger";
export const VALUE_TONE_CLASS: Record<ValueTone, string> = {
  default: "text-text-1",
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
};
```

**Test:** `apps/kiosk/src/components/state-styles.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  ACTIVE_CONTROL_CLASS, CARD_VARIANT_CLASS, CARD_VARIANT_FOR_TONE, DOT_CLASS, stateTone, STATUS_DOT_CLASS, TEXT_CLASS,
  VALUE_TONE_CLASS, type StateInput, type StateTone,
} from "./state-styles";

describe("stateTone", () => {
  it.each<[StateInput, StateTone]>([
    [{ confidence: "confirmed", active: true }, "confirmed"],
    [{ confidence: "confirmed", active: false }, "off"],
    [{ confidence: "confirmed", active: true, selected: true }, "selected"],
    [{ confidence: "assumed", active: true }, "assumed"],
    [{ confidence: "assumed", active: false }, "assumed"],
    [{ confidence: "unknown", active: false }, "unknown"],
    [{ confidence: "confirmed", active: true, hasValue: false }, "unknown"],
    [{ confidence: "confirmed", active: true, offline: true }, "offline"],
    [{ confidence: "assumed", active: true, offline: true }, "offline"],
    [{ confidence: "unknown", active: false, offline: true }, "offline"],
  ])("%o → %s", (input, expected) => {
    expect(stateTone(input)).toBe(expected);
  });
});

describe("SPEC §3.4 class maps", () => {
  it("confirmed is a solid accent dot with accent text", () => {
    expect(DOT_CLASS.confirmed).toBe("bg-accent");
    expect(TEXT_CLASS.confirmed).toBe("text-accent");
  });
  it("assumed is a hollow warn ring, warn text and a dashed card", () => {
    expect(DOT_CLASS.assumed).toContain("border-warn");
    expect(DOT_CLASS.assumed).toContain("bg-transparent");
    expect(TEXT_CLASS.assumed).toBe("text-warn");
    expect(CARD_VARIANT_FOR_TONE.assumed).toBe("dashed");
    expect(CARD_VARIANT_CLASS.dashed).toContain("border-dashed");
  });
  it("unknown is a hollow grey ring and a dashed card", () => {
    expect(DOT_CLASS.unknown).toContain("border-text-3");
    expect(CARD_VARIANT_FOR_TONE.unknown).toBe("dashed");
  });
  it("offline is danger with a 40% danger border", () => {
    expect(DOT_CLASS.offline).toBe("bg-danger");
    expect(CARD_VARIANT_FOR_TONE.offline).toBe("danger");
    expect(CARD_VARIANT_CLASS.danger).toBe("border-danger/40");
  });
  it("active controls use the SPEC fills", () => {
    expect(ACTIVE_CONTROL_CLASS.confirmed).toContain("bg-accent-fill");
    expect(ACTIVE_CONTROL_CLASS.selected).toContain("bg-selected-fill");
    expect(ACTIVE_CONTROL_CLASS.assumed).toContain("bg-warn-fill");
  });
  it("never contains raw colour values", () => {
    const all = [
      ...Object.values(DOT_CLASS), ...Object.values(TEXT_CLASS), ...Object.values(CARD_VARIANT_CLASS),
      ...Object.values(ACTIVE_CONTROL_CLASS), ...Object.values(STATUS_DOT_CLASS),
      ...Object.values(VALUE_TONE_CLASS),
    ];
    for (const cls of all) expect(cls).not.toMatch(/#|rgb\(|\[/);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/components/state-styles.test.ts src/styles/token-names.test.ts`
→ 16 + 5 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): state-styles mapping for the SPEC state language"`

---

### T11 — `ApiClient` interface, query keys and typed queries
- [x] done

**Files:** `apps/kiosk/src/data/api-client.ts`, `apps/kiosk/src/data/query-keys.ts`,
`apps/kiosk/src/data/queries.ts`, `apps/kiosk/src/data/query-client.ts`

**Context:** ARCHITECTURE §4.4. M02 needs only `getSession`, `getState`, `sendCommand`, `connect`; `login`/
`lock` come in M03 and `ir`/`schedule`/`devices`/`settings`/`system` in M06 — do **not** add them now.
`connect(label, handlers)` lets each adapter send `hello {label}` itself. `queryOptions<…>` tags the keys
with their data type so `getQueryData` / `setQueryData` need no casts. `["state"]`: `queryFn: skipToken`
(Executor note decision 1), `staleTime: Infinity`, `refetchOnWindowFocus: false` (M02 notes), `gcTime: Infinity`.
These are types and constants only; they are tested through T13–T24.

**Do:**
1. Create `apps/kiosk/src/data/api-client.ts`:
```ts
import type {
  ApiErrorCode, ClientLabel, ClientSession, Command, CommandRequest, RoomState, ServerEvent,
} from "@eduscope/contracts";

// ARCHITECTURE §4.4. M02 subset: later milestones add login/lock (M03), ir/schedule/devices/
// settings/system (M06). Components never see which adapter is active.

export interface RealtimeHandlers {
  /** The transport is open (the snapshot follows as the first event). */
  onOpen(): void;
  /** A zod-parsed server frame. */
  onEvent(event: ServerEvent): void;
  /** The transport closed or failed to open. Called at most once per connection. */
  onClose(): void;
}

export interface RealtimeConnection {
  close(): void;
}

export interface ApiClient {
  getSession(): Promise<ClientSession>;
  /** Exists for M08 and tests; the UI takes `["state"]` from the WS snapshot only. */
  getState(): Promise<RoomState>;
  /** 202 → the accepted Command (status `pending`). Throws ApiRequestError. */
  sendCommand(request: CommandRequest): Promise<Command>;
  /** Opens the realtime channel and sends `hello {label}` on open. */
  connect(label: ClientLabel, handlers: RealtimeHandlers): RealtimeConnection;
}

/** Every adapter failure. `network` = no response, `bad_response` = body failed zod. */
export type ApiFailureCode = ApiErrorCode | "network" | "bad_response";

export class ApiRequestError extends Error {
  readonly code: ApiFailureCode;
  readonly status: number | null;

  constructor(code: ApiFailureCode, message: string, status: number | null) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}
```
2. Create `apps/kiosk/src/data/query-keys.ts`:
```ts
// The ONLY place query keys are built (ARCHITECTURE §4.4).
export const queryKeys = {
  session: () => ["session"] as const,
  state: () => ["state"] as const,
  irDevices: () => ["ir", "devices"] as const,
  schedule: () => ["schedule"] as const,
  devices: () => ["devices"] as const,
  systemNetwork: () => ["system", "network"] as const,
  systemAbout: () => ["system", "about"] as const,
};

export const STATE_ROOT_KEY = "state";
```
3. Create `apps/kiosk/src/data/queries.ts`:
```ts
import type { ClientSession, RoomState } from "@eduscope/contracts";
import { queryOptions, skipToken } from "@tanstack/react-query";
import type { ApiClient } from "./api-client";
import { queryKeys } from "./query-keys";

/**
 * `["state"]` is written ONLY by apply-event from WS frames (snapshot first). It is never
 * fetched by the UI (skipToken), never refetched and never garbage-collected.
 */
export const stateQuery = queryOptions<RoomState>({
  queryKey: queryKeys.state(),
  queryFn: skipToken,
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
});

/** `["session"]`: fetched once, then replaced by `session` events and refetched after a snapshot. */
export const sessionQuery = (api: ApiClient) =>
  queryOptions<ClientSession>({
    queryKey: queryKeys.session(),
    queryFn: () => api.getSession(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
```
4. Create `apps/kiosk/src/data/query-client.ts`:
```ts
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  });
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): ApiClient interface and query keys"`

---

### T12 — `data/env.ts`: zod-parsed env
- [x] done

**Files:** `apps/kiosk/src/data/env.ts`, `apps/kiosk/src/data/env.test.ts`

**Context:** CLAUDE.md "zod at every boundary: … env"; ARCHITECTURE §4.4 (`VITE_API_MODE=mock|http`, `mock` in
`.env.development`, `http` in the production build); H1 (room id before the snapshot, decision 5).
`.env.development` already contains `VITE_API_MODE=mock`; do not edit it.

**Do:**
1. Create `apps/kiosk/src/data/env.ts`:
```ts
import { z } from "zod";

// zod at the env boundary (CLAUDE.md). `.env.development` sets mock; a production build
// without the variable talks to core-api.
const KioskEnv = z.object({
  VITE_API_MODE: z.enum(["mock", "http"]).default("http"),
  /** Shown before the first snapshot (H1: "Header shows R-101"). */
  VITE_ROOM_ID: z.string().min(1).default("R-101"),
});
export type KioskEnv = z.infer<typeof KioskEnv>;
export type ApiMode = KioskEnv["VITE_API_MODE"];

export function readEnv(env: Record<string, unknown> = import.meta.env): KioskEnv {
  return KioskEnv.parse(env);
}

export const kioskEnv = readEnv();
```

**Test:** `apps/kiosk/src/data/env.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { readEnv } from "./env";

describe("readEnv", () => {
  it("defaults to http and R-101", () => {
    expect(readEnv({})).toEqual({ VITE_API_MODE: "http", VITE_ROOM_ID: "R-101" });
  });
  it("accepts mock", () => {
    expect(readEnv({ VITE_API_MODE: "mock" }).VITE_API_MODE).toBe("mock");
  });
  it("rejects an unknown mode", () => {
    expect(() => readEnv({ VITE_API_MODE: "fake" })).toThrow();
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/env.test.ts` → 3 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): zod-parsed kiosk env"`

---

### T13 — http adapter (fetch + WebSocket)
- [x] done

**Files:** `apps/kiosk/src/data/adapters/http/http-client.ts`, `apps/kiosk/src/data/adapters/http/http-client.test.ts`,
`apps/kiosk/src/data/test/room-state.ts`

**Context:** ARCHITECTURE §4.4 (`credentials: "same-origin"`, every response parsed with the contracts schema,
non-2xx → typed error, WS at `ws(s)://${location.host}/ws`), §4.5 (client sends `hello {label}` on connect;
answers `ping` with `pong`), §5 (mutations send `Content-Type: application/json`). Contracts used:
`GetSessionResponse`, `GetStateResponse`, `PostCommandResponse`, `CommandRequest`, `ApiError`, `ServerEvent`,
`ClientMessage`. Invalid frames are dropped with a `console.warn`, never thrown. Only tests exercise this adapter
until M08. `SocketLike` is the subset of the browser `WebSocket` the adapter uses; tests pass a fake.

**Do:**
1. Create the test helper `apps/kiosk/src/data/test/room-state.ts` (used by many later tests):
```ts
import { RoomState } from "@eduscope/contracts";
import roomNormal from "@eduscope/contracts/fixtures/state/room-normal.json";

/** A fresh, parsed copy of the golden fixture (screenshot 01) for tests. */
export function roomState(overrides: Partial<RoomState> = {}): RoomState {
  return { ...RoomState.parse(roomNormal), ...overrides };
}
```
2. Create `apps/kiosk/src/data/adapters/http/http-client.ts`:
```ts
import {
  ApiError, ClientMessage, CommandRequest, GetSessionResponse, GetStateResponse,
  PostCommandResponse, ServerEvent,
} from "@eduscope/contracts";
import type { z } from "zod";
import { ApiRequestError, type ApiClient, type RealtimeConnection } from "@/data/api-client";

// fetch + WebSocket adapter (ARCHITECTURE §4.4). Every response and frame is zod-parsed.
// Exercised by tests only until M08 brings core-api.

/** The slice of the browser WebSocket this adapter uses (a fake implements it in tests). */
export interface SocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface HttpClientOptions {
  fetch?: typeof fetch;
  /** Prefix for `/api/...`; empty = same origin. */
  baseUrl?: string;
  /** Full WS URL, e.g. `ws://r-101.local/ws`. */
  wsUrl: string;
  createSocket?: (url: string) => SocketLike;
}

/** `ws(s)://<host>/ws` for the page's own origin. */
export function sameOriginWsUrl(location: Pick<Location, "protocol" | "host">): string {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

export function createHttpApiClient(options: HttpClientOptions): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? "";
  const createSocket = options.createSocket ?? ((url: string): SocketLike => new WebSocket(url));

  async function request<S extends z.ZodType>(schema: S, path: string, init?: RequestInit): Promise<z.infer<S>> {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, { credentials: "same-origin", ...init });
    } catch {
      throw new ApiRequestError("network", "Can't reach the controller", null);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ApiError.safeParse(body);
      if (error.success) throw new ApiRequestError(error.data.code, error.data.message, response.status);
      throw new ApiRequestError("bad_response", `HTTP ${response.status}`, response.status);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiRequestError("bad_response", `Unexpected response from ${path}`, response.status);
    return parsed.data;
  }

  return {
    getSession: () => request(GetSessionResponse, "/api/session"),
    getState: () => request(GetStateResponse, "/api/state"),
    sendCommand: async (commandRequest) =>
      request(PostCommandResponse, "/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CommandRequest.parse(commandRequest)),
      }),
    connect(label, handlers): RealtimeConnection {
      const socket = createSocket(options.wsUrl);
      let closed = false;
      const send = (message: ClientMessage): void => socket.send(JSON.stringify(ClientMessage.parse(message)));
      const finish = (): void => {
        if (closed) return;
        closed = true;
        handlers.onClose();
      };
      socket.onopen = () => {
        send({ type: "hello", label });
        handlers.onOpen();
      };
      socket.onmessage = (message) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(message.data));
        } catch {
          console.warn("ws: dropped a non-JSON frame");
          return;
        }
        const parsed = ServerEvent.safeParse(raw);
        if (!parsed.success) {
          console.warn("ws: dropped an invalid frame", parsed.error.issues);
          return;
        }
        if (parsed.data.type === "ping") send({ type: "pong" });
        handlers.onEvent(parsed.data);
      };
      socket.onclose = finish;
      socket.onerror = finish;
      return {
        close() {
          closed = true; // a deliberate close is not reported as a drop
          socket.close();
        },
      };
    },
  };
}
```

**Test:** `apps/kiosk/src/data/adapters/http/http-client.test.ts`
```ts
import type { Command, ServerEvent } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/data/api-client";
import { roomState } from "@/data/test/room-state";
import { createHttpApiClient, sameOriginWsUrl, type SocketLike } from "./http-client";

const CMD_ID = "00000000-0000-4000-8000-000000000001";
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function client(fetchImpl: typeof fetch) {
  return createHttpApiClient({ fetch: fetchImpl, wsUrl: "ws://r-101.local/ws" });
}

class FakeSocket implements SocketLike {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];
  closed = false;
  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; }
  emit(data: string) { this.onmessage?.(new MessageEvent("message", { data })); }
  /** CloseEvent is not a global before Node 23, so build one structurally. */
  fireClose() { this.onclose?.(Object.assign(new Event("close"), { code: 1006, reason: "", wasClean: false })); }
  fireError() { this.onerror?.(new Event("error")); }
}

describe("http adapter: REST", () => {
  it("getState parses the RoomState", async () => {
    const fetchMock = vi.fn(async () => json(200, roomState()));
    const state = await client(fetchMock).getState();
    expect(state.room.id).toBe("R-101");
    expect(fetchMock).toHaveBeenCalledWith("/api/state", { credentials: "same-origin" });
  });

  it("rejects a response that fails the contract", async () => {
    const fetchMock = vi.fn(async () => json(200, { rev: "nope" }));
    await expect(client(fetchMock).getState()).rejects.toMatchObject({ code: "bad_response" });
  });

  it("maps an ApiError body to ApiRequestError", async () => {
    const fetchMock = vi.fn(async () => json(401, { code: "unauthorized", message: "PIN required" }));
    const error: unknown = await client(fetchMock).getSession().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: "unauthorized", message: "PIN required", status: 401 });
  });

  it("maps a non-JSON error body to bad_response", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>", { status: 502 }));
    await expect(client(fetchMock).getSession()).rejects.toMatchObject({ code: "bad_response", status: 502 });
  });

  it("maps a fetch rejection to network", async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expect(client(fetchMock).getState()).rejects.toMatchObject({ code: "network", status: null });
  });

  it("sendCommand POSTs JSON and parses the 202 Command", async () => {
    const accepted: Command = {
      id: "cmd-1", client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true },
      issued_by: { public_id: "p1", label: "laptop" }, status: "pending", error: null,
      at: "2026-10-05T10:42:00Z",
    };
    const fetchMock = vi.fn(async () => json(202, accepted));
    const result = await client(fetchMock).sendCommand({ client_cmd_id: CMD_ID, body: accepted.body });
    expect(result).toEqual(accepted);
    expect(fetchMock).toHaveBeenCalledWith("/api/commands", {
      credentials: "same-origin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_cmd_id: CMD_ID, body: accepted.body }),
    });
  });

  it("sendCommand refuses an invalid request before fetching", async () => {
    const fetchMock = vi.fn(async () => json(202, {}));
    await expect(
      client(fetchMock).sendCommand({ client_cmd_id: "not-a-uuid", body: { kind: "ac.power", on: true } }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("http adapter: WebSocket", () => {
  function connect() {
    const socket = new FakeSocket();
    const api = createHttpApiClient({ fetch: vi.fn(), wsUrl: "ws://r-101.local/ws", createSocket: () => socket });
    const handlers = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    const connection = api.connect("phone", handlers);
    return { socket, handlers, connection };
  }

  it("sends hello with the client label on open", () => {
    const { socket, handlers } = connect();
    socket.onopen?.(new Event("open"));
    expect(socket.sent).toEqual([JSON.stringify({ type: "hello", label: "phone" })]);
    expect(handlers.onOpen).toHaveBeenCalled();
  });

  it("parses frames and forwards valid ServerEvents", () => {
    const { socket, handlers } = connect();
    const event: ServerEvent = { type: "activity", text: "Rear of room turned on", by: "phone", public_id: "x" };
    socket.emit(JSON.stringify(event));
    expect(handlers.onEvent).toHaveBeenCalledWith(event);
  });

  it("answers ping with pong", () => {
    const { socket, handlers } = connect();
    socket.emit(JSON.stringify({ type: "ping" }));
    expect(socket.sent).toContain(JSON.stringify({ type: "pong" }));
    expect(handlers.onEvent).toHaveBeenCalledWith({ type: "ping" });
  });

  it("drops non-JSON and invalid frames", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { socket, handlers } = connect();
    socket.emit("not json");
    socket.emit(JSON.stringify({ type: "state", state: { rev: -1 } }));
    expect(handlers.onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("reports close once, and not after a deliberate close()", () => {
    const first = connect();
    first.socket.fireError();
    first.socket.fireClose();
    expect(first.handlers.onClose).toHaveBeenCalledTimes(1);

    const second = connect();
    second.connection.close();
    second.socket.fireClose();
    expect(second.socket.closed).toBe(true);
    expect(second.handlers.onClose).not.toHaveBeenCalled();
  });
});

describe("sameOriginWsUrl", () => {
  it("uses ws for http and wss for https", () => {
    expect(sameOriginWsUrl({ protocol: "http:", host: "r-101.local" })).toBe("ws://r-101.local/ws");
    expect(sameOriginWsUrl({ protocol: "https:", host: "x:8443" })).toBe("wss://x:8443/ws");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/http` → 13 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): http ApiClient adapter with zod-parsed responses and frames"`

---

### T14 — Pending store
- [x] done

**Files:** `apps/kiosk/src/data/commands/pending-store.ts`, `apps/kiosk/src/data/commands/pending-store.test.ts`

**Context:** SPEC H5 (pulsing overlay, label unchanged, same-control repeat taps ignored, other controls stay
usable), H4 (snapshot clears every overlay), ARCHITECTURE §4.6 steps 2–5 (safety net: pending older than
transport timeout + 5 s is cleared locally; transport timeouts are open question Q12, so 10 s is `[ASSUMED]`).
Entries are keyed by a **control key**: the `OutputId` (`"lights.front"`) or `"<OutputId>:<variant>"`
(`"projector.ir:on"`) when one output has several buttons.

**Do:**
1. Create `apps/kiosk/src/data/commands/pending-store.ts`:
```ts
import { createStore, type Store } from "@/lib/store";

// H5 / ARCHITECTURE §4.6: the pending overlay is the ONLY optimistic thing in the UI.
// Keyed by a control key: an OutputId ("lights.front") or "<OutputId>:<variant>"
// ("projector.ir:on") when one output has several buttons.
export type ControlKey = string;

export interface PendingEntry {
  key: ControlKey;
  clientCmdId: string;
  status: "pending" | "sent";
  startedAt: number;
}

/** Transport timeout (Q12, [ASSUMED] 10 s) + 5 s safety margin (ARCHITECTURE §4.6 step 5). */
export const PENDING_SAFETY_MS = 15_000;

export interface PendingStore {
  entries: Store<ReadonlyMap<ControlKey, PendingEntry>>;
  isPending(key: ControlKey): boolean;
  add(entry: PendingEntry): void;
  /** `sent` keeps the overlay. Returns false when the command is not ours. */
  markSent(clientCmdId: string): boolean;
  /** Removes and returns the entry for a terminal status or an HTTP error. */
  remove(clientCmdId: string): PendingEntry | undefined;
  /** Snapshot (H4) clears every overlay. */
  clear(): void;
  /** Removes entries older than `maxAgeMs` and returns them. */
  sweep(now: number, maxAgeMs?: number): PendingEntry[];
}

export function createPendingStore(): PendingStore {
  const entries = createStore<ReadonlyMap<ControlKey, PendingEntry>>(new Map());

  const findByCmdId = (clientCmdId: string): PendingEntry | undefined => {
    for (const entry of entries.get().values()) {
      if (entry.clientCmdId === clientCmdId) return entry;
    }
    return undefined;
  };
  const without = (keys: ControlKey[]): void => {
    const next = new Map(entries.get());
    for (const key of keys) next.delete(key);
    entries.set(next);
  };

  return {
    entries,
    isPending: (key) => entries.get().has(key),
    add(entry) {
      const next = new Map(entries.get());
      next.set(entry.key, entry);
      entries.set(next);
    },
    markSent(clientCmdId) {
      const entry = findByCmdId(clientCmdId);
      if (entry === undefined) return false;
      const next = new Map(entries.get());
      next.set(entry.key, { ...entry, status: "sent" });
      entries.set(next);
      return true;
    },
    remove(clientCmdId) {
      const entry = findByCmdId(clientCmdId);
      if (entry !== undefined) without([entry.key]);
      return entry;
    },
    clear() {
      if (entries.get().size > 0) entries.set(new Map());
    },
    sweep(now, maxAgeMs = PENDING_SAFETY_MS) {
      const expired = [...entries.get().values()].filter((entry) => now - entry.startedAt > maxAgeMs);
      if (expired.length > 0) without(expired.map((entry) => entry.key));
      return expired;
    },
  };
}

export const pendingStore = createPendingStore();
```

**Test:** `apps/kiosk/src/data/commands/pending-store.test.ts`
```ts
import { describe, expect, it, vi } from "vitest";
import { createPendingStore, PENDING_SAFETY_MS, type PendingEntry } from "./pending-store";

const entry = (key: string, clientCmdId: string, startedAt = 0): PendingEntry => ({
  key, clientCmdId, status: "pending", startedAt,
});

describe("pending store", () => {
  it("marks a key pending after add", () => {
    const store = createPendingStore();
    store.add(entry("lights.front", "c1"));
    expect(store.isPending("lights.front")).toBe(true);
    expect(store.isPending("lights.rear")).toBe(false);
  });

  it("markSent keeps the entry and updates its status", () => {
    const store = createPendingStore();
    store.add(entry("lights.front", "c1"));
    expect(store.markSent("c1")).toBe(true);
    expect(store.entries.get().get("lights.front")?.status).toBe("sent");
    expect(store.isPending("lights.front")).toBe(true);
  });

  it("markSent ignores commands that are not ours", () => {
    expect(createPendingStore().markSent("other")).toBe(false);
  });

  it("remove returns and clears the entry by client_cmd_id", () => {
    const store = createPendingStore();
    store.add(entry("lights.front", "c1"));
    store.add(entry("audio.mic", "c2"));
    expect(store.remove("c1")?.key).toBe("lights.front");
    expect(store.isPending("lights.front")).toBe(false);
    expect(store.isPending("audio.mic")).toBe(true);
    expect(store.remove("c1")).toBeUndefined();
  });

  it("clear drops every entry and notifies once", () => {
    const store = createPendingStore();
    store.add(entry("a", "c1"));
    store.add(entry("b", "c2"));
    const listener = vi.fn();
    store.entries.subscribe(listener);
    store.clear();
    expect(store.entries.get().size).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("sweep removes only entries older than the safety window", () => {
    const store = createPendingStore();
    store.add(entry("old", "c1", 0));
    store.add(entry("new", "c2", 10_000));
    const expired = store.sweep(PENDING_SAFETY_MS + 1);
    expect(expired.map((e) => e.key)).toEqual(["old"]);
    expect(store.isPending("old")).toBe(false);
    expect(store.isPending("new")).toBe(true);
  });

  it("publishes a new map on every change (useSyncExternalStore safe)", () => {
    const store = createPendingStore();
    const before = store.entries.get();
    store.add(entry("a", "c1"));
    expect(store.entries.get()).not.toBe(before);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/commands/pending-store.test.ts` → 7 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): pending command store"`

---

### T15 — Inline error store (6 s)
- [x] done

**Files:** `apps/kiosk/src/data/commands/inline-errors.ts`, `apps/kiosk/src/data/commands/inline-errors.test.ts`

**Context:** SPEC H6a ("red inline line for 6 s": "Couldn't reach the blaster" / "Switch didn't respond" /
"Command failed" — the specific texts come from the server's `command.error`), H6b ("No response · tap to
retry"). Keyed by the same control key as the pending store.

**Do:**
1. Create `apps/kiosk/src/data/commands/inline-errors.ts`:
```ts
import { createStore, type Store } from "@/lib/store";
import type { ControlKey } from "./pending-store";

// H6a / H6b: a red inline line on the card for 6 s.
export const INLINE_ERROR_MS = 6000;
export const MESSAGE_FAILED = "Command failed";
export const MESSAGE_TIMED_OUT = "No response · tap to retry";

export interface InlineErrorStore {
  errors: Store<ReadonlyMap<ControlKey, string>>;
  show(key: ControlKey, message: string): void;
  dismiss(key: ControlKey): void;
}

export function createInlineErrorStore(durationMs: number = INLINE_ERROR_MS): InlineErrorStore {
  const errors = createStore<ReadonlyMap<ControlKey, string>>(new Map());
  const timers = new Map<ControlKey, ReturnType<typeof setTimeout>>();

  const dismiss = (key: ControlKey): void => {
    const timer = timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(key);
    if (!errors.get().has(key)) return;
    const next = new Map(errors.get());
    next.delete(key);
    errors.set(next);
  };

  return {
    errors,
    show(key, message) {
      dismiss(key);
      const next = new Map(errors.get());
      next.set(key, message);
      errors.set(next);
      timers.set(key, setTimeout(() => dismiss(key), durationMs));
    },
    dismiss,
  };
}

export const inlineErrorStore = createInlineErrorStore();
```

**Test:** `apps/kiosk/src/data/commands/inline-errors.test.ts`
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInlineErrorStore, INLINE_ERROR_MS } from "./inline-errors";

describe("inline error store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a message for 6 s", () => {
    const store = createInlineErrorStore();
    store.show("lights.front", "Switch didn't respond");
    expect(store.errors.get().get("lights.front")).toBe("Switch didn't respond");
    vi.advanceTimersByTime(INLINE_ERROR_MS - 1);
    expect(store.errors.get().has("lights.front")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.errors.get().has("lights.front")).toBe(false);
  });

  it("restarts the 6 s window when shown again", () => {
    const store = createInlineErrorStore();
    store.show("a", "first");
    vi.advanceTimersByTime(4000);
    store.show("a", "second");
    vi.advanceTimersByTime(4000);
    expect(store.errors.get().get("a")).toBe("second");
    vi.advanceTimersByTime(2000);
    expect(store.errors.get().has("a")).toBe(false);
  });

  it("dismiss clears immediately", () => {
    const store = createInlineErrorStore();
    store.show("a", "x");
    store.dismiss("a");
    expect(store.errors.get().size).toBe(0);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/commands/inline-errors.test.ts` → 3 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): inline command error store"`

---

### T16 — Command sender
- [x] done

**Files:** `apps/kiosk/src/data/commands/command-sender.ts`, `apps/kiosk/src/data/commands/command-sender.test.ts`

**Context:** ARCHITECTURE §4.6 steps 1–3: repeat tap while pending → ignored; generate `client_cmd_id`
(`crypto.randomUUID()`, a global in Node ≥19 and every browser), add pending **before** the POST (the WS
`command` event can arrive before the 202 resolves); HTTP error → remove pending + InlineError "Command
failed"; 202 → keep pending. The gate check (connection/access/offline) happens in `useCommand` (T24).
Nothing here writes a value into the query cache (R12, D-04).

**Do:**
1. Create `apps/kiosk/src/data/commands/command-sender.ts`:
```ts
import type { CommandBody } from "@eduscope/contracts";
import type { ApiClient } from "@/data/api-client";
import { MESSAGE_FAILED, type InlineErrorStore } from "./inline-errors";
import type { ControlKey, PendingStore } from "./pending-store";

// ARCHITECTURE §4.6 steps 1–3. The gate check happens in useCommand before this is called.
export interface CommandSenderDeps {
  api: Pick<ApiClient, "sendCommand">;
  pending: PendingStore;
  inlineErrors: InlineErrorStore;
  newId?: () => string;
  now?: () => number;
}

export type SendOutcome = "sent" | "ignored";

export function createCommandSender(deps: CommandSenderDeps) {
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const now = deps.now ?? Date.now;

  return async function send(key: ControlKey, body: CommandBody): Promise<SendOutcome> {
    if (deps.pending.isPending(key)) return "ignored"; // H5: repeat taps ignored
    const clientCmdId = newId();
    deps.inlineErrors.dismiss(key);
    deps.pending.add({ key, clientCmdId, status: "pending", startedAt: now() });
    try {
      await deps.api.sendCommand({ client_cmd_id: clientCmdId, body });
      return "sent"; // 202: keep pending until a `command` event
    } catch {
      if (deps.pending.remove(clientCmdId) !== undefined) {
        deps.inlineErrors.show(key, MESSAGE_FAILED);
      }
      return "sent";
    }
  };
}
```

**Test:** `apps/kiosk/src/data/commands/command-sender.test.ts`
```ts
import type { Command, CommandRequest } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/data/api-client";
import { createCommandSender } from "./command-sender";
import { createInlineErrorStore, MESSAGE_FAILED } from "./inline-errors";
import { createPendingStore } from "./pending-store";

const ID = "00000000-0000-4000-8000-000000000001";
const accepted = (request: CommandRequest): Command => ({
  id: "cmd-1", client_cmd_id: request.client_cmd_id, body: request.body,
  issued_by: { public_id: "me", label: "laptop" }, status: "pending", error: null,
  at: "2026-10-05T10:42:00Z",
});

function setup(sendCommand: (request: CommandRequest) => Promise<Command>) {
  const pending = createPendingStore();
  const inlineErrors = createInlineErrorStore();
  const api = { sendCommand: vi.fn(sendCommand) };
  const send = createCommandSender({ api, pending, inlineErrors, newId: () => ID, now: () => 5 });
  return { pending, inlineErrors, api, send };
}

describe("command sender", () => {
  it("adds a pending entry before POSTing and keeps it on 202", async () => {
    const { pending, api, send } = setup(async (request) => accepted(request));
    const outcome = await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    expect(outcome).toBe("sent");
    expect(api.sendCommand).toHaveBeenCalledWith({
      client_cmd_id: ID, body: { kind: "lights.set", gang: "front", on: false },
    });
    expect(pending.entries.get().get("lights.front")).toEqual({
      key: "lights.front", clientCmdId: ID, status: "pending", startedAt: 5,
    });
  });

  it("ignores a repeat tap while the key is pending", async () => {
    const { api, send } = setup(async (request) => accepted(request));
    await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    const outcome = await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    expect(outcome).toBe("ignored");
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("other keys stay usable while one is pending", async () => {
    const { api, send } = setup(async (request) => accepted(request));
    await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    await send("lights.rear", { kind: "lights.set", gang: "rear", on: true });
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("on an HTTP error clears pending and shows the inline error", async () => {
    const { pending, inlineErrors, send } = setup(async () => {
      throw new ApiRequestError("hw_unavailable", "hw down", 503);
    });
    await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    expect(pending.isPending("lights.front")).toBe(false);
    expect(inlineErrors.errors.get().get("lights.front")).toBe(MESSAGE_FAILED);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/commands/command-sender.test.ts` → 4 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): command sender with pending overlay"`

---

### T17 — `apply-event.ts`: ServerEvent → client state
- [x] done

**Files:** `apps/kiosk/src/data/realtime/apply-event.ts`, `apps/kiosk/src/data/realtime/apply-event.test.ts`

**Context:** ARCHITECTURE §4.5 event table: `snapshot` → replace `["state"]`, clear pending, invalidate all
non-state queries; `state` → replace only if `rev` > cached `rev`; `command` → advance pending (`sent` keeps,
`confirmed`/`assumed` clear, `failed`/`timed_out` clear + InlineError); `activity` → toast unless `public_id` is
our own session (H13); `invalidate` → invalidate keys; `session` → replace `["session"]`; `ir_capture` → no-op
until M06 (decision 6); `ping` → no-op (the connection manager counts frames). A snapshot is accepted even with a
lower `rev` because a restarted server starts again from 0. Pure: all side effects go through `ApplyEventDeps`,
so the mock and the http adapter share this single path (M02 notes).

**Do:**
1. Create `apps/kiosk/src/data/realtime/apply-event.ts`:
```ts
import type { ClientSession, Command, RoomState, ServerEvent } from "@eduscope/contracts";
import { formatActivity } from "@/lib/format";
import { MESSAGE_FAILED, MESSAGE_TIMED_OUT, type InlineErrorStore } from "@/data/commands/inline-errors";
import type { PendingStore } from "@/data/commands/pending-store";

// ServerEvent → client state (ARCHITECTURE §4.5). Pure apart from the injected ports, so the
// mock and the http adapter share this one path. Never writes values optimistically.

/** The query cache as apply-event sees it (implemented over QueryClient in cache-port.ts). */
export interface CachePort {
  getState(): RoomState | undefined;
  setState(state: RoomState): void;
  getSession(): ClientSession | undefined;
  setSession(session: ClientSession): void;
  invalidateAllExceptState(): void;
  invalidate(keys: readonly (readonly string[])[]): void;
}

export interface ApplyEventDeps {
  cache: CachePort;
  pending: PendingStore;
  inlineErrors: InlineErrorStore;
  /** H13 toast (bottom, 4 s). */
  toast(text: string): void;
  /** S1.E2 server clock offset. */
  syncServerTime(serverTimeIso: string): void;
}

function applyCommand(command: Command, deps: ApplyEventDeps): void {
  switch (command.status) {
    case "pending":
      return;
    case "sent":
      deps.pending.markSent(command.client_cmd_id);
      return;
    case "confirmed":
    case "assumed":
      deps.pending.remove(command.client_cmd_id);
      return;
    case "failed":
    case "timed_out": {
      const entry = deps.pending.remove(command.client_cmd_id);
      if (entry === undefined) return; // another client's command
      const message = command.status === "timed_out" ? MESSAGE_TIMED_OUT : (command.error ?? MESSAGE_FAILED);
      deps.inlineErrors.show(entry.key, message);
      return;
    }
  }
}

export function applyEvent(event: ServerEvent, deps: ApplyEventDeps): void {
  switch (event.type) {
    case "snapshot":
      // H4: full replace regardless of rev (a restarted server starts again at rev 0).
      deps.cache.setState(event.state);
      deps.syncServerTime(event.state.server_time);
      deps.pending.clear();
      deps.cache.invalidateAllExceptState();
      return;
    case "state": {
      const current = deps.cache.getState();
      if (current === undefined || event.state.rev <= current.rev) return; // stale or before snapshot
      deps.cache.setState(event.state);
      deps.syncServerTime(event.state.server_time);
      return;
    }
    case "command":
      applyCommand(event.command, deps);
      return;
    case "activity": {
      const own = deps.cache.getSession()?.public_id;
      if (event.public_id !== null && event.public_id === own) return;
      deps.toast(formatActivity(event.text, event.by));
      return;
    }
    case "ir_capture":
      return; // M06 adds the capture store (H21)
    case "invalidate":
      deps.cache.invalidate(event.keys);
      return;
    case "session":
      deps.cache.setSession(event.session);
      return;
    case "ping":
      return; // liveness only: the connection manager records every frame
  }
}
```

**Test:** `apps/kiosk/src/data/realtime/apply-event.test.ts`
```ts
import type { ClientSession, Command, RoomState, ServerEvent } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { createInlineErrorStore, MESSAGE_FAILED, MESSAGE_TIMED_OUT } from "@/data/commands/inline-errors";
import { createPendingStore } from "@/data/commands/pending-store";
import { roomState } from "@/data/test/room-state";
import { applyEvent, type CachePort } from "./apply-event";

const CMD_ID = "00000000-0000-4000-8000-000000000001";
const session: ClientSession = {
  public_id: "me", client_type: "remote", label: "laptop", access: "control",
  unlocked_at: null, last_activity: null, expires_at: null,
};

function fakeCache(initial?: RoomState) {
  let state = initial;
  let currentSession: ClientSession | undefined = session;
  const cache: CachePort & { invalidated: string[][]; allInvalidated: number } = {
    invalidated: [],
    allInvalidated: 0,
    getState: () => state,
    setState: (next) => { state = next; },
    getSession: () => currentSession,
    setSession: (next) => { currentSession = next; },
    invalidateAllExceptState() { cache.allInvalidated += 1; },
    invalidate(keys) { cache.invalidated.push(...keys.map((key) => [...key])); },
  };
  return cache;
}

function setup(initial?: RoomState) {
  const cache = fakeCache(initial);
  const pending = createPendingStore();
  const inlineErrors = createInlineErrorStore();
  const toast = vi.fn();
  const syncServerTime = vi.fn();
  const deps = { cache, pending, inlineErrors, toast, syncServerTime };
  return { ...deps, apply: (event: ServerEvent) => applyEvent(event, deps) };
}

const command = (status: Command["status"], error: string | null = null): Command => ({
  id: "cmd-1", client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true },
  issued_by: { public_id: "me", label: "laptop" }, status, error, at: "2026-10-05T10:42:01Z",
});

describe("applyEvent", () => {
  it("snapshot replaces state, syncs the clock, clears pending and invalidates other queries", () => {
    const t = setup(roomState({ rev: 50 }));
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    const next = roomState({ rev: 3, server_time: "2026-10-05T11:00:00Z" });
    t.apply({ type: "snapshot", state: next });
    expect(t.cache.getState()).toBe(next); // lower rev accepted: snapshots always win
    expect(t.syncServerTime).toHaveBeenCalledWith("2026-10-05T11:00:00Z");
    expect(t.pending.entries.get().size).toBe(0);
    expect(t.cache.allInvalidated).toBe(1);
  });

  it("state with a higher rev replaces the cache", () => {
    const t = setup(roomState({ rev: 1 }));
    const next = roomState({ rev: 2 });
    t.apply({ type: "state", state: next });
    expect(t.cache.getState()).toBe(next);
    expect(t.syncServerTime).toHaveBeenCalledWith(next.server_time);
  });

  it("drops a state with a stale or equal rev", () => {
    const current = roomState({ rev: 5 });
    const t = setup(current);
    t.apply({ type: "state", state: roomState({ rev: 4 }) });
    t.apply({ type: "state", state: roomState({ rev: 5 }) });
    expect(t.cache.getState()).toBe(current);
    expect(t.syncServerTime).not.toHaveBeenCalled();
  });

  it("drops a state that arrives before any snapshot", () => {
    const t = setup(undefined);
    t.apply({ type: "state", state: roomState({ rev: 9 }) });
    expect(t.cache.getState()).toBeUndefined();
  });

  it("command sent keeps the overlay", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("sent") });
    expect(t.pending.entries.get().get("lights.rear")?.status).toBe("sent");
  });

  it.each(["confirmed", "assumed"] as const)("command %s clears the overlay without an error", (status) => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command(status) });
    expect(t.pending.isPending("lights.rear")).toBe(false);
    expect(t.inlineErrors.errors.get().size).toBe(0);
  });

  it("command failed clears the overlay and shows the server error (H6a)", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("failed", "Switch didn't respond") });
    expect(t.pending.isPending("lights.rear")).toBe(false);
    expect(t.inlineErrors.errors.get().get("lights.rear")).toBe("Switch didn't respond");
  });

  it("command failed without an error text shows the generic message", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("failed") });
    expect(t.inlineErrors.errors.get().get("lights.rear")).toBe(MESSAGE_FAILED);
  });

  it("command timed_out shows 'No response · tap to retry' (H6b)", () => {
    const t = setup(roomState());
    t.pending.add({ key: "lights.rear", clientCmdId: CMD_ID, status: "pending", startedAt: 0 });
    t.apply({ type: "command", command: command("timed_out") });
    expect(t.inlineErrors.errors.get().get("lights.rear")).toBe(MESSAGE_TIMED_OUT);
  });

  it("ignores failures of other clients' commands", () => {
    const t = setup(roomState());
    t.apply({ type: "command", command: command("failed", "x") });
    expect(t.inlineErrors.errors.get().size).toBe(0);
  });

  it("activity from another client shows an attributed toast (H13)", () => {
    const t = setup(roomState());
    t.apply({ type: "activity", text: "Rear of room turned on", by: "phone", public_id: "other" });
    expect(t.toast).toHaveBeenCalledWith("Rear of room turned on · from phone");
  });

  it("activity by hand (no session) shows a toast", () => {
    const t = setup(roomState());
    t.apply({ type: "activity", text: "Front of room turned off", by: "by hand", public_id: null });
    expect(t.toast).toHaveBeenCalledWith("Front of room turned off · by hand");
  });

  it("activity from this client is not toasted", () => {
    const t = setup(roomState());
    t.apply({ type: "activity", text: "Rear of room turned on", by: "laptop", public_id: "me" });
    expect(t.toast).not.toHaveBeenCalled();
  });

  it("invalidate forwards the keys", () => {
    const t = setup(roomState());
    t.apply({ type: "invalidate", keys: [["ir", "devices"], ["schedule"]] });
    expect(t.cache.invalidated).toEqual([["ir", "devices"], ["schedule"]]);
  });

  it("session replaces the cached session", () => {
    const t = setup(roomState());
    const next: ClientSession = { ...session, access: "view" };
    t.apply({ type: "session", session: next });
    expect(t.cache.getSession()).toBe(next);
  });

  it("ping and ir_capture change nothing", () => {
    const state = roomState();
    const t = setup(state);
    t.apply({ type: "ping" });
    t.apply({ type: "ir_capture", command_id: "c", status: "listening", deadline: null });
    expect(t.cache.getState()).toBe(state);
    expect(t.toast).not.toHaveBeenCalled();
    expect(t.cache.invalidated).toEqual([]);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/realtime/apply-event.test.ts` → 17 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): apply server events to the cache"`

---

### T18 — Cache port over TanStack Query
- [ ] done

**Files:** `apps/kiosk/src/data/realtime/cache-port.ts`, `apps/kiosk/src/data/realtime/cache-port.test.ts`

**Context:** Implements T17's `CachePort` with the typed query options from T11 (no casts). "Invalidate all
non-state queries" uses a predicate on the first key segment (`STATE_ROOT_KEY`).

**Do:**
1. Create `apps/kiosk/src/data/realtime/cache-port.ts`:
```ts
import type { QueryClient } from "@tanstack/react-query";
import { sessionQuery, stateQuery } from "@/data/queries";
import { STATE_ROOT_KEY } from "@/data/query-keys";
import type { ApiClient } from "@/data/api-client";
import type { CachePort } from "./apply-event";

/** CachePort over TanStack Query. The typed query options carry the data type, no casts. */
export function createCachePort(queryClient: QueryClient, api: ApiClient): CachePort {
  const sessionKey = sessionQuery(api).queryKey;
  return {
    getState: () => queryClient.getQueryData(stateQuery.queryKey),
    setState: (state) => {
      queryClient.setQueryData(stateQuery.queryKey, state);
    },
    getSession: () => queryClient.getQueryData(sessionKey),
    setSession: (session) => {
      queryClient.setQueryData(sessionKey, session);
    },
    invalidateAllExceptState() {
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== STATE_ROOT_KEY });
    },
    invalidate(keys) {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  };
}
```

**Test:** `apps/kiosk/src/data/realtime/cache-port.test.ts`
```ts
import type { ClientSession } from "@eduscope/contracts";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@/data/api-client";
import { queryKeys } from "@/data/query-keys";
import { roomState } from "@/data/test/room-state";
import { createCachePort } from "./cache-port";

const api: ApiClient = {
  getSession: vi.fn(),
  getState: vi.fn(),
  sendCommand: vi.fn(),
  connect: vi.fn(),
};
const session: ClientSession = {
  public_id: "me", client_type: "remote", label: "laptop", access: "control",
  unlocked_at: null, last_activity: null, expires_at: null,
};

describe("cache port", () => {
  it("round-trips state and session through the query cache", () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    expect(port.getState()).toBeUndefined();
    const state = roomState();
    port.setState(state);
    port.setSession(session);
    expect(port.getState()).toBe(state);
    expect(queryClient.getQueryData(queryKeys.state())).toBe(state);
    expect(port.getSession()).toBe(session);
  });

  it("invalidateAllExceptState leaves ['state'] valid", async () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    port.setState(roomState());
    queryClient.setQueryData(queryKeys.devices(), []);
    port.invalidateAllExceptState();
    expect(queryClient.getQueryState(queryKeys.state())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.devices())?.isInvalidated).toBe(true);
  });

  it("invalidate marks only the given keys", () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    queryClient.setQueryData(queryKeys.irDevices(), []);
    queryClient.setQueryData(queryKeys.schedule(), {});
    port.invalidate([["ir", "devices"]]);
    expect(queryClient.getQueryState(queryKeys.irDevices())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.schedule())?.isInvalidated).toBe(false);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/realtime/cache-port.test.ts` → 3 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): query cache port for realtime events"`

---

### T19 — Connection state machine
- [ ] done

**Files:** `apps/kiosk/src/data/realtime/connection.ts`, `apps/kiosk/src/data/realtime/connection.test.ts`,
`apps/kiosk/src/data/realtime/connection-store.ts`

**Context:** ARCHITECTURE §4.5 diagram and bullets; SPEC §2.5, H1–H4. Rules implemented exactly:
- `connecting` until the first `snapshot` → `live`.
- Close / failed open / **25 s with no frame** (server pings every 10 s) → `reconnecting`; reconnect after
  0.5, 1, 2, 4, 8, 8… s, each ±20% jitter.
- 10 s after the drop, still not resynced → `unreachable` (attempts continue at 8 s).
- `snapshot` while `reconnecting`/`unreachable` → `back_online` for 2 s → `live`; backoff resets.
- `retry()` (Retry button) and `resume()` (tab visible / `online`; only if not live **or** last frame > 15 s ago)
  close the socket and reconnect **immediately** with a fresh backoff (AC5).
- Every socket gets a generation number; callbacks from a replaced socket are ignored.
- A first connect that fails also shows `reconnecting` (accepted simplification).

**Do:**
1. Create `apps/kiosk/src/data/realtime/connection.ts`:
```ts
import type { ServerEvent } from "@eduscope/contracts";
import type { RealtimeConnection, RealtimeHandlers } from "@/data/api-client";
import { createStore, type Store } from "@/lib/store";

// Connection state machine (ARCHITECTURE §4.5, SPEC §2.5, H1–H4).
//
//   connecting ─snapshot─▶ live ─close / 25 s silence─▶ reconnecting ─10 s─▶ unreachable
//        reconnecting|unreachable ─snapshot─▶ back_online ─2 s─▶ live
//   retry() / resume() (tab visible, `online`) reconnect immediately with a fresh backoff.

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "unreachable" | "back_online";

export const BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;
export const JITTER = 0.2;
export const UNREACHABLE_AFTER_MS = 10_000;
export const BACK_ONLINE_MS = 2_000;
export const DEAD_AFTER_MS = 25_000;
export const RESUME_STALE_MS = 15_000;

export interface ConnectionDeps {
  open(handlers: RealtimeHandlers): RealtimeConnection;
  onEvent(event: ServerEvent): void;
  store?: Store<ConnectionStatus>;
  now?: () => number;
  random?: () => number;
}

export interface ConnectionManager {
  status: Store<ConnectionStatus>;
  start(): void;
  stop(): void;
  /** Retry button (H2). */
  retry(): void;
  /** `visibilitychange` → visible or `online` (H4: never show pre-sleep values as current). */
  resume(): void;
}

/** Delay before reconnect attempt `attempt` (0-based): 0.5, 1, 2, 4, 8, 8… s ±20%. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 8000;
  return Math.round(base * (1 - JITTER + 2 * JITTER * random()));
}

export function createConnectionManager(deps: ConnectionDeps): ConnectionManager {
  const status = deps.store ?? createStore<ConnectionStatus>("connecting");
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;

  let socket: RealtimeConnection | null = null;
  let generation = 0;
  let attempt = 0;
  let lastFrameAt: number | null = null;
  let running = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let unreachableTimer: ReturnType<typeof setTimeout> | null = null;
  let backOnlineTimer: ReturnType<typeof setTimeout> | null = null;
  let deadTimer: ReturnType<typeof setTimeout> | null = null;

  const clear = (timer: ReturnType<typeof setTimeout> | null): null => {
    if (timer !== null) clearTimeout(timer);
    return null;
  };
  const clearAllTimers = (): void => {
    reconnectTimer = clear(reconnectTimer);
    unreachableTimer = clear(unreachableTimer);
    backOnlineTimer = clear(backOnlineTimer);
    deadTimer = clear(deadTimer);
  };

  const closeSocket = (): void => {
    generation += 1; // late callbacks from the old socket are ignored
    deadTimer = clear(deadTimer);
    const old = socket;
    socket = null;
    old?.close();
  };

  const armDeadTimer = (): void => {
    deadTimer = clear(deadTimer);
    deadTimer = setTimeout(() => dropped(), DEAD_AFTER_MS);
  };

  const onFrame = (event: ServerEvent): void => {
    lastFrameAt = now();
    armDeadTimer();
    deps.onEvent(event);
    if (event.type !== "snapshot") return;
    attempt = 0;
    reconnectTimer = clear(reconnectTimer);
    unreachableTimer = clear(unreachableTimer);
    const current = status.get();
    if (current === "reconnecting" || current === "unreachable") {
      status.set("back_online");
      backOnlineTimer = clear(backOnlineTimer);
      backOnlineTimer = setTimeout(() => {
        backOnlineTimer = null;
        if (status.get() === "back_online") status.set("live");
      }, BACK_ONLINE_MS);
    } else if (current === "connecting") {
      status.set("live");
    }
  };

  const openSocket = (): void => {
    closeSocket();
    const mine = generation;
    socket = deps.open({
      onOpen: () => {
        if (mine === generation) armDeadTimer();
      },
      onEvent: (event) => {
        if (mine === generation) onFrame(event);
      },
      onClose: () => {
        if (mine === generation) dropped();
      },
    });
  };

  const scheduleReconnect = (): void => {
    reconnectTimer = clear(reconnectTimer);
    const delay = backoffDelay(attempt, random);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (running) openSocket();
    }, delay);
  };

  const enterReconnecting = (): void => {
    backOnlineTimer = clear(backOnlineTimer);
    const current = status.get();
    if (current !== "reconnecting" && current !== "unreachable") {
      status.set("reconnecting");
      unreachableTimer = clear(unreachableTimer);
      unreachableTimer = setTimeout(() => {
        unreachableTimer = null;
        if (status.get() === "reconnecting") status.set("unreachable");
      }, UNREACHABLE_AFTER_MS);
    }
  };

  /** The socket closed, failed to open, or went silent for 25 s. */
  function dropped(): void {
    if (!running) return;
    closeSocket();
    enterReconnecting();
    scheduleReconnect();
  }

  /** Close and reconnect now with a fresh backoff. */
  const reconnectNow = (): void => {
    attempt = 0;
    reconnectTimer = clear(reconnectTimer);
    closeSocket();
    enterReconnecting();
    openSocket();
  };

  return {
    status,
    start() {
      if (running) return;
      running = true;
      status.set("connecting");
      openSocket();
    },
    stop() {
      running = false;
      clearAllTimers();
      closeSocket();
    },
    retry() {
      if (!running) return;
      if (status.get() === "unreachable") {
        // H2 → H3: back to amber; the 10 s window starts again.
        status.set("reconnecting");
        unreachableTimer = clear(unreachableTimer);
        unreachableTimer = setTimeout(() => {
          unreachableTimer = null;
          if (status.get() === "reconnecting") status.set("unreachable");
        }, UNREACHABLE_AFTER_MS);
      }
      reconnectNow();
    },
    resume() {
      if (!running) return;
      const current = status.get();
      const fresh = lastFrameAt !== null && now() - lastFrameAt <= RESUME_STALE_MS;
      if ((current === "live" || current === "back_online") && fresh) return;
      reconnectNow();
    },
  };
}

/** Wires browser triggers to `resume()`. Returns the cleanup. */
export function attachResumeTriggers(manager: ConnectionManager): () => void {
  const onVisibility = (): void => {
    if (document.visibilityState === "visible") manager.resume();
  };
  const onOnline = (): void => manager.resume();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
  };
}
```
2. Create `apps/kiosk/src/data/realtime/connection-store.ts`:
```ts
import { createStore } from "@/lib/store";
import type { ConnectionStatus } from "./connection";

/** The page's connection status; written by the ConnectionManager, read by hooks. */
export const connectionStore = createStore<ConnectionStatus>("connecting");
```

**Test:** `apps/kiosk/src/data/realtime/connection.test.ts`
```ts
import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeHandlers } from "@/data/api-client";
import { roomState } from "@/data/test/room-state";
import {
  BACK_ONLINE_MS, backoffDelay, createConnectionManager, DEAD_AFTER_MS, UNREACHABLE_AFTER_MS,
} from "./connection";

/** A scripted transport: every open() records its handlers. */
function fakeTransport() {
  const sockets: { handlers: RealtimeHandlers; closed: boolean }[] = [];
  return {
    sockets,
    open(handlers: RealtimeHandlers) {
      const socket = { handlers, closed: false };
      sockets.push(socket);
      return { close: () => { socket.closed = true; } };
    },
    last() {
      const socket = sockets.at(-1);
      if (socket === undefined) throw new Error("no socket opened");
      return socket;
    },
  };
}

const snapshot: ServerEvent = { type: "snapshot", state: roomState() };
const ping: ServerEvent = { type: "ping" };

function setup() {
  const transport = fakeTransport();
  const onEvent = vi.fn();
  // random() = 0.5 → no jitter, so delays equal BACKOFF_MS exactly.
  const manager = createConnectionManager({ open: transport.open, onEvent, random: () => 0.5 });
  return { transport, onEvent, manager };
}

describe("backoffDelay", () => {
  it("follows 0.5, 1, 2, 4, 8 s and caps at 8 s", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => backoffDelay(n, () => 0.5))).toEqual([
      500, 1000, 2000, 4000, 8000, 8000, 8000,
    ]);
  });
  it("applies ±20% jitter", () => {
    expect(backoffDelay(0, () => 0)).toBe(400);
    expect(backoffDelay(0, () => 1)).toBe(600);
  });
});

describe("connection manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in connecting and goes live on the first snapshot (H1)", () => {
    const { transport, manager, onEvent } = setup();
    manager.start();
    expect(manager.status.get()).toBe("connecting");
    transport.last().handlers.onOpen();
    expect(manager.status.get()).toBe("connecting");
    transport.last().handlers.onEvent(snapshot);
    expect(onEvent).toHaveBeenCalledWith(snapshot);
    expect(manager.status.get()).toBe("live");
  });

  it("goes reconnecting on close and retries with the backoff sequence (H3)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    expect(manager.status.get()).toBe("reconnecting");
    expect(transport.sockets).toHaveLength(1);

    for (const delay of [500, 1000, 2000, 4000]) {
      vi.advanceTimersByTime(delay - 1);
      const before = transport.sockets.length;
      expect(transport.sockets).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(transport.sockets).toHaveLength(before + 1);
      transport.last().handlers.onClose(); // attempt fails
    }
  });

  it("turns unreachable 10 s after the drop (H2)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(UNREACHABLE_AFTER_MS - 1);
    expect(manager.status.get()).toBe("reconnecting");
    vi.advanceTimersByTime(1);
    expect(manager.status.get()).toBe("unreachable");
  });

  it("shows back_online for 2 s after a resync, then live (H4)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(500);
    transport.last().handlers.onEvent(snapshot);
    expect(manager.status.get()).toBe("back_online");
    vi.advanceTimersByTime(BACK_ONLINE_MS);
    expect(manager.status.get()).toBe("live");
  });

  it("resets the backoff after a successful snapshot", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(500);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(1000);
    transport.last().handlers.onEvent(snapshot); // back online
    transport.last().handlers.onClose();
    const before = transport.sockets.length;
    vi.advanceTimersByTime(500);
    expect(transport.sockets).toHaveLength(before + 1);
  });

  it("treats 25 s without any frame as a drop", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    vi.advanceTimersByTime(DEAD_AFTER_MS - 1);
    transport.last().handlers.onEvent(ping); // keeps it alive
    vi.advanceTimersByTime(DEAD_AFTER_MS - 1);
    expect(manager.status.get()).toBe("live");
    vi.advanceTimersByTime(1);
    expect(manager.status.get()).toBe("reconnecting");
    expect(transport.sockets[0]?.closed).toBe(true);
  });

  it("retry from unreachable reconnects immediately and restarts the 10 s window", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(UNREACHABLE_AFTER_MS);
    expect(manager.status.get()).toBe("unreachable");
    const before = transport.sockets.length;
    manager.retry();
    expect(transport.sockets).toHaveLength(before + 1);
    expect(manager.status.get()).toBe("reconnecting");
    vi.advanceTimersByTime(UNREACHABLE_AFTER_MS);
    expect(manager.status.get()).toBe("unreachable");
  });

  it("resume while reconnecting reconnects immediately (visibility resync)", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    vi.advanceTimersByTime(500);
    transport.last().handlers.onClose(); // next attempt is 1 s away
    const before = transport.sockets.length;
    manager.resume();
    expect(transport.sockets).toHaveLength(before + 1);
    transport.last().handlers.onEvent(snapshot);
    expect(manager.status.get()).toBe("back_online");
  });

  it("resume when live but silent for >15 s closes and reconnects", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    vi.advanceTimersByTime(16_000); // e.g. a phone asleep: timers frozen, frames missed
    manager.resume();
    expect(transport.sockets[0]?.closed).toBe(true);
    expect(transport.sockets).toHaveLength(2);
    expect(manager.status.get()).toBe("reconnecting");
  });

  it("resume when live and fresh does nothing", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    vi.advanceTimersByTime(5000);
    manager.resume();
    expect(transport.sockets).toHaveLength(1);
    expect(manager.status.get()).toBe("live");
  });

  it("ignores callbacks from a replaced socket", () => {
    const { transport, manager, onEvent } = setup();
    manager.start();
    const first = transport.last();
    first.handlers.onEvent(snapshot);
    vi.advanceTimersByTime(16_000);
    manager.resume(); // replaces the socket
    onEvent.mockClear();
    first.handlers.onEvent(snapshot);
    first.handlers.onClose();
    expect(onEvent).not.toHaveBeenCalled();
    expect(transport.sockets).toHaveLength(2);
  });

  it("stop closes the socket and cancels reconnects", () => {
    const { transport, manager } = setup();
    manager.start();
    transport.last().handlers.onEvent(snapshot);
    transport.last().handlers.onClose();
    manager.stop();
    vi.advanceTimersByTime(60_000);
    expect(transport.sockets).toHaveLength(1);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/realtime/connection.test.ts` → 14 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): connection state machine with backoff and resync"`

---

### T20 — Mock domain rules
- [ ] done

**Files:** `apps/kiosk/src/data/adapters/mock/mock-rules.ts`, `apps/kiosk/src/data/adapters/mock/mock-rules.test.ts`

**Context:** ARCHITECTURE §4.4 ("The mock approximates the domain rules in its own code; it never imports from
`apps/core-api`"); M02 notes. M02 keeps every command immediate (M04 adds the R1 draw ramp, mute details, etc.).
R3: `ac.*` is always `assumed` from `ir`; R4: `ac.step` moves to the adjacent **captured** setpoint; R9: mute saves
levels. `describeCommand` produces the H13 activity text ("Rear of room turned on").

**Do:**
1. Create `apps/kiosk/src/data/adapters/mock/mock-rules.ts`:
```ts
import type { ChangedBy, CommandBody, Confidence, Observed, RoomState, Source } from "@eduscope/contracts";

// The mock's own rough approximation of core-api's domain rules (never imported from
// apps/core-api). M02: every command lands immediately; M04 adds the R1 draw ramp etc.

export interface ChangeContext {
  at: string;
  by: ChangedBy;
}

export function observe<T>(
  prev: Observed<T>, value: T, ctx: ChangeContext, confidence: Confidence = "confirmed", source: Source = prev.source,
): Observed<T> {
  return { ...prev, value, confidence, source, updated_at: ctx.at, stale: false, changed_by: ctx.by };
}

/** The resulting command status: IR-only targets can never be confirmed (R3). */
export function statusFor(body: CommandBody): "confirmed" | "assumed" {
  return body.kind === "ac.power" || body.kind === "ac.step" ? "assumed" : "confirmed";
}

/** Next captured setpoint in a direction (R4); stays put at the ends. */
export function stepSetpoint(available: readonly number[], current: number | null, direction: "down" | "up"): number | null {
  if (current === null) return available[0] ?? null;
  const candidates = direction === "up" ? available.filter((t) => t > current) : available.filter((t) => t < current);
  if (candidates.length === 0) return current;
  return direction === "up" ? Math.min(...candidates) : Math.max(...candidates);
}

export function applyCommandToState(state: RoomState, body: CommandBody, ctx: ChangeContext): RoomState {
  const { display, audio, environment } = state;
  switch (body.kind) {
    case "source.select":
      return { ...state, display: { ...display, source: observe(display.source, body.input, ctx) } };
    case "projector.power":
      return {
        ...state,
        display: {
          ...display,
          projector: {
            ...display.projector,
            state: observe(display.projector.state, body.on ? "running" : "standby", ctx),
            feedback: { last_ir: body.on ? "power_on" : "power_off", sent_at: ctx.at, phase: "idle" },
          },
        },
      };
    case "projector.mains":
      return {
        ...state,
        display: { ...display, projector: { ...display.projector, mains: observe(display.projector.mains, body.on, ctx) } },
      };
    case "screen.move":
      return {
        ...state,
        display: { ...display, screen: observe(display.screen, body.to === "raise" ? "raised" : "lowered", ctx) },
      };
    case "audio.level":
      return {
        ...state,
        audio: {
          ...audio,
          channels: { ...audio.channels, [body.channel]: observe(audio.channels[body.channel], body.level, ctx) },
        },
      };
    case "audio.mute_all":
      return {
        ...state,
        audio: {
          ...audio,
          muted_all: observe(audio.muted_all, body.muted, ctx),
          saved_levels: body.muted
            ? { mic: audio.channels.mic.value, pc: audio.channels.pc.value }
            : { mic: null, pc: null },
        },
      };
    case "lights.set":
      return {
        ...state,
        environment: {
          ...environment,
          lights: { ...environment.lights, [body.gang]: observe(environment.lights[body.gang], body.on, ctx) },
        },
      };
    case "ac.power":
      return {
        ...state,
        environment: {
          ...environment,
          ac: { ...environment.ac, power: observe(environment.ac.power, body.on ? "on" : "off", ctx, "assumed", "ir") },
        },
      };
    case "ac.step": {
      const next = stepSetpoint(environment.ac.available_setpoints, environment.ac.setpoint_c.value, body.direction);
      if (next === null) return state;
      return {
        ...state,
        environment: {
          ...environment,
          ac: { ...environment.ac, setpoint_c: observe(environment.ac.setpoint_c, next, ctx, "assumed", "ir") },
        },
      };
    }
  }
}

/** Activity text for H13 toasts, e.g. "Rear of room turned on". */
export function describeCommand(body: CommandBody): string {
  switch (body.kind) {
    case "source.select":
      return body.input === "podium_pc" ? "Podium PC selected" : "Smart board selected";
    case "projector.power":
      return body.on ? "Projector power on sent" : "Projector power off sent";
    case "projector.mains":
      return body.on ? "Projector mains turned on" : "Projector mains turned off";
    case "screen.move":
      return body.to === "raise" ? "Projection screen raised" : "Projection screen lowered";
    case "audio.level":
      return `${body.channel === "mic" ? "Lecturer microphone" : "PC audio"} set to ${body.level}`;
    case "audio.mute_all":
      return body.muted ? "All audio muted" : "All audio unmuted";
    case "lights.set":
      return `${body.gang === "front" ? "Front" : "Rear"} of room turned ${body.on ? "on" : "off"}`;
    case "ac.power":
      return body.on ? "Air conditioning turned on" : "Air conditioning turned off";
    case "ac.step":
      return body.direction === "up" ? "Air conditioning setpoint raised" : "Air conditioning setpoint lowered";
  }
}
```

**Test:** `apps/kiosk/src/data/adapters/mock/mock-rules.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { applyCommandToState, describeCommand, statusFor, stepSetpoint } from "./mock-rules";

const ctx = { at: "2026-10-05T10:43:00Z", by: "phone" } as const;

describe("mock rules", () => {
  it("lights.set sets the gang confirmed with attribution", () => {
    const next = applyCommandToState(roomState(), { kind: "lights.set", gang: "rear", on: true }, ctx);
    expect(next.environment.lights.rear).toMatchObject({
      value: true, confidence: "confirmed", updated_at: ctx.at, changed_by: "phone", stale: false,
    });
    expect(next.environment.lights.front.value).toBe(true); // untouched
  });

  it("audio.level sets one channel", () => {
    const next = applyCommandToState(roomState(), { kind: "audio.level", channel: "mic", level: 40, final: true }, ctx);
    expect(next.audio.channels.mic.value).toBe(40);
    expect(next.audio.channels.pc.value).toBe(38);
  });

  it("audio.mute_all saves and clears the levels (R9)", () => {
    const muted = applyCommandToState(roomState(), { kind: "audio.mute_all", muted: true }, ctx);
    expect(muted.audio.muted_all.value).toBe(true);
    expect(muted.audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    const unmuted = applyCommandToState(muted, { kind: "audio.mute_all", muted: false }, ctx);
    expect(unmuted.audio.saved_levels).toEqual({ mic: null, pc: null });
  });

  it("ac.power is assumed from ir (R3)", () => {
    const next = applyCommandToState(roomState(), { kind: "ac.power", on: false }, ctx);
    expect(next.environment.ac.power).toMatchObject({ value: "off", confidence: "assumed", source: "ir" });
    expect(statusFor({ kind: "ac.power", on: false })).toBe("assumed");
    expect(statusFor({ kind: "lights.set", gang: "front", on: true })).toBe("confirmed");
  });

  it("ac.step moves to the adjacent captured setpoint (R4)", () => {
    expect(stepSetpoint([18, 20, 24], 24, "down")).toBe(20);
    expect(stepSetpoint([18, 20, 24], 20, "up")).toBe(24);
    expect(stepSetpoint([18, 20, 24], 24, "up")).toBe(24);
    expect(stepSetpoint([18, 20, 24], null, "up")).toBe(18);
    const next = applyCommandToState(roomState(), { kind: "ac.step", direction: "up" }, ctx);
    expect(next.environment.ac.setpoint_c.value).toBe(25);
  });

  it("projector.power sets the state and the IR feedback", () => {
    const next = applyCommandToState(roomState(), { kind: "projector.power", on: false }, ctx);
    expect(next.display.projector.state.value).toBe("standby");
    expect(next.display.projector.feedback.last_ir).toBe("power_off");
  });

  it("source.select and screen.move set their values", () => {
    const a = applyCommandToState(roomState(), { kind: "source.select", input: "smart_board" }, ctx);
    expect(a.display.source.value).toBe("smart_board");
    const b = applyCommandToState(roomState(), { kind: "screen.move", to: "raise" }, ctx);
    expect(b.display.screen.value).toBe("raised");
  });

  it("describes commands for activity toasts", () => {
    expect(describeCommand({ kind: "lights.set", gang: "rear", on: true })).toBe("Rear of room turned on");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock/mock-rules.test.ts` → 8 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock room rules"`

---

### T21 — `FakeRoom` and the mock ApiClient
- [ ] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/mock-client.ts`,
`apps/kiosk/src/data/adapters/mock/fake-room.test.ts`

**Context:** M02 Scope (`FakeRoom` seeded from `fixtures/state/room-normal.json`, 200–600 ms latency, emits
`snapshot`/`state`/`command`/`activity`), Mock dev panel list, decisions 3 and 4. Command lifecycle:
`sendCommand` resolves (after latency) with status `pending`; after another latency the room emits
`command sent` → `state` (rev + 1) → `command confirmed|assumed` → `activity` (skipped for non-final slider
moves). "Fail next" → `command failed` with error "Command failed". "Time out next" → `command timed_out` after
5 s. Changes made while dropped still update the room, so the next `snapshot` carries them (AC5). Pings every
10 s. Every emitted event goes through `ServerEvent.parse` so a mock bug fails like a real boundary would.

**Do:**
1. Create `apps/kiosk/src/data/adapters/mock/fake-room.ts`:
```ts
import {
  ClientSession, Command, CommandRequest, RoomState, ServerEvent, type ClientLabel,
} from "@eduscope/contracts";
import roomNormal from "@eduscope/contracts/fixtures/state/room-normal.json";
import type { RealtimeConnection, RealtimeHandlers } from "@/data/api-client";
import { applyCommandToState, describeCommand, observe, statusFor } from "./mock-rules";

// In-memory room (ARCHITECTURE §4.4). Emits the SAME ServerEvents the real server will, through
// the same handlers the http adapter calls, so apply-event is the only writer of the cache.

export const MOCK_LATENCY_MIN_MS = 200;
export const MOCK_LATENCY_MAX_MS = 600;
export const MOCK_PING_MS = 10_000;
/** Mock transport timeout for "Time out next command" (real values: Q12). */
export const MOCK_COMMAND_TIMEOUT_MS = 5_000;
/** How long a refused connect takes to fail. */
export const MOCK_REFUSE_MS = 300;
const OWN_PUBLIC_ID = "mock-self";
const PHONE_PUBLIC_ID = "mock-phone";

interface Listener {
  handlers: RealtimeHandlers;
  open: boolean;
}

export interface FakeRoomOptions {
  random?: () => number;
  now?: () => number;
}

export class FakeRoom {
  private state: RoomState;
  private session: ClientSession;
  private readonly listeners = new Set<Listener>();
  private reachable = true;
  private silent = false;
  private failNext = false;
  private timeoutNext = false;
  private commandSeq = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(options: FakeRoomOptions = {}) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.state = RoomState.parse(roomNormal);
    // M02: the mock client may control. M03 makes `view` the default and adds PIN login.
    this.session = ClientSession.parse({
      public_id: OWN_PUBLIC_ID, client_type: "remote", label: "laptop", access: "control",
      unlocked_at: null, last_activity: null, expires_at: null,
    });
  }

  // ── ApiClient surface ────────────────────────────────────────────────────────────────

  async getSession(): Promise<ClientSession> {
    await this.delay();
    return this.session;
  }

  async getState(): Promise<RoomState> {
    await this.delay();
    return this.stamped();
  }

  async sendCommand(request: CommandRequest): Promise<Command> {
    const parsed = CommandRequest.parse(request);
    await this.delay();
    const command: Command = {
      id: `mock-cmd-${++this.commandSeq}`,
      client_cmd_id: parsed.client_cmd_id,
      body: parsed.body,
      issued_by: { public_id: this.session.public_id, label: this.session.label },
      status: "pending",
      error: null,
      at: this.iso(),
    };
    this.process(command);
    return command;
  }

  connect(label: ClientLabel, handlers: RealtimeHandlers): RealtimeConnection {
    const listener: Listener = { handlers, open: true };
    if (!this.reachable) {
      setTimeout(() => {
        if (listener.open) handlers.onClose();
      }, MOCK_REFUSE_MS);
      return { close: () => { listener.open = false; } };
    }
    this.session = { ...this.session, label };
    this.listeners.add(listener);
    this.ensurePing();
    setTimeout(() => {
      if (!listener.open) return;
      handlers.onOpen();
      this.emitTo(listener, { type: "snapshot", state: this.stamped() });
    }, this.latency());
    return {
      close: () => {
        listener.open = false;
        this.listeners.delete(listener);
      },
    };
  }

  // ── Mock panel (`?mock-panel`) ───────────────────────────────────────────────────────

  /** Close every socket now and refuse reconnects until restore(). */
  dropConnection(): void {
    this.reachable = false;
    for (const listener of [...this.listeners]) {
      listener.open = false;
      this.listeners.delete(listener);
      listener.handlers.onClose();
    }
  }

  /** Go silent without closing: the client notices through its 25 s ping-miss timer. */
  makeUnreachable(): void {
    this.reachable = false;
    this.silent = true;
  }

  /** Accept connections again. Silent sockets stay dead; the client reconnects. */
  restore(): void {
    this.reachable = true;
    if (this.silent) {
      this.silent = false;
      for (const listener of [...this.listeners]) {
        listener.open = false;
        this.listeners.delete(listener);
      }
    }
  }

  /** Another client toggles Rear of room (H13 "· from phone"). */
  changeFromPhone(): void {
    const on = this.state.environment.lights.rear.value !== true;
    this.applyExternal({ kind: "lights.set", gang: "rear", on }, "phone", PHONE_PUBLIC_ID);
  }

  /** The wall plate toggles Front of room (R6 "· by hand"). */
  changeByHand(): void {
    const on = this.state.environment.lights.front.value !== true;
    this.applyExternal({ kind: "lights.set", gang: "front", on }, "by hand", null);
  }

  /** H8: flip one device's online flag; the room status follows. */
  toggleDeviceOffline(deviceId: string): void {
    const at = this.iso();
    const devices = this.state.devices.map((device) =>
      device.id === deviceId
        ? { ...device, online: observe(device.online, device.online.value !== true, { at, by: "by hand" }) }
        : device,
    );
    const offline = devices.filter((device) => device.online.value === false);
    const first = offline[0];
    const status =
      first === undefined
        ? { level: "normal" as const, text: "All systems normal" }
        : { level: "degraded" as const, text: offline.length === 1 ? `${first.name} offline` : `${offline.length} devices offline` };
    this.commit({ ...this.state, devices, room: { ...this.state.room, status } });
  }

  failNextCommand(): void {
    this.failNext = true;
  }

  timeOutNextCommand(): void {
    this.timeoutNext = true;
  }

  /** Read-only view for the panel (e.g. listing devices). */
  peek(): RoomState {
    return this.state;
  }

  // ── internals ────────────────────────────────────────────────────────────────────────

  private process(command: Command): void {
    if (this.timeoutNext) {
      this.timeoutNext = false;
      setTimeout(() => this.emitAll({ type: "command", command: { ...command, status: "timed_out" } }), MOCK_COMMAND_TIMEOUT_MS);
      return;
    }
    if (this.failNext) {
      this.failNext = false;
      setTimeout(
        () => this.emitAll({ type: "command", command: { ...command, status: "failed", error: "Command failed" } }),
        this.latency(),
      );
      return;
    }
    setTimeout(() => {
      this.emitAll({ type: "command", command: { ...command, status: "sent" } });
      const by = command.issued_by?.label ?? "schedule";
      this.commit(applyCommandToState(this.state, command.body, { at: this.iso(), by }));
      this.emitAll({ type: "command", command: { ...command, status: statusFor(command.body) } });
      if (command.body.kind !== "audio.level" || command.body.final) {
        this.emitAll({ type: "activity", text: describeCommand(command.body), by, public_id: command.issued_by?.public_id ?? null });
      }
    }, this.latency());
  }

  private applyExternal(body: Parameters<typeof applyCommandToState>[1], by: "phone" | "by hand", publicId: string | null): void {
    this.commit(applyCommandToState(this.state, body, { at: this.iso(), by }));
    this.emitAll({ type: "activity", text: describeCommand(body), by, public_id: publicId });
  }

  /** Bump rev and push `state`. Works while dropped: the next snapshot carries the change. */
  private commit(next: RoomState): void {
    this.state = { ...next, rev: this.state.rev + 1 };
    this.emitAll({ type: "state", state: this.stamped() });
  }

  private stamped(): RoomState {
    return { ...this.state, server_time: this.iso() };
  }

  private emitAll(event: ServerEvent): void {
    for (const listener of this.listeners) this.emitTo(listener, event);
  }

  private emitTo(listener: Listener, event: ServerEvent): void {
    if (!listener.open || this.silent) return;
    listener.handlers.onEvent(ServerEvent.parse(event)); // catches mock bugs like a real boundary
  }

  private ensurePing(): void {
    if (this.pingTimer !== null) return;
    this.pingTimer = setInterval(() => this.emitAll({ type: "ping" }), MOCK_PING_MS);
  }

  private latency(): number {
    return Math.round(MOCK_LATENCY_MIN_MS + this.random() * (MOCK_LATENCY_MAX_MS - MOCK_LATENCY_MIN_MS));
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latency()));
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }
}
```
2. Create `apps/kiosk/src/data/adapters/mock/mock-client.ts`:
```ts
import type { ApiClient } from "@/data/api-client";
import { FakeRoom } from "./fake-room";

/** The one FakeRoom of this page; the mock panel drives it directly. */
export const fakeRoom = new FakeRoom();

export function createMockApiClient(room: FakeRoom = fakeRoom): ApiClient {
  return {
    getSession: () => room.getSession(),
    getState: () => room.getState(),
    sendCommand: (request) => room.sendCommand(request),
    connect: (label, handlers) => room.connect(label, handlers),
  };
}
```

**Test:** `apps/kiosk/src/data/adapters/mock/fake-room.test.ts`
```ts
import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_COMMAND_TIMEOUT_MS, MOCK_LATENCY_MAX_MS, MOCK_PING_MS } from "./fake-room";

const CMD_ID = "00000000-0000-4000-8000-000000000001";

function connected() {
  const room = new FakeRoom({ random: () => 1 }); // latency = 600 ms, deterministic
  const events: ServerEvent[] = [];
  const handlers = { onOpen: vi.fn(), onEvent: vi.fn((e: ServerEvent) => events.push(e)), onClose: vi.fn() };
  const connection = room.connect("phone", handlers);
  vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
  return { room, events, handlers, connection };
}
const types = (events: ServerEvent[]) => events.map((e) => e.type);

describe("FakeRoom", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens and sends a snapshot of room-normal first", () => {
    const { events, handlers } = connected();
    expect(handlers.onOpen).toHaveBeenCalled();
    const first = events[0];
    expect(first?.type).toBe("snapshot");
    if (first?.type === "snapshot") expect(first.state.room.id).toBe("R-101");
  });

  it("pings every 10 s", () => {
    const { events } = connected();
    vi.advanceTimersByTime(MOCK_PING_MS);
    expect(types(events)).toContain("ping");
  });

  it("a command goes pending → sent → state → confirmed → activity", async () => {
    const { room, events } = connected();
    const accepted = room.sendCommand({ client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true } });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect((await accepted).status).toBe("pending");
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    expect(types(events).slice(1)).toEqual(["command", "state", "command", "activity"]);
    const state = events[2];
    if (state?.type !== "state") throw new Error("expected state");
    expect(state.state.rev).toBe(2);
    expect(state.state.environment.lights.rear.value).toBe(true);
    expect(state.state.environment.lights.rear.changed_by).toBe("phone"); // the hello label
  });

  it("fail next command emits failed and leaves state alone (H6a)", async () => {
    const { room, events } = connected();
    room.failNextCommand();
    void room.sendCommand({ client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    const last = events.at(-1);
    expect(last?.type === "command" && last.command.status).toBe("failed");
    expect(types(events)).not.toContain("state");
  });

  it("time out next command emits timed_out after the mock timeout (H6b)", async () => {
    const { room, events } = connected();
    room.timeOutNextCommand();
    void room.sendCommand({ client_cmd_id: CMD_ID, body: { kind: "lights.set", gang: "rear", on: true } });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS + MOCK_COMMAND_TIMEOUT_MS);
    const last = events.at(-1);
    expect(last?.type === "command" && last.command.status).toBe("timed_out");
  });

  it("change from phone pushes state and an attributed activity (H13)", () => {
    const { room, events } = connected();
    room.changeFromPhone();
    expect(events.at(-1)).toEqual({ type: "activity", text: "Rear of room turned on", by: "phone", public_id: "mock-phone" });
  });

  it("change by hand toggles Front of room with by hand", () => {
    const { room, events } = connected();
    room.changeByHand();
    expect(events.at(-1)).toMatchObject({ type: "activity", text: "Front of room turned off", by: "by hand", public_id: null });
  });

  it("toggling a device offline degrades the room status (H8)", () => {
    const { room } = connected();
    room.toggleDeviceOffline("lights");
    expect(room.peek().devices.find((d) => d.id === "lights")?.online.value).toBe(false);
    expect(room.peek().room.status).toEqual({ level: "degraded", text: "Lighting switch offline" });
    room.toggleDeviceOffline("lights");
    expect(room.peek().room.status.level).toBe("normal");
  });

  it("drop closes sockets and refuses reconnects until restore", () => {
    const { room, handlers } = connected();
    room.dropConnection();
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    const retry = { onOpen: vi.fn(), onEvent: vi.fn(), onClose: vi.fn() };
    room.connect("phone", retry);
    vi.advanceTimersByTime(1000);
    expect(retry.onClose).toHaveBeenCalled();
    expect(retry.onEvent).not.toHaveBeenCalled();
  });

  it("changes made while dropped arrive in the next snapshot (resync)", () => {
    const { room } = connected();
    room.dropConnection();
    room.changeByHand();
    room.restore();
    const events: ServerEvent[] = [];
    room.connect("phone", { onOpen: vi.fn(), onEvent: (e) => events.push(e), onClose: vi.fn() });
    vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
    const snapshot = events[0];
    if (snapshot?.type !== "snapshot") throw new Error("expected snapshot");
    expect(snapshot.state.environment.lights.front.value).toBe(false);
  });

  it("make unreachable goes silent without closing", () => {
    const { room, events, handlers } = connected();
    room.makeUnreachable();
    const before = events.length;
    room.changeFromPhone();
    vi.advanceTimersByTime(MOCK_PING_MS * 3);
    expect(events).toHaveLength(before);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/adapters/mock` → 11 + 8 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): in-memory FakeRoom mock adapter"`

---

### T22 — Control gate
- [ ] done

**Files:** `apps/kiosk/src/data/gate.ts`, `apps/kiosk/src/data/gate.test.ts`

**Context:** ARCHITECTURE §4.5 (`useControlGate()` = `{enabled, reason: "locked"|"disconnected"|"offline"|null}`
combining connection, session access and device online; "reconnecting ⇒ all controls disabled, values greyed" is
enforced in this one hook). Priority: disconnected (`connecting`/`reconnecting`/`unreachable`) > offline
(`device.online.value === false`; `null` = never reported is **not** offline) > locked (`view` or session not
loaded). UX only: core-api enforces permissions (CLAUDE.md). The hook wrapper is in T24.

**Do:**
1. Create `apps/kiosk/src/data/gate.ts`:
```ts
import type { AccessLevel } from "@eduscope/contracts";
import type { ConnectionStatus } from "./realtime/connection";

// useControlGate (ARCHITECTURE §4.5): ONE place decides whether a control is usable.
// UX only — core-api enforces every permission (CLAUDE.md).

export type GateReason = "disconnected" | "offline" | "locked";
export interface ControlGate {
  enabled: boolean;
  reason: GateReason | null;
}

export interface GateInput {
  connection: ConnectionStatus;
  /** `undefined` while the session is loading. */
  access: AccessLevel | undefined;
  /** `device.online.value` of the device behind the control; `undefined` = no device check. */
  deviceOnline?: boolean | null | undefined;
}

/** Priority: disconnected (H1–H3) > offline (H8) > locked (H12, view). */
export function computeControlGate(input: GateInput): ControlGate {
  if (input.connection !== "live" && input.connection !== "back_online") {
    return { enabled: false, reason: "disconnected" };
  }
  if (input.deviceOnline === false) return { enabled: false, reason: "offline" };
  if (input.access === undefined || input.access === "view") return { enabled: false, reason: "locked" };
  return { enabled: true, reason: null };
}
```

**Test:** `apps/kiosk/src/data/gate.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { computeControlGate, type GateInput } from "./gate";

describe("computeControlGate", () => {
  it.each<[GateInput, ReturnType<typeof computeControlGate>]>([
    [{ connection: "live", access: "control" }, { enabled: true, reason: null }],
    [{ connection: "back_online", access: "technician" }, { enabled: true, reason: null }],
    [{ connection: "live", access: "control", deviceOnline: true }, { enabled: true, reason: null }],
    [{ connection: "live", access: "control", deviceOnline: null }, { enabled: true, reason: null }],
    [{ connection: "connecting", access: "control" }, { enabled: false, reason: "disconnected" }],
    [{ connection: "reconnecting", access: "control" }, { enabled: false, reason: "disconnected" }],
    [{ connection: "unreachable", access: "technician" }, { enabled: false, reason: "disconnected" }],
    [{ connection: "reconnecting", access: "view", deviceOnline: false }, { enabled: false, reason: "disconnected" }],
    [{ connection: "live", access: "control", deviceOnline: false }, { enabled: false, reason: "offline" }],
    [{ connection: "live", access: "view", deviceOnline: false }, { enabled: false, reason: "offline" }],
    [{ connection: "live", access: "view" }, { enabled: false, reason: "locked" }],
    [{ connection: "live", access: undefined }, { enabled: false, reason: "locked" }],
  ])("%o → %o", (input, expected) => {
    expect(computeControlGate(input)).toEqual(expected);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk exec vitest run src/data/gate.test.ts` → 12 passed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): control gate decision"`

---

### T23 — Realtime runtime, adapter choice and data context
- [ ] done

**Files:** `apps/kiosk/src/data/realtime/runtime.ts`, `apps/kiosk/src/data/create-api-client.ts`,
`apps/kiosk/src/data/api-context.tsx`

**Context:** ARCHITECTURE §4.4 ("`createApiClient()` picks the adapter; nothing else knows which is active"),
§4.5, §4.6 step 5 (a 1 s sweep clears pending entries older than the safety window and shows "No response · tap
to retry"). The toast function is injected (the app passes sonner's `toast`) so `data/` does not import UI.
Wiring only; its parts are tested in T13–T22, the whole is checked at the T45 checkpoint.

**Do:**
1. Create `apps/kiosk/src/data/realtime/runtime.ts`:
```ts
import type { ClientLabel } from "@eduscope/contracts";
import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/data/api-client";
import { inlineErrorStore, MESSAGE_TIMED_OUT } from "@/data/commands/inline-errors";
import { pendingStore } from "@/data/commands/pending-store";
import { serverClock } from "@/lib/server-time";
import { applyEvent } from "./apply-event";
import { createCachePort } from "./cache-port";
import { attachResumeTriggers, createConnectionManager, type ConnectionManager } from "./connection";
import { connectionStore } from "./connection-store";

const SWEEP_EVERY_MS = 1000;

export interface RealtimeRuntime {
  connection: ConnectionManager;
  start(): void;
  stop(): void;
}

/** Wires ApiClient.connect → ConnectionManager → applyEvent → query cache. One per page. */
export function createRealtimeRuntime(options: {
  api: ApiClient;
  queryClient: QueryClient;
  label: ClientLabel;
  toast: (text: string) => void;
}): RealtimeRuntime {
  const cache = createCachePort(options.queryClient, options.api);
  const connection = createConnectionManager({
    open: (handlers) => options.api.connect(options.label, handlers),
    onEvent: (event) =>
      applyEvent(event, {
        cache,
        pending: pendingStore,
        inlineErrors: inlineErrorStore,
        toast: options.toast,
        syncServerTime: (iso) => serverClock.sync(iso),
      }),
    store: connectionStore,
  });
  let detach: (() => void) | null = null;
  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  return {
    connection,
    start() {
      connection.start();
      detach = attachResumeTriggers(connection);
      // ARCHITECTURE §4.6 step 5: a pending overlay never outlives the safety window.
      sweepTimer = setInterval(() => {
        for (const expired of pendingStore.sweep(Date.now())) inlineErrorStore.show(expired.key, MESSAGE_TIMED_OUT);
      }, SWEEP_EVERY_MS);
    },
    stop() {
      connection.stop();
      detach?.();
      detach = null;
      if (sweepTimer !== null) clearInterval(sweepTimer);
      sweepTimer = null;
    },
  };
}
```
2. Create `apps/kiosk/src/data/create-api-client.ts`:
```ts
import type { ApiClient } from "./api-client";
import { createHttpApiClient, sameOriginWsUrl } from "./adapters/http/http-client";
import { createMockApiClient } from "./adapters/mock/mock-client";
import type { ApiMode } from "./env";

/** The only place that knows which adapter is active (ARCHITECTURE §4.4). */
export function createApiClient(mode: ApiMode): ApiClient {
  return mode === "mock" ? createMockApiClient() : createHttpApiClient({ wsUrl: sameOriginWsUrl(window.location) });
}
```
3. Create `apps/kiosk/src/data/api-context.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from "react";
import type { ApiClient } from "./api-client";
import type { RealtimeRuntime } from "./realtime/runtime";

interface DataContextValue {
  api: ApiClient;
  realtime: RealtimeRuntime;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ value, children }: { value: DataContextValue; children: ReactNode }) {
  return <DataContext value={value}>{children}</DataContext>;
}

function useDataContext(): DataContextValue {
  const value = useContext(DataContext);
  if (value === null) throw new Error("DataProvider is missing");
  return value;
}

export const useApiClient = (): ApiClient => useDataContext().api;
export const useRealtime = (): RealtimeRuntime => useDataContext().realtime;
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): realtime runtime and data context"`

---

### T24 — Data hooks (`useRoomState`, `useCommand`, `useControlGate` …)
- [ ] done

**Files:** `apps/kiosk/src/data/hooks.ts`

**Context:** ARCHITECTURE §4.4 (selectors keep re-renders local: `useRoomState(s => s.display.projector)`),
§4.6 step 1 (`useCommand`: closed gate → ignore; M03 will open the PIN overlay for `locked`), CLAUDE.md
("Components never call `fetch` or open sockets"). Features and `app/` use these hooks; `components/` never do.
Thin wrappers over tested logic — no test file.

**Do:**
1. Create `apps/kiosk/src/data/hooks.ts`:
```ts
import type { CommandBody, RoomState } from "@eduscope/contracts";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useApiClient } from "./api-context";
import { createCommandSender } from "./commands/command-sender";
import { inlineErrorStore } from "./commands/inline-errors";
import { pendingStore, type ControlKey } from "./commands/pending-store";
import { computeControlGate, type ControlGate } from "./gate";
import { sessionQuery, stateQuery } from "./queries";
import { connectionStore } from "./realtime/connection-store";
import type { ConnectionStatus } from "./realtime/connection";

/** A slice of the room state; `undefined` until the first snapshot (H1 → skeletons). */
export function useRoomState<T>(select: (state: RoomState) => T): T | undefined {
  return useQuery({ ...stateQuery, select }).data;
}

export function useSession() {
  return useQuery(sessionQuery(useApiClient())).data;
}

export function useConnectionStatus(): ConnectionStatus {
  return useStore(connectionStore, (status) => status);
}

/** Every control asks this hook (connection + access + device online). */
export function useControlGate(deviceId?: string): ControlGate {
  const connection = useConnectionStatus();
  const access = useSession()?.access;
  const deviceOnline = useRoomState((state) =>
    deviceId === undefined ? undefined : state.devices.find((device) => device.id === deviceId)?.online.value,
  );
  return computeControlGate({ connection, access, deviceOnline });
}

export function usePending(key: ControlKey): boolean {
  return useStore(pendingStore.entries, (entries) => entries.has(key));
}

export function useInlineError(key: ControlKey): string | null {
  return useStore(inlineErrorStore.errors, (errors) => errors.get(key) ?? null);
}

/**
 * `send(body)` for one control (ARCHITECTURE §4.6). Closed gate → ignored (M03 opens the PIN
 * overlay for `locked`). Pending → ignored (H5).
 */
export function useCommand(key: ControlKey, deviceId?: string) {
  const api = useApiClient();
  const gate = useControlGate(deviceId);
  const pending = usePending(key);
  const error = useInlineError(key);
  const sender = useMemo(() => createCommandSender({ api, pending: pendingStore, inlineErrors: inlineErrorStore }), [api]);
  const send = useCallback(
    (body: CommandBody) => {
      if (!gate.enabled) return;
      void sender(key, body);
    },
    [gate.enabled, sender, key],
  );
  return { send, pending, error, gate };
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): data hooks for state, session, gate and commands"`

---

### T25 — `StateDot`
- [ ] done

**Files:** `apps/kiosk/src/components/StateDot.tsx`

**Context:** SPEC §3.4 dot column: confirmed/selected solid `accent`; assumed hollow `warn` ring; off solid
`text-3`; unknown hollow `text-3` ring; offline solid `danger`; stale = 40% opacity on top of the tone. 10px
(`size-2.5`), decorative (`aria-hidden`). Screenshot 01: dots beside "Projector", "Lights", "3 reporting".

**Do:**
1. Create `apps/kiosk/src/components/StateDot.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { DOT_CLASS, STALE_DOT_CLASS, type StateTone } from "./state-styles";

/** SPEC §3.4 dot: solid, hollow ring, or 40% when stale. 10px, decorative. */
export function StateDot({ tone, stale = false, className }: { tone: StateTone; stale?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT_CLASS[tone], stale && STALE_DOT_CLASS, className)}
    />
  );
}
```

**Verify:** `pnpm verify` → exit 0. (Rendered on `/dev/components` in T47.)

**Commit:** `git commit -m "feat(kiosk): StateDot"`

---

### T26 — `ObservedLine`
- [ ] done

**Files:** `apps/kiosk/src/components/ObservedLine.tsx`

**Context:** SPEC §3.2 "Card subtitle / state line" (sans 12 = `text-caption`), §3.4 text column, H10 stale
suffix "· 14 min ago" with a 40% dot and `text-3` text, H1 skeleton. Screenshot 01: "On · confirmed by draw"
under "Projector", "On · assumed" (amber) under "Air conditioning". States: confirmed, selected, assumed, off,
unknown, offline, stale, loading.

**Do:**
1. Create `apps/kiosk/src/components/ObservedLine.tsx`:
```tsx
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { StateDot } from "./StateDot";
import { STALE_TEXT_CLASS, TEXT_CLASS, type StateTone } from "./state-styles";

export interface ObservedLineProps {
  tone: StateTone;
  /** e.g. "On · confirmed by draw", "On · assumed", "Switch offline · last known state". */
  text: string;
  /** H10: e.g. "14 min ago" → rendered as "… · 14 min ago" with a 40% dot. */
  staleAgo?: string | null;
  /** H1: no snapshot yet. */
  loading?: boolean;
  /** Show the dot (card headers put the dot beside the title instead). */
  showDot?: boolean;
  className?: string;
}

/** A state line: optional dot + caption text coloured by tone (SPEC §3.2 card subtitle, §3.4). */
export function ObservedLine({ tone, text, staleAgo = null, loading = false, showDot = true, className }: ObservedLineProps) {
  if (loading) return <Skeleton className={cn("h-4 w-32", className)} />;
  const stale = staleAgo !== null;
  return (
    <p className={cn("flex items-center gap-2 text-caption", stale ? STALE_TEXT_CLASS : TEXT_CLASS[tone], className)}>
      {showDot && <StateDot tone={tone} stale={stale} />}
      <span>
        {text}
        {stale && ` · ${staleAgo}`}
      </span>
    </p>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): ObservedLine"`

---

### T27 — `Card`
- [ ] done

**Files:** `apps/kiosk/src/components/Card.tsx`

**Context:** SPEC §3.3 (radius 10 = `rounded-card`, padding 16 = `p-4`, 1px border), §3.4 card border column:
solid `border`, dashed `border-dashed` (assumed/unknown; screenshot 01 AC card), danger `danger` at 40%
(offline). Variants come from `state-styles` (`CARD_VARIANT_CLASS`); use `CARD_VARIANT_FOR_TONE[tone]` to pick one
from a tone.

**Do:**
1. Create `apps/kiosk/src/components/Card.tsx`:
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CARD_VARIANT_CLASS, type CardVariant } from "./state-styles";

/** SPEC §3.3: radius 10, padding 16, 1px border on `surface`. Variant: solid / dashed / danger. */
export function Card({ variant = "solid", className, children }: { variant?: CardVariant; className?: string; children: ReactNode }) {
  return <section className={cn("rounded-card border bg-surface p-4", CARD_VARIANT_CLASS[variant], className)}>{children}</section>;
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): Card with solid, dashed and danger variants"`

---

### T28 — `SectionLabel`
- [ ] done

**Files:** `apps/kiosk/src/components/SectionLabel.tsx`

**Context:** SPEC §3.2 section label ("DISPLAY"): sans bold, uppercase, tracking 0.14em (inside the
`text-section` token), `text-2`, 11px. Screenshot 01: "DISPLAY", "AUDIO", "ENVIRONMENT", "ROOM SENSORS".
Depends on T4 (`cn` keeps `text-section`).

**Do:**
1. Create `apps/kiosk/src/components/SectionLabel.tsx`:
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "DISPLAY", "ROOM SENSORS": 11px bold uppercase, tracking 0.14em, text-2 (SPEC §3.2). */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-section font-bold uppercase text-text-2", className)}>{children}</h2>;
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): SectionLabel"`

---

### T29 — `usePressed` and `CommandButton`
- [ ] done

**Files:** `apps/kiosk/src/lib/use-pressed.ts`, `apps/kiosk/src/components/CommandButton.tsx`

**Context:** SPEC §3.4 active-control column, H5 (pending: border pulses, label unchanged, taps ignored),
§3.3 (primary actions 56px = `h-14`, others ≥48 = `h-12`, radius 8 = `rounded-btn`, 2px border for
active), §2.6 (pressed on touch-down: `active:` + `data-pressed` set on `pointerdown`, M02 notes; no `hover:`).
Screenshot 01: "Power on" green-filled (`confirmed`), "Power off" neutral, AC "Power on" amber (`assumed`), source
tile "Podium PC" (`selected`). States: inactive, active confirmed / selected / assumed / neutral, pending,
disabled (40%).

**Do:**
1. Create `apps/kiosk/src/lib/use-pressed.ts`:
```ts
import { useState } from "react";

/**
 * Pressed state on touch-down (SPEC §2.6, ARCHITECTURE §4.8): spread the result onto the
 * element and style `data-[pressed=true]:` alongside `active:`.
 */
export function usePressed() {
  const [pressed, setPressed] = useState(false);
  const release = (): void => setPressed(false);
  return {
    "data-pressed": pressed,
    onPointerDown: () => setPressed(true),
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release,
  };
}
```
2. Create `apps/kiosk/src/components/CommandButton.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import {
  ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS, PENDING_CONTROL_CLASS,
  type ActiveVariant,
} from "./state-styles";

export interface CommandButtonProps {
  label: string;
  onPress: () => void;
  /** Which SPEC §3.4 fill shows the current server state; `null` = not the current state. */
  active?: ActiveVariant | null;
  /** H5: border pulses, label unchanged, taps ignored. */
  pending?: boolean;
  disabled?: boolean;
  /** `primary` = 56px (Power on/off, Raise); `default` = 48px. */
  size?: "primary" | "default";
  className?: string;
}

export function CommandButton({
  label, onPress, active = null, pending = false, disabled = false, size = "default", className,
}: CommandButtonProps) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      disabled={disabled}
      aria-busy={pending}
      aria-pressed={active !== null}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex min-w-12 items-center justify-center rounded-btn border-2 px-4 text-button font-semibold",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        size === "primary" ? "h-14" : "h-12",
        active === null ? INACTIVE_CONTROL_CLASS : ACTIVE_CONTROL_CLASS[active],
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      {label}
    </button>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): CommandButton with pending pulse and active variants"`

---

### T30 — `ToggleRow`
- [ ] done

**Files:** `apps/kiosk/src/components/ToggleRow.tsx`

**Context:** SPEC S1.E32/E33 and screenshot 01 Lights card: row on `surface-2`, label left, "On" (`accent`) /
"Off" (`text-3`) then a switch (track `toggle-on`/`toggle-off`, knob `knob`). §3.3: the whole row (≥56px,
`min-h-14`) is the target, not the switch. `role="switch"`. States: on, off, unknown (`null` → "—"), pending
(pulse), disabled (offline/disconnected, 40%).

**Do:**
1. Create `apps/kiosk/src/components/ToggleRow.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { DISABLED_CONTROL_CLASS, PENDING_CONTROL_CLASS } from "./state-styles";

export interface ToggleRowProps {
  label: string;
  /** Server value; `null` = never reported. */
  on: boolean | null;
  onToggle: () => void;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
}

/** S1.E32/E33: the whole ≥56px row is the target (SPEC §3.3); the switch is decorative. */
export function ToggleRow({ label, on, onToggle, pending = false, disabled = false, className }: ToggleRowProps) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on === true}
      aria-busy={pending}
      disabled={disabled}
      {...pressed}
      onClick={() => {
        if (!pending) onToggle();
      }}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-btn border-2 border-transparent bg-surface-2 px-4 text-left",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      <span className="flex-1 text-card-title font-semibold text-text-1">{label}</span>
      <span className={cn("text-caption", on === true ? "text-accent" : "text-text-3")}>
        {on === null ? "—" : on ? "On" : "Off"}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors",
          on === true ? "justify-end bg-toggle-on" : "justify-start bg-toggle-off",
        )}
      >
        <span className="size-6 rounded-full bg-knob" />
      </span>
    </button>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): ToggleRow"`

---

### T31 — `LevelSlider`
- [ ] done

**Files:** `apps/kiosk/src/components/LevelSlider.tsx`

**Context:** SPEC §2.4, §3.3 (track 8px = `h-2`, thumb 30px visual = `size-7.5` inside a 48px = `h-12` hit
area, full width), H18 muted (track dimmed, thumb stays), screenshot 01 audio cards (track `border` colour,
white `knob` thumb, no fill). Logic from T9: pointer capture on down, throttled `onChange(level,false)` while
dragging, `onChange(level,true)` on release, server value ignored while dragging, then "settling". Keyboard:
arrow keys ±1 with `final:true`. A custom element, not the shadcn slider, because the drag/settle rules need
full control of the displayed value. States: normal, dragging, settling, muted, pending, disabled, unknown
(`value === null` → no thumb).

**Do:**
1. Create `apps/kiosk/src/components/LevelSlider.tsx`:
```tsx
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  clampLevel, createLevelThrottle, levelFromPointer, SETTLE_TIMEOUT_MS, SLIDER_IDLE,
  sliderDisplayLevel, sliderReducer,
} from "@/lib/level-slider";
import { cn } from "@/lib/utils";
import { DISABLED_CONTROL_CLASS, PENDING_CONTROL_CLASS } from "./state-styles";

export interface LevelSliderProps {
  /** Accessible name, e.g. "Lecturer microphone". */
  label: string;
  /** Server level 0–100; `null` = unknown (thumb hidden). */
  value: number | null;
  /** Throttled while dragging (`final:false`), once on release (`final:true`). */
  onChange: (level: number, final: boolean) => void;
  disabled?: boolean;
  pending?: boolean;
  /** H18: track dimmed; the thumb stays at the saved level. */
  muted?: boolean;
  className?: string;
}

/** SPEC §2.4 / §3.3: track 8px, thumb 30px visual inside a 48px hit area, full width. */
export function LevelSlider({ label, value, onChange, disabled = false, pending = false, muted = false, className }: LevelSliderProps) {
  const [state, dispatch] = useReducer(sliderReducer, SLIDER_IDLE);
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [throttle] = useState(() => createLevelThrottle((level, final) => onChangeRef.current(level, final)));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => () => throttle.cancel(), [throttle]);
  // Server pushes: ignored while dragging, end the settle phase otherwise (reducer decides).
  useEffect(() => {
    dispatch({ type: "server", value });
  }, [value]);
  useEffect(() => {
    if (state.mode !== "settling") return;
    const id = window.setTimeout(() => dispatch({ type: "settle-timeout" }), SETTLE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const levelAt = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect === undefined ? 0 : levelFromPointer(event.clientX, rect.left, rect.width);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const level = levelAt(event);
    dispatch({ type: "down", level });
    throttle.move(level);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (state.mode !== "dragging") return;
    const level = levelAt(event);
    dispatch({ type: "move", level });
    throttle.move(level);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (state.mode !== "dragging") return;
    const level = levelAt(event);
    dispatch({ type: "up", level, server: value });
    throttle.release(level);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled || value === null) return;
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    onChange(clampLevel(value + step), true);
  };

  const shown = sliderDisplayLevel(state, value);
  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown ?? undefined}
      aria-disabled={disabled}
      aria-busy={pending}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex h-12 w-full touch-none select-none items-center rounded-btn border-2 border-transparent px-4",
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      <div ref={trackRef} className={cn("relative h-2 w-full rounded-full bg-border", muted && "opacity-40")}>
        {shown !== null && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-7.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-knob shadow"
            style={{ left: `${shown}%` }}
          />
        )}
      </div>
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0. (Dragging is checked by hand at the T47 checkpoint.)

**Commit:** `git commit -m "feat(kiosk): LevelSlider with throttled drag"`

---

### T32 — `SensorTile`
- [ ] done

**Files:** `apps/kiosk/src/components/SensorTile.tsx`

**Context:** SPEC S1.E42–E45 and screenshot 01 Room sensors: label (`text-sensor-label`, bold, uppercase,
`text-2`), big mono value (`text-value`), model caption (mono `text-caption`, `text-3`). Value tones: default
`text-1`, "Detected" `accent`, "Open" `warn`. H10 stale: value `text-3` + caption "· 14 min ago". H11: "—" + "No
reading yet" in `text-3`. H1: skeleton. The caller formats the value (T6).

**Do:**
1. Create `apps/kiosk/src/components/SensorTile.tsx`:
```tsx
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { STALE_TEXT_CLASS, VALUE_TONE_CLASS, type ValueTone } from "./state-styles";

export interface SensorTileProps {
  /** "TEMPERATURE" (rendered uppercase). */
  label: string;
  /** Formatted value ("26.4°", "61%", "Detected"); `null` = no reading ever (H11). */
  value: string | null;
  /** Model caption, e.g. "SNZB-02P". */
  caption: string;
  tone?: ValueTone;
  /** H10: e.g. "14 min ago". */
  staleAgo?: string | null;
  loading?: boolean;
}

/** S1.E42–E45. */
export function SensorTile({ label, value, caption, tone = "default", staleAgo = null, loading = false }: SensorTileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sensor-label font-bold uppercase text-text-2">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : value === null ? (
        <p className="flex flex-col">
          <span className="font-mono text-value font-semibold text-text-3">—</span>
          <span className="text-caption text-text-3">No reading yet</span>
        </p>
      ) : (
        <p className={cn("font-mono text-value font-semibold", staleAgo !== null ? STALE_TEXT_CLASS : VALUE_TONE_CLASS[tone])}>
          {value}
        </p>
      )}
      <p className="font-mono text-caption text-text-3">
        {caption}
        {staleAgo !== null && !loading && value !== null && <span className="font-sans"> · {staleAgo}</span>}
      </p>
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): SensorTile"`

---

### T33 — `MetricTile`
- [ ] done

**Files:** `apps/kiosk/src/components/MetricTile.tsx`

**Context:** SPEC S2 power metrics (screenshot 02: "POWER 287 W" in `accent`, "VOLTAGE 231 V", "TODAY 1.84 kWh",
"RATING 13 A" in `text-1`). States: value, H11 no reading ("—" + "No reading yet"), loading skeleton.

**Do:**
1. Create `apps/kiosk/src/components/MetricTile.tsx`:
```tsx
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { VALUE_TONE_CLASS, type ValueTone } from "./state-styles";

/** S2 power metrics (POWER 287 W, VOLTAGE 231 V …). `value` null = H11. */
export function MetricTile({ label, value, tone = "default", loading = false }: {
  label: string;
  value: string | null;
  tone?: ValueTone;
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
        <p className={cn("font-mono text-value font-semibold", VALUE_TONE_CLASS[tone])}>{value}</p>
      )}
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): MetricTile"`

---

### T34 — `KeyValueRow`
- [ ] done

**Files:** `apps/kiosk/src/components/KeyValueRow.tsx`

**Context:** Screenshot 02 Coordinator/Mesh cards: label `text-2` left, value right (mono by default; "Routers 2"
in `accent`). States: value, unknown (`null` → "—" in `text-3`), loading.

**Do:**
1. Create `apps/kiosk/src/components/KeyValueRow.tsx`:
```tsx
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/lib/utils";
import { VALUE_TONE_CLASS, type ValueTone } from "./state-styles";

/** S2 side cards: "Chipset … CC2652P1". Label text-2 left, value right (mono by default). */
export function KeyValueRow({ label, value, mono = true, tone = "default", loading = false }: {
  label: string;
  value: string | null;
  mono?: boolean;
  tone?: ValueTone;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <span className="text-caption text-text-2">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        <span className={cn("text-right text-caption", mono && "font-mono", value === null ? "text-text-3" : VALUE_TONE_CLASS[tone])}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): KeyValueRow"`

---

### T35 — `InlineError`
- [ ] done

**Files:** `apps/kiosk/src/components/InlineError.tsx`

**Context:** SPEC H6a/H6b: red (`danger`) caption line with an alert icon; `role="alert"`. The 6 s lifetime is
the store's job (T15); the component renders the message or nothing.

**Do:**
1. Create `apps/kiosk/src/components/InlineError.tsx`:
```tsx
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** H6a/H6b red line; the 6 s lifetime lives in the inline-error store. Renders nothing when null. */
export function InlineError({ message, className }: { message: string | null; className?: string }) {
  if (message === null) return null;
  return (
    <p role="alert" className={cn("flex items-center gap-2 text-caption text-danger", className)}>
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      {message}
    </p>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): InlineError"`

---

### T36 — `LockBadge`
- [ ] done

**Files:** `apps/kiosk/src/components/LockBadge.tsx`

**Context:** SPEC H12 / S1 view-only presentation ("small padlock on each card header"), `text-3`, 16px. Not a
touch target (the control under it is). Used from M03.

**Do:**
1. Create `apps/kiosk/src/components/LockBadge.tsx`:
```tsx
import { Lock } from "lucide-react";

/** H12 padlock on card headers (view-only). Decorative size; the control itself is the target. */
export function LockBadge() {
  return <Lock role="img" aria-label="Locked" className="size-4 shrink-0 text-text-3" />;
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): LockBadge"`

---

### T37 — `DashedAddButton`
- [ ] done

**Files:** `apps/kiosk/src/components/DashedAddButton.tsx`

**Context:** SPEC §3.1 `border-dashed` "for '+ Add …' placeholders" (S3 "+ Add device", "+ Add a command");
48px tall, full width, `text-2` label with a plus icon. States: default, pressed (`surface-2` fill), disabled.

**Do:**
1. Create `apps/kiosk/src/components/DashedAddButton.tsx`:
```tsx
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { DISABLED_CONTROL_CLASS } from "./state-styles";

/** "+ Add device" / "+ Add a command" placeholder (SPEC §3.1 border-dashed). */
export function DashedAddButton({ label, onPress, disabled = false, className }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      disabled={disabled}
      onClick={onPress}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-btn border border-dashed border-border-dashed text-button font-semibold text-text-2",
        "active:bg-surface-2 data-[pressed=true]:bg-surface-2",
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      <Plus aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): DashedAddButton"`

---

### T38 — Placeholder pages for S1, S2 and S3
- [ ] done

**Files:** `apps/kiosk/src/components/PlaceholderPage.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`,
`apps/kiosk/src/features/devices/DevicesPage.tsx`, `apps/kiosk/src/features/settings/SettingsPage.tsx`

**Context:** M02 Scope ("S1/S2/S3 pages are placeholders"), M02 notes ("Keep `features/` empty except
placeholders; shared pieces go to `components/`"). `PlaceholderPage` is shared by three features, so it lives in
`components/` (CLAUDE.md). Settings tab titles are SPEC S3.E5: "Remote configuration" · "Network" · "Schedule" ·
"Devices" · "About". Leave the existing `.gitkeep` files in place.

**Do:**
1. Create `apps/kiosk/src/components/PlaceholderPage.tsx`:
```tsx
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";

/** Temporary page body until the screen's milestone replaces it. */
export function PlaceholderPage({ title, spec, milestone }: { title: string; spec: string; milestone: string }) {
  return (
    <Card className="flex flex-col gap-2">
      <SectionLabel>{spec}</SectionLabel>
      <h1 className="text-title font-bold text-text-1">{title}</h1>
      <p className="text-caption text-text-2">Placeholder · built in {milestone}</p>
    </Card>
  );
}
```
2. Create `apps/kiosk/src/features/control/ControlPage.tsx`:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";

/** S1 `/` — placeholder until M04. */
export function ControlPage() {
  return <PlaceholderPage title="Control" spec="S1" milestone="M04" />;
}
```
3. Create `apps/kiosk/src/features/devices/DevicesPage.tsx`:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";

/** S2 `/devices` — placeholder until M05. */
export function DevicesPage() {
  return <PlaceholderPage title="Zigbee devices" spec="S2" milestone="M05" />;
}
```
4. Create `apps/kiosk/src/features/settings/SettingsPage.tsx`:
```tsx
import { PlaceholderPage } from "@/components/PlaceholderPage";

// S3.E5 tab names. The technician guard arrives in M03.
const TABS = {
  remote: { title: "Remote configuration", spec: "S3" },
  network: { title: "Network", spec: "S3b" },
  schedule: { title: "Schedule", spec: "S3c" },
  devices: { title: "Devices", spec: "S3d" },
  about: { title: "About", spec: "S3e" },
} as const;
export type SettingsTab = keyof typeof TABS;

/** `/settings/*` — placeholder until M06. */
export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const { title, spec } = TABS[tab];
  return <PlaceholderPage title={`Settings › ${title}`} spec={spec} milestone="M06" />;
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): placeholder pages for control, devices and settings"`

---

### T39 — `StatusIndicator` (S1.E4, phone sheet)
- [ ] done

**Files:** `apps/kiosk/src/app/StatusIndicator.tsx`

**Context:** SPEC S1.E4 (normal green "All systems normal"; degraded amber; fault red), H1 (before the snapshot:
"Connecting…", hollow grey ring), §2.2 phone ("status dot (tap shows the status text in a sheet)"), AC2. Layout:
- `≥600` (`sm:flex`): dot + text, `text-caption text-text-2`, not interactive (tap → S2 is M04).
- `<600` (`sm:hidden`): a 48×48 (`size-12`) button with only the dot, `aria-label="System status: <text>"`;
  tapping opens a bottom `Sheet` (T3) titled "System status" (section style) with the dot + text
  (`text-card-title text-text-1`) and a 48px "Close" button. The shadcn close icon is turned off
  (`showCloseButton={false}`) because it is smaller than 48px.
Lives in `app/` because it is part of the shell and reads data hooks.

**Do:**
1. Create `apps/kiosk/src/app/StatusIndicator.tsx`:
```tsx
import { useState } from "react";
import { STATUS_DOT_CLASS, type StatusLevel } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";

/** S1.E4. ≥600: dot + text. <600: a 48×48 dot button that opens a bottom sheet with the text. */
export function StatusIndicator() {
  const status = useRoomState((state) => state.room.status);
  const [open, setOpen] = useState(false);
  const level: StatusLevel = status?.level ?? "connecting";
  const text = status?.text ?? "Connecting…";
  const dot = <span aria-hidden="true" className={cn("size-2.5 rounded-full", STATUS_DOT_CLASS[level])} />;

  return (
    <>
      <p className="hidden items-center gap-2 text-caption text-text-2 sm:flex">
        {dot}
        {text}
      </p>
      <button
        type="button"
        aria-label={`System status: ${text}`}
        onClick={() => setOpen(true)}
        className="flex size-12 shrink-0 items-center justify-center rounded-btn active:bg-control sm:hidden"
      >
        {dot}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-3 rounded-t-card p-4">
          <SheetTitle className="text-section font-bold uppercase text-text-2">System status</SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-card-title text-text-1">
            {dot}
            {text}
          </SheetDescription>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 rounded-btn border-2 border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125"
          >
            Close
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): header status indicator with phone sheet"`

---

### T40 — `Header`
- [ ] done

**Files:** `apps/kiosk/src/app/Header.tsx`

**Context:** SPEC S1.E1–E7, §2.2 phone header, §3.2 (wordmark 24 bold, "CENTRAL" `brand` tracking 0.12em;
clock mono semibold 28; date mono 13 `text-2`), §3.3 (header 64 desktop / 56 phone), ARCHITECTURE §4.1
("clock/date `hidden lg:flex`, labels collapse to icons below `sm`", gutters `px-4` / `lg:px-6`). Screenshot
01 header row, left → right: wordmark | `10:42` `Mon 5 Oct` (centred) | "● All systems normal" | `R-101` chip |
Devices (wifi icon) | Settings (gear icon). Exact classes:
- `<header>`: `flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6`.
- Wordmark: `min-w-0 flex-1 truncate text-caption font-bold sm:text-wordmark`. On phones it is 12px: measured
  at 390px, a 15px wordmark truncates next to the dot, chip and two 48px buttons.
- Clock block: `hidden … lg:flex`; before the first snapshot (`useServerNow()` is `null`) a `Skeleton h-8 w-36`.
- Right group: `flex shrink-0 items-center justify-end gap-1 sm:gap-3 lg:flex-1` (both side zones flex-1 at
  `lg` keeps the clock centred).
- Room chip: not interactive; `h-10` phone / `sm:h-12`, `rounded-chip border-border-strong bg-control`, mono
  `text-card-title`; shows `state.room.id`, before the snapshot `VITE_ROOM_ID` (decision 5).
- Devices → `/devices`, Settings → `/settings` (the technician gate is M03). `h-12 min-w-12`, icon `size-5`,
  label `hidden sm:inline`, `aria-label` always set, pressed via `usePressed`.
The Lock button (S1.E8) is M03 — do not add it.

**Do:**
1. Create `apps/kiosk/src/app/Header.tsx`:
```tsx
import { Settings, Wifi, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { kioskEnv } from "@/data/env";
import { useRoomState } from "@/data/hooks";
import { formatDate, formatTime } from "@/lib/format";
import { useServerNow } from "@/lib/server-time";
import { usePressed } from "@/lib/use-pressed";
import { Skeleton } from "@/ui/skeleton";
import { StatusIndicator } from "./StatusIndicator";

function HeaderLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const pressed = usePressed();
  return (
    <Link
      to={to}
      aria-label={label}
      {...pressed}
      className="flex h-12 min-w-12 items-center justify-center gap-2 rounded-btn border border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 sm:px-4"
    >
      <Icon aria-hidden="true" className="size-5" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/** S1.E1–E7 (Lock S1.E8 arrives in M03). Phone (<600): one 56px row (SPEC §2.2). */
export function Header() {
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const now = useServerNow();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
      <p className="min-w-0 flex-1 truncate text-caption font-bold text-text-1 sm:text-wordmark">
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
        <span className="flex h-10 items-center rounded-chip border border-border-strong bg-control px-2 font-mono text-card-title font-semibold text-text-1 sm:h-12 sm:px-3">
          {roomId}
        </span>
        <HeaderLink to="/devices" icon={Wifi} label="Devices" />
        <HeaderLink to="/settings" icon={Settings} label="Settings" />
      </div>
    </header>
  );
}
```

**Verify:** `pnpm verify` → exit 0. (Visual check at the T45 checkpoint.)

**Commit:** `git commit -m "feat(kiosk): app header"`

---

### T41 — `ConnectionBanner`
- [ ] done

**Files:** `apps/kiosk/src/app/ConnectionBanner.tsx`

**Context:** SPEC S1.E9, S5, §2.5, H2–H4; AC4. Under the header, full width, `min-h-12`, `text-button font-semibold`,
`role="status" aria-live="polite"`:
- `connecting`, `live` → not rendered (H1 uses the header status instead).
- `reconnecting` → `bg-warn-fill text-warn`, border `warn/40`: "Reconnecting…".
- `unreachable` → `bg-danger-fill text-danger`, border `danger/40`: "Can't reach R-101 controller" (room id from
  state, else `VITE_ROOM_ID`) + **Retry** button `h-12 min-w-24` (48px, SPEC) calling `connection.retry()`.
- `back_online` → `bg-accent-fill text-accent`, border `accent/40`: "Back online" (the 2 s are the state machine's).

**Do:**
1. Create `apps/kiosk/src/app/ConnectionBanner.tsx`:
```tsx
import { kioskEnv } from "@/data/env";
import { useRealtime } from "@/data/api-context";
import { useConnectionStatus, useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";

/** S1.E9 / S5 / H2–H4. Hidden while connecting or live. */
export function ConnectionBanner() {
  const status = useConnectionStatus();
  const { connection } = useRealtime();
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  if (status === "connecting" || status === "live") return null;

  const tone = {
    reconnecting: "border-warn/40 bg-warn-fill text-warn",
    unreachable: "border-danger/40 bg-danger-fill text-danger",
    back_online: "border-accent/40 bg-accent-fill text-accent",
  }[status];
  const text = {
    reconnecting: "Reconnecting…",
    unreachable: `Can't reach ${roomId} controller`,
    back_online: "Back online",
  }[status];

  return (
    <div role="status" aria-live="polite" className={cn("flex min-h-12 items-center gap-3 border-b px-4 py-1 text-button font-semibold lg:px-6", tone)}>
      <span className="flex-1">{text}</span>
      {status === "unreachable" && (
        <button
          type="button"
          onClick={() => connection.retry()}
          className="h-12 min-w-24 rounded-btn border-2 border-danger bg-control px-4 text-button font-semibold text-text-1 active:brightness-125"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): connection banner"`

---

### T42 — Route error boundary
- [ ] done

**Files:** `apps/kiosk/src/app/ErrorBoundary.tsx`

**Context:** M02 Scope (`ErrorBoundary`). react-router's `errorElement` catches render and loader errors for the
whole shell. Copy is `[INFERRED]` (SPEC has none): title "Something went wrong", body "Reload the page to
continue.", the error message in mono `text-3`, a 48px "Reload" button.

**Do:**
1. Create `apps/kiosk/src/app/ErrorBoundary.tsx`:
```tsx
import { isRouteErrorResponse, useRouteError } from "react-router";
import { Card } from "@/components/Card";

/** Route `errorElement`: any render error inside the shell lands here [INFERRED copy]. */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : null;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <Card className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-card-title font-semibold text-text-1">Something went wrong</h1>
        <p className="text-caption text-text-2">Reload the page to continue.</p>
        {detail !== null && <p className="font-mono text-caption text-text-3">{detail}</p>}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 rounded-btn border-2 border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125"
        >
          Reload
        </button>
      </Card>
    </main>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): route error boundary"`

---

### T43 — Mock dev panel
- [ ] done

**Files:** `apps/kiosk/src/app/dev/MockPanel.tsx`, `apps/kiosk/src/app/mock-panel-flag.ts`

**Context:** M02 Scope "Mock dev panel (`?mock-panel`)": drop connection, make unreachable, restore, change from
phone, change by hand, toggle a device offline, fail next command, time out next command (decision 4). Shown
only when `VITE_API_MODE=mock` **and** `?mock-panel` was in the URL once in this tab (kept in `sessionStorage`
so in-app navigation keeps it). Fixed bottom-right, collapsible, every button 48px. Two offline toggles: the
lighting switch (`lights`, drives the live ToggleRows) and the mixer (`audio`, drives the live slider).

**Do:**
1. Create `apps/kiosk/src/app/mock-panel-flag.ts`:
```ts
import { kioskEnv } from "@/data/env";

const STORAGE_KEY = "eduscope.mockPanel";

/** `?mock-panel` once per tab keeps the panel across in-app navigation (mock mode only). */
export function mockPanelEnabled(): boolean {
  if (kioskEnv.VITE_API_MODE !== "mock") return false;
  try {
    if (new URLSearchParams(window.location.search).has("mock-panel")) {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).has("mock-panel");
  }
}
```
2. Create `apps/kiosk/src/app/dev/MockPanel.tsx`:
```tsx
import { useState } from "react";
import { fakeRoom } from "@/data/adapters/mock/mock-client";
import { cn } from "@/lib/utils";

const ACTIONS: { label: string; run: () => void }[] = [
  { label: "Drop connection", run: () => fakeRoom.dropConnection() },
  { label: "Make unreachable", run: () => fakeRoom.makeUnreachable() },
  { label: "Restore", run: () => fakeRoom.restore() },
  { label: "Change from phone", run: () => fakeRoom.changeFromPhone() },
  { label: "Change by hand", run: () => fakeRoom.changeByHand() },
  { label: "Toggle lights offline", run: () => fakeRoom.toggleDeviceOffline("lights") },
  { label: "Toggle audio offline", run: () => fakeRoom.toggleDeviceOffline("audio") },
  { label: "Fail next command", run: () => fakeRoom.failNextCommand() },
  { label: "Time out next command", run: () => fakeRoom.timeOutNextCommand() },
];

/** Dev-only panel (`?mock-panel`) that drives the FakeRoom directly. */
export function MockPanel() {
  const [open, setOpen] = useState(true);
  return (
    <aside className="fixed right-4 bottom-4 z-50 w-64 rounded-card border border-border-strong bg-surface p-2 shadow-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between px-2 text-section font-bold uppercase text-text-2"
      >
        Mock panel <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div className={cn("flex-col gap-1", open ? "flex" : "hidden")}>
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.run}
            className="h-12 rounded-btn border border-border-strong bg-control px-3 text-left text-caption font-semibold text-text-1 active:brightness-125"
          >
            {action.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mock dev panel"`

---

### T44 — `AppShell`
- [ ] done

**Files:** `apps/kiosk/src/app/AppShell.tsx`

**Context:** ARCHITECTURE §4.1 frame (header, banner, page; `overflow-x-clip` so there is never a horizontal page
scroll; gutters `px-4` / `lg:px-6`), SPEC H2/H3 ("values greyed (last known)": the page gets `GREYED_CLASS`
while `reconnecting`/`unreachable`; controls are disabled separately by the gate), H13 Toaster at the bottom,
mock panel. The S1 "no scrolling at 1280×800" layout is M04's job.

**Do:**
1. Create `apps/kiosk/src/app/AppShell.tsx`:
```tsx
import { Outlet } from "react-router";
import { GREYED_CLASS } from "@/components/state-styles";
import { useConnectionStatus } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Toaster } from "@/ui/sonner";
import { ConnectionBanner } from "./ConnectionBanner";
import { Header } from "./Header";
import { MockPanel } from "./dev/MockPanel";
import { mockPanelEnabled } from "./mock-panel-flag";

const showMockPanel = mockPanelEnabled();

/** ARCHITECTURE §4.1 frame: header, banner, page; no horizontal page scroll. */
export function AppShell() {
  const status = useConnectionStatus();
  const greyed = status === "reconnecting" || status === "unreachable";
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <Header />
      <ConnectionBanner />
      <main className={cn("flex-1 px-4 py-4 transition-[filter,opacity] lg:px-6 lg:py-6", greyed && GREYED_CLASS)}>
        <Outlet />
      </main>
      <Toaster />
      {showMockPanel && <MockPanel />}
    </div>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): app shell frame"`

---

### T45 — Router, providers and entry point
- [ ] done

**Files:** `apps/kiosk/src/app/router.tsx`, `apps/kiosk/src/app/providers.tsx`, `apps/kiosk/src/main.tsx`,
`apps/kiosk/src/app/TokenSwatches.tsx` (delete)

**Context:** ARCHITECTURE §4.3 route table (all routes; `/settings` → `/settings/remote`; `*` → `/`; guards are
M03), M02 AC1. `createBrowserRouter` (library mode, D-11). Providers create **one** ApiClient, QueryClient and
realtime runtime per page and start the WS on mount (StrictMode mounts twice in dev: start → stop → start is
supported by the connection manager). The M01 swatch page is replaced (its comment says so). The
`/dev/components` route is added in T47, once the page exists.

**Do:**
1. Create `apps/kiosk/src/app/router.tsx` **without** the dev route for now:
   ```tsx
   import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
   import { ControlPage } from "@/features/control/ControlPage";
   import { DevicesPage } from "@/features/devices/DevicesPage";
   import { SettingsPage } from "@/features/settings/SettingsPage";
   import { AppShell } from "./AppShell";
   import { RouteErrorBoundary } from "./ErrorBoundary";

   // ARCHITECTURE §4.3. Settings guards arrive in M03.
   export const routes: RouteObject[] = [
     {
       path: "/",
       element: <AppShell />,
       errorElement: <RouteErrorBoundary />,
       children: [
         { index: true, element: <ControlPage /> },
         { path: "devices", element: <DevicesPage /> },
         { path: "settings", element: <Navigate to="/settings/remote" replace /> },
         { path: "settings/remote", element: <SettingsPage tab="remote" /> },
         { path: "settings/remote/:deviceId", element: <SettingsPage tab="remote" /> },
         { path: "settings/network", element: <SettingsPage tab="network" /> },
         { path: "settings/schedule", element: <SettingsPage tab="schedule" /> },
         { path: "settings/devices", element: <SettingsPage tab="devices" /> },
         { path: "settings/about", element: <SettingsPage tab="about" /> },
         { path: "*", element: <Navigate to="/" replace /> },
       ],
     },
   ];

   export const router = createBrowserRouter(routes);
   ```
2. Create `apps/kiosk/src/app/providers.tsx`:
```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DataProvider } from "@/data/api-context";
import { createApiClient } from "@/data/create-api-client";
import { kioskEnv } from "@/data/env";
import { createQueryClient } from "@/data/query-client";
import { createRealtimeRuntime } from "@/data/realtime/runtime";
import { getClientLabel } from "@/lib/client-label";

/** One ApiClient, QueryClient and realtime runtime per page; the WS starts on mount. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [value] = useState(() => {
    const api = createApiClient(kioskEnv.VITE_API_MODE);
    const queryClient = createQueryClient();
    const realtime = createRealtimeRuntime({ api, queryClient, label: getClientLabel(), toast: (text) => toast(text) });
    return { api, queryClient, realtime };
  });

  useEffect(() => {
    value.realtime.start();
    return () => value.realtime.stop();
  }, [value]);

  return (
    <QueryClientProvider client={value.queryClient}>
      <DataProvider value={value}>{children}</DataProvider>
    </QueryClientProvider>
  );
}
```
3. Replace `apps/kiosk/src/main.tsx` with:
```tsx
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("index.html is missing #root");
}
createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
```
4. `git rm apps/kiosk/src/app/TokenSwatches.tsx`

**Verify:**
1. `pnpm verify` → exit 0.
2. `pnpm --filter @eduscope/kiosk build` → exit 0 (a ">500 kB chunk" warning is expected and fine).
3. `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/` → header with a live clock,
   "● All systems normal", `R-101`, Devices, Settings; the S1 placeholder card. Click Devices → `/devices`
   placeholder; browser Back → `/`. Open `/nope` → URL becomes `/`. Stop the server.

**Commit:** `git commit -m "feat(kiosk): router, providers and app entry"`

---

### T46 — Live demo section (real command flow)
- [ ] done

**Files:** `apps/kiosk/src/app/dev/LiveDemo.tsx`

**Context:** M02 AC4, AC5, AC7, AC8 need controls bound to the mock through the real path
(`useCommand` → ApiClient → FakeRoom → ServerEvent → `apply-event` → cache). Bound controls:
projector Power on / Power off (`projector.power`, control keys `projector.ir:on` / `projector.ir:off`, device
`projector`; active `confirmed` when running, `neutral` when standby); Front/Rear of room ToggleRows
(`lights.set`, device `lights`; header line turns red "Switch offline · last known state" when the lights device
is offline); Lecturer microphone LevelSlider (`audio.level`, device `audio`); a temperature SensorTile and a
power MetricTile (skeletons until the snapshot, H1). Each block shows its `InlineError`. Lives in `app/dev/`
because it is dev-only and uses `data/` hooks (allowed in `app/`).

**Do:**
1. Create `apps/kiosk/src/app/dev/LiveDemo.tsx`:
```tsx
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { LevelSlider } from "@/components/LevelSlider";
import { MetricTile } from "@/components/MetricTile";
import { ObservedLine } from "@/components/ObservedLine";
import { SectionLabel } from "@/components/SectionLabel";
import { SensorTile } from "@/components/SensorTile";
import { ToggleRow } from "@/components/ToggleRow";
import { stateTone } from "@/components/state-styles";
import { useCommand, useRoomState } from "@/data/hooks";
import { formatCelsius, formatWatts } from "@/lib/format";

/** Controls wired to the mock through the real command flow (M02 AC4, AC5, AC7). */
export function LiveDemo() {
  const projector = useRoomState((state) => state.display.projector);
  const lights = useRoomState((state) => state.environment.lights);
  const mic = useRoomState((state) => state.audio.channels.mic);
  const temperature = useRoomState((state) => state.environment.sensors.temperature);
  const lightsOnline = useRoomState((state) => state.devices.find((d) => d.id === "lights")?.online.value);

  const powerOn = useCommand("projector.ir:on", "projector");
  const powerOff = useCommand("projector.ir:off", "projector");
  const front = useCommand("lights.front", "lights");
  const rear = useCommand("lights.rear", "lights");
  const micLevel = useCommand("audio.mic", "audio");

  const loading = projector === undefined;
  const running = projector?.state.value === "running" || projector?.state.value === "warming_up";
  const lightsTone = stateTone({ confidence: "confirmed", active: true, offline: lightsOnline === false });

  return (
    <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-3">
        <SectionLabel>Live · projector</SectionLabel>
        <ObservedLine
          loading={loading}
          tone={stateTone({ confidence: projector?.state.confidence ?? "unknown", active: running })}
          text={projector?.state.value ?? ""}
        />
        <div className="grid grid-cols-2 gap-3">
          <CommandButton
            label="Power on"
            size="primary"
            active={running ? "confirmed" : null}
            pending={powerOn.pending}
            disabled={!powerOn.gate.enabled}
            onPress={() => powerOn.send({ kind: "projector.power", on: true })}
          />
          <CommandButton
            label="Power off"
            size="primary"
            active={!loading && !running ? "neutral" : null}
            pending={powerOff.pending}
            disabled={!powerOff.gate.enabled}
            onPress={() => powerOff.send({ kind: "projector.power", on: false })}
          />
        </div>
        <InlineError message={powerOn.error ?? powerOff.error} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Live · lights</SectionLabel>
        <ObservedLine
          loading={lights === undefined}
          tone={lightsTone}
          text={lightsOnline === false ? "Switch offline · last known state" : "Confirmed by the switch"}
        />
        <ToggleRow
          label="Front of room"
          on={lights?.front.value ?? null}
          pending={front.pending}
          disabled={!front.gate.enabled}
          onToggle={() => front.send({ kind: "lights.set", gang: "front", on: lights?.front.value !== true })}
        />
        <ToggleRow
          label="Rear of room"
          on={lights?.rear.value ?? null}
          pending={rear.pending}
          disabled={!rear.gate.enabled}
          onToggle={() => rear.send({ kind: "lights.set", gang: "rear", on: lights?.rear.value !== true })}
        />
        <InlineError message={front.error ?? rear.error} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Live · microphone {mic?.value ?? ""}</SectionLabel>
        <LevelSlider
          label="Lecturer microphone"
          value={mic?.value ?? null}
          pending={micLevel.pending}
          disabled={!micLevel.gate.enabled}
          onChange={(level, final) => micLevel.send({ kind: "audio.level", channel: "mic", level, final })}
        />
        <InlineError message={micLevel.error} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SensorTile
          label="Temperature"
          loading={temperature === undefined}
          value={temperature?.kind === "temperature" && temperature.value !== null ? formatCelsius(temperature.value) : null}
          caption="SNZB-02P"
        />
        <MetricTile
          label="Power"
          loading={projector === undefined}
          tone="accent"
          value={projector?.power.value ? formatWatts(projector.power.value.watts) : null}
        />
      </div>
    </Card>
  );
}
```

**Verify:** `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): live demo of the command flow"`

---

### T47 — `/dev/components` gallery (dev builds only)
- [ ] done

**Files:** `apps/kiosk/src/app/dev/ComponentGallery.tsx`, `apps/kiosk/src/app/router.tsx`

**Context:** M02 AC6: "A temporary `/dev/components` route (dev builds only) shows every shared component in
each state from SPEC §3.4 (confirmed, selected, assumed, off, unknown, stale, offline, pending)". The route is
lazy and behind `import.meta.env.DEV`, so the production bundle does not contain the page. Layout: one column
at phone width, `sm:grid-cols-2`, `lg:grid-cols-3`; the live demo spans the top.

**Do:**
1. Create `apps/kiosk/src/app/dev/ComponentGallery.tsx`:
```tsx
import type { ReactNode } from "react";
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { DashedAddButton } from "@/components/DashedAddButton";
import { InlineError } from "@/components/InlineError";
import { KeyValueRow } from "@/components/KeyValueRow";
import { LevelSlider } from "@/components/LevelSlider";
import { LockBadge } from "@/components/LockBadge";
import { MetricTile } from "@/components/MetricTile";
import { ObservedLine } from "@/components/ObservedLine";
import { SectionLabel } from "@/components/SectionLabel";
import { SensorTile } from "@/components/SensorTile";
import { StateDot } from "@/components/StateDot";
import { ToggleRow } from "@/components/ToggleRow";
import type { StateTone } from "@/components/state-styles";
import { LiveDemo } from "./LiveDemo";

// Temporary dev-only page (`/dev/components`, M02 AC6): every shared component in every SPEC
// §3.4 state. Removed when M04–M06 use the components for real.

const TONES: StateTone[] = ["confirmed", "selected", "assumed", "off", "unknown", "offline"];
const noop = (): void => undefined;

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </Card>
  );
}

export function ComponentGallery() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="text-title font-bold text-text-1">Components</h1>
      <LiveDemo />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Demo title="StateDot">
          <ul className="flex flex-col gap-2">
            {TONES.map((tone) => (
              <li key={tone} className="flex items-center gap-2 text-caption text-text-2">
                <StateDot tone={tone} /> {tone}
              </li>
            ))}
            <li className="flex items-center gap-2 text-caption text-text-2">
              <StateDot tone="confirmed" stale /> stale
            </li>
          </ul>
        </Demo>

        <Demo title="ObservedLine">
          <ObservedLine tone="confirmed" text="On · confirmed by draw" />
          <ObservedLine tone="selected" text="Selected, confirmed" />
          <ObservedLine tone="assumed" text="On · assumed" />
          <ObservedLine tone="off" text="Standby · confirmed by draw" />
          <ObservedLine tone="unknown" text="Unknown" />
          <ObservedLine tone="confirmed" text="26.4°" staleAgo="14 min ago" />
          <ObservedLine tone="offline" text="Switch offline · last known state" />
          <ObservedLine tone="confirmed" text="" loading />
        </Demo>

        <Demo title="Card">
          <Card>solid</Card>
          <Card variant="dashed">dashed (assumed / unknown)</Card>
          <Card variant="danger">danger (offline)</Card>
        </Demo>

        <Demo title="CommandButton">
          <div className="grid grid-cols-2 gap-3">
            <CommandButton label="Power on" size="primary" active="confirmed" onPress={noop} />
            <CommandButton label="Power off" size="primary" onPress={noop} />
            <CommandButton label="Podium PC" active="selected" onPress={noop} />
            <CommandButton label="Power on" active="assumed" onPress={noop} />
            <CommandButton label="Power off" active="neutral" onPress={noop} />
            <CommandButton label="Pending" pending onPress={noop} />
            <CommandButton label="Disabled" disabled onPress={noop} />
            <CommandButton label="Offline" disabled active="confirmed" onPress={noop} />
          </div>
        </Demo>

        <Demo title="ToggleRow">
          <ToggleRow label="On" on onToggle={noop} />
          <ToggleRow label="Off" on={false} onToggle={noop} />
          <ToggleRow label="Unknown" on={null} onToggle={noop} />
          <ToggleRow label="Pending" on={false} pending onToggle={noop} />
          <ToggleRow label="Disabled (offline)" on disabled onToggle={noop} />
        </Demo>

        <Demo title="LevelSlider">
          <LevelSlider label="Normal" value={62} onChange={noop} />
          <LevelSlider label="Muted" value={38} muted onChange={noop} />
          <LevelSlider label="Pending" value={50} pending onChange={noop} />
          <LevelSlider label="Disabled" value={20} disabled onChange={noop} />
          <LevelSlider label="Unknown" value={null} onChange={noop} />
        </Demo>

        <Demo title="SensorTile">
          <div className="grid grid-cols-2 gap-4">
            <SensorTile label="Temperature" value="26.4°" caption="SNZB-02P" />
            <SensorTile label="Occupancy" value="Detected" tone="accent" caption="SNZB-03P" />
            <SensorTile label="Door" value="Open" tone="warn" caption="SNZB-04PR2" />
            <SensorTile label="Humidity" value="61%" caption="SNZB-02P" staleAgo="14 min ago" />
            <SensorTile label="No data" value={null} caption="SNZB-02P" />
            <SensorTile label="Loading" value={null} caption="SNZB-02P" loading />
          </div>
        </Demo>

        <Demo title="MetricTile">
          <div className="grid grid-cols-2 gap-4">
            <MetricTile label="Power" value="287 W" tone="accent" />
            <MetricTile label="Voltage" value="231 V" />
            <MetricTile label="Today" value={null} />
            <MetricTile label="Loading" value={null} loading />
          </div>
        </Demo>

        <Demo title="KeyValueRow">
          <KeyValueRow label="Chipset" value="CC2652P1" />
          <KeyValueRow label="Routers" value="2" tone="accent" />
          <KeyValueRow label="Joining" value={null} />
          <KeyValueRow label="Loading" value={null} loading />
        </Demo>

        <Demo title="InlineError · LockBadge · DashedAddButton">
          <InlineError message="Couldn't reach the blaster" />
          <InlineError message="No response · tap to retry" />
          <p className="flex items-center gap-2 text-card-title font-semibold text-text-1">
            Lights <LockBadge />
          </p>
          <DashedAddButton label="Add device" onPress={noop} />
          <DashedAddButton label="Disabled" disabled onPress={noop} />
        </Demo>
      </div>
    </div>
  );
}
```
2. In `apps/kiosk/src/app/router.tsx`:
   - insert after the `// ARCHITECTURE §4.3. Settings guards arrive in M03.` line:
     ```tsx
     const devRoutes: RouteObject[] = import.meta.env.DEV
       ? [
           {
             path: "dev/components",
             lazy: async () => ({ Component: (await import("./dev/ComponentGallery")).ComponentGallery }),
           },
         ]
       : [];
     ```
   - replace `        { path: "*", element: <Navigate to="/" replace /> },` with
     ```tsx
             ...devRoutes,
             { path: "*", element: <Navigate to="/" replace /> },
     ```
   The final file must equal:
```tsx
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { ControlPage } from "@/features/control/ControlPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AppShell } from "./AppShell";
import { RouteErrorBoundary } from "./ErrorBoundary";

// ARCHITECTURE §4.3. Settings guards arrive in M03.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "dev/components",
        lazy: async () => ({ Component: (await import("./dev/ComponentGallery")).ComponentGallery }),
      },
    ]
  : [];

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <ControlPage /> },
      { path: "devices", element: <DevicesPage /> },
      { path: "settings", element: <Navigate to="/settings/remote" replace /> },
      { path: "settings/remote", element: <SettingsPage tab="remote" /> },
      { path: "settings/remote/:deviceId", element: <SettingsPage tab="remote" /> },
      { path: "settings/network", element: <SettingsPage tab="network" /> },
      { path: "settings/schedule", element: <SettingsPage tab="schedule" /> },
      { path: "settings/devices", element: <SettingsPage tab="devices" /> },
      { path: "settings/about", element: <SettingsPage tab="about" /> },
      ...devRoutes,
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

**Verify:**
1. `pnpm verify` → exit 0.
2. `pnpm --filter @eduscope/kiosk build` → exit 0, and `grep -l "OBSERVEDLINE\|ObservedLine" apps/kiosk/dist/assets/*.js`
   prints nothing (the gallery is not in the production bundle).

**Commit:** `git commit -m "feat(kiosk): dev component gallery"`

---

### T48 — Acceptance walk-through (M02 criteria)
- [ ] done

**Files:** this plan (checkbox only). No code changes; if a check fails, write a Blocker (don't fix in this task).

**Context:** M02 "Acceptance criteria" 1–9. Start the app with `pnpm --filter @eduscope/kiosk dev` (mock mode
via `.env.development`). Use Chromium/Chrome DevTools device mode for widths. Record every result (pass/fail +
note) in the commit message body.

**Do:**
1. **AC1 routing.** Visit `/`, `/devices`, `/settings` (→ URL becomes `/settings/remote`),
   `/settings/remote/projector`, `/settings/network`, `/settings/schedule`, `/settings/devices`,
   `/settings/about`: each shows its placeholder card inside the header shell. `/does-not-exist` → `/`. Click
   Devices then Settings, press browser Back twice and Forward once → the URLs and pages follow.
2. **AC2 header.** At 1280×800 compare with `reference/screens/01-control-page.png` (header row): wordmark,
   `HH:mm` clock, `ddd d MMM` date, "● All systems normal", `R-101`, Devices, Settings. At 390×844 run in the
   console:
   ```js
   const h = document.querySelector("header");
   console.log(h.getBoundingClientRect().height,
     [...h.querySelectorAll("a,button")].map((e) => [e.getAttribute("aria-label"), e.getBoundingClientRect().width, e.getBoundingClientRect().height]),
     document.documentElement.scrollWidth === window.innerWidth);
   ```
   → `56`, every target ≥ 48×48, `true`; the clock/date are hidden; the wordmark is not cut off ("…"). Tap the
   status dot → a bottom sheet "System status / All systems normal"; Close dismisses it.
3. **AC3 first load.** On `/dev/components`, DevTools → Performance → record → reload → stop. In the first
   frames the header reads "Connecting…", the clock and the live values show skeleton bars, then values
   appear (200–600 ms).
4. **AC4 drop.** Open `/dev/components?mock-panel`. "Drop connection" → amber "Reconnecting…" banner; the page
   greys; the live buttons/toggles/slider are disabled but keep their values. Wait 10 s → red "Can't reach R-101
   controller" with a Retry button ≥48px tall. "Restore" → within ≤8 s (or tap Retry) green "Back online", gone
   after 2 s.
5. **AC5 visibility resync.** "Drop connection" → "Change by hand" (Front of room flips, but the page still
   shows the old value) → "Restore" → immediately switch to another browser tab and back (a real tab switch fires
   `visibilitychange`). The banner goes "Back online"
   at once (no 8 s wait) and Front of room shows the new value.
6. **AC6 gallery.** `/dev/components` shows StateDot, ObservedLine, Card, CommandButton, ToggleRow, LevelSlider,
   SensorTile, MetricTile, KeyValueRow, InlineError, LockBadge, DashedAddButton, covering confirmed, selected,
   assumed, off, unknown, stale, offline, pending. Check at 390px too (one column, no horizontal scroll).
7. **AC7 command flow.** Tap "Power off": the button border pulses, its label stays "Power off", the projector
   line stays "running" until the mock pushes (≤1.2 s), then "standby" and "Power off" is highlighted. Tap
   "Power on" 5× fast → one command only (pulse once). "Fail next command" → tap Rear of room → red "Command
   failed" under the lights for 6 s, the toggle keeps the server value. "Time out next command" → tap Front of
   room → after ~5 s "No response · tap to retry". Drag the microphone slider: the thumb follows the finger,
   the "MICROPHONE nn" label updates during the drag (throttled), and the thumb settles at the released value.
8. **AC8 attribution toast.** "Change from phone" → toast at the bottom "Rear of room turned on · from phone" for
   ~4 s; Rear of room flips. Own taps produce **no** toast.
9. **AC9 tests.** `pnpm verify` → exit 0, and
   `pnpm --filter @eduscope/kiosk exec vitest run --reporter=verbose 2>&1 | grep -E "apply-event|connection|pending-store|state-styles|level-slider|format|client-label|http-client"`
   shows passing tests in each of those files.
10. Tick this task and commit.

**Verify:** all ten steps pass.

**Commit:** `git commit -m "chore: M02 acceptance walk-through"`

## Checkpoints

- After T10: "Human: nothing visible yet; skim `components/state-styles.ts` against SPEC §3.4 (one minute)."
- After T45: "Human: run `pnpm --filter @eduscope/kiosk dev`, compare the header with screen 01 at 1280×800 and
  check the phone header at 390×844 (one 56px row, icon buttons, status dot opens a sheet)."
- After T47: "Human: open `/dev/components?mock-panel` at 1280×800 and 390×844; try drop/restore, fail/timeout,
  change from phone, and drag the slider."

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- Code-split the mock adapter and the mock panel out of the production bundle (dynamic `import()` behind
  `VITE_API_MODE`); the build now warns about a >500 kB chunk.
- Screenshot 01 puts the clock slightly left of centre (~43% of the width); the plan centres it.
- ESLint rule against hex/rgb literals in `apps/kiosk/src` (REVIEW-M01 L3), now that real components exist.
- A test-only `?mock-latency=` knob so AC3 (skeletons) is easier to see than with a Performance recording.
