# PLAN-M04 — Control page (S1)
Milestone: `docs/milestones/M04-control-page.md` · Start tag: `m04-start` · Verify-all: `pnpm verify`

Inputs read for this plan: M04; SPEC §2.2 (phone S1), §2.3–2.5, §3.1–3.4, S1 (E1–E45 + view-only), H1–H25 as
listed in M04, R1–R4, R6, R9–R13, §6 derived states, §7.1; ARCHITECTURE §1, §3.2–3.3, §4.1–4.8, §6.4–6.5;
CLAUDE.md; PLAN-M03 (format, executor notes) + REVIEW-M03 and the M00 backlog; `reference/screens/01-control-page.png`
(looked at directly; there is no `reference/prototype/`); the current code (`apps/kiosk`, `packages/contracts`).
**No contract changes are needed:** `RoomState` already carries every S1 field (`display.source`,
`display.projector.{state,power,feedback}`, `display.screen`, `audio`, `environment.{lights,ac,sensors}`,
`interlock`, `ir_blaster`, `devices[].online`), and `CommandBody` already has every S1 command kind.

## Executor notes (read once, apply to every task)

- Paths are relative to the repo root `/home/rust-cohle/edcontrol`. Kiosk code imports with the `@/` alias and
  **no** file extension. `verbatimModuleSyntax`, `exactOptionalPropertyTypes`, `noUnusedLocals` and
  `noUncheckedIndexedAccess` are on.
- **Every code block in this plan was compiled, linted and tested** in a throw-away worktree on 2026-10-13, and the
  plan was then **replayed task by task** from `m04-start` in a second fresh worktree with typecheck + lint + all
  Vitest green after every task. The finished page was driven in headless Chromium at 1280×800, 1024×800,
  800×1000 and 390×844 (numbers in the Acceptance task come from those runs). Write code blocks **verbatim**:
  - "Create `X`" / "Replace the whole file `X`" = the block is the full file content;
  - "In `X` replace: … with: …" = an exact, unique text replacement (the old text occurs once);
  - "Append to `X`" = add the block at the end of the file.
- Tests run in Vitest's `node` environment (no DOM). Only pure logic is tested (`*.view.ts` selectors, mock rules,
  FakeRoom, the command sender, state-styles). Components are checked by eye (CLAUDE.md: no tests of pure markup).
- No `as` casts other than `as const`. No hex/rgb literals outside `tokens.css`. Tailwind class strings stay
  literal. Arbitrary values in this plan (`@min-[22rem]:`, `sm:grid-rows-[auto_1fr]`) are sizes, not colours.
- **Decisions this plan makes** (do not re-open them):
  - **D1 — no contract change.** See the inputs paragraph.
  - **D2 — a `warning` state tone** (solid amber dot, amber text, solid card) is added to `state-styles.ts`. SPEC
    uses a *solid* amber dot for "Warming up"/"Cooling down" (S1.E13, H14), the muted bar (S1.E23) and
    "2 of 3 reporting" (S1.E41); the existing `assumed` tone is a *hollow* ring. `stateTone()` never returns it;
    callers pick it.
  - **D3 — card header state lines use text-2 for confirmed.** Screenshot 01 shows "On · confirmed by draw",
    "Confirmed by the switch" and "Lowered" in grey; SPEC §3.4 allows `accent` or `text-2`. New
    `HEADER_LINE_CLASS` in `state-styles.ts`. "Selected, confirmed" on the source tile stays green (`TEXT_CLASS`).
  - **D4 — slider levels supersede the pending entry.** Today `useCommand().send` ignores a send while the key is
    pending (H5), so during a drag most `audio.level` updates **and the release value** are dropped (checked in
    Chromium: release at 74 settled at 68). `send(body, { supersede: true })` replaces the pending entry instead.
    Only `LevelCard` passes it; taps keep H5.
  - **D5 — the mock starts as screenshot 01** (AC1: AC "On · assumed", 24°). AC8's "Unknown before any command"
    (R3: after a controller start) is produced with the new panel button **"Restart controller (AC unknown)"**.
  - **D6 — mock R9:** mute saves both levels into `saved_levels` and the mixer reads 0; unmute writes the saved
    levels back. While muted the value reads "Muted" and the thumb sits at the saved level (H18).
  - **D7 — dragging while muted** sends `audio.mute_all {muted:false}` once, then the levels (ARCHITECTURE §4.6,
    Q8b). The mock lands commands **in arrival order** (like core-api's dispatcher) so the unmute's restore never
    overwrites the new level.
  - **D8 — no `lg:h-dvh lg:overflow-hidden`.** ARCHITECTURE §4.1 suggests locking the page to the viewport at `lg`.
    That would clip the Environment column on a podium-PC browser (1280 wide, ~650 tall) with no way to scroll.
    Instead the page has a natural height that fits 1280×800 (budget below; measured bottom 708px normal, 792px
    worst case, viewport 800). Shorter windows scroll. Recorded in `docs/decisions/D-20-s1-height-budget.md` (T33).
    The same record covers the one container query (D16).
  - **D9 — the header is `sticky top-0` at every width** (the milestone note's "sticky header"); sections carry
    `scroll-mt-18` (56px header + 16px) so BottomNav jumps land below it.
  - **D10 — `BottomNav` is `fixed bottom-0`** (not `sticky`, which would stop at `main`'s padding) and the page has
    `pb-14` below `sm` so the last card is never under it.
  - **D11 — padlocks (H12)** sit on every card / tile / bar that has a control: 2 source tiles, Projector,
    Projection screen, 2 level cards, Mute bar, Lights, Air conditioning = **9**. Room sensors has no control, so no
    padlock. Padlocks use a new `useViewOnly()` = `session.access === "view"`, so they never flash while the
    session loads (this also settles backlog M03-L5 for S1; `computeControlGate` itself is unchanged).
  - **D12 — screen button:** Lowered → "Raise", Raised → "Lower", Unknown → "Lower" (enabled), Moving… → "Raise"
    **disabled** (no Stop, Q2).
  - **D13 — interlock:** S1.E14 "disabled during interlock" = Power on is disabled while `interlock.status ===
    "holding"`, and the H15 line "Mains held on until projector cools" shows. The mock holds only while
    `cooling_down`.
  - **D14 — S1.E4 tap → `/devices` from 600px up** (the status text becomes a link). Below 600 the dot keeps
    opening the status sheet (SPEC §2.2 phone).
  - **D15 — `?time-scale=0.1`** (dev builds, mock adapter) shortens the mock's timed behaviour: IR→draw 3 s, warm-up
    30 s, cool-down 60 s, H7b 90 s, screen travel 8 s become 0.3/3/6/9/0.8 s. It is the kiosk-mock twin of the
    hw-service's `HW_FAKE_TIME_SCALE`. Latency (200–600 ms) and command timeouts are not scaled.
  - **D16 — sensor tiles:** numbers (`26.4°`, `61%`) stay mono 24px; words ("Detected", "Clear", "Open",
    "Closed") use a new 18px token `text-value-word` (sans). Mono 24px "Detected" is 115px wide; a tile is 86px
    at 1280. Tiles are 4 across when the card's inner width is ≥ 22rem (`@container` + `@min-[22rem]:grid-cols-4`),
    else 2×2. Viewport breakpoints can't express this: at 1024 the column is too narrow for 4 tiles, at 1280 it fits.
  - **D17 — H8 copy:** "{device.name} offline · last known state" (e.g. "HDMI switch offline · last known state",
    "Audio mixer offline · last known state"); the lights card keeps SPEC's literal "Switch offline · last known
    state"; the projector's meter keeps "Power meter offline · state unknown" (S1.E13). Offline sensors show the
    caption suffix "· offline" in place of "· 14 min ago".
  - **D18 — projector and AC buttons are gated on the `ir_blaster` device** (H25: they are IR), not on the
    `projector`/`ac` devices.
- After each task: run the task's **Verify**, then `pnpm verify`; when both are green tick the task's checkbox in
  this file and commit **with this plan file included**: `git add -A && git commit -m "<message from the task>"`.

### Vertical budget at 1280×800 (D8)

Header 64 · `main` padding 24 top + 24 bottom → **688px** for the columns. Section label 16 + gap 12.

| Column | Contents (gap 12 between cards) | Height |
|---|---|---|
| Display | label 28 · tiles 72 · Projector 168 · Screen 90 | 382 |
| Audio | label 28 · mic 118 · PC 118 · mute bar 56 | 344 |
| Environment | label 28 · Lights 204 · AC 216 · Sensors 148 | **620** (measured bottom 708 → 68px spare) |
| Environment, worst case | + "IR blaster offline" line, stale captions on 2 lines, "No reading yet" | 680 (measured bottom 768) |

Rules that keep the budget: primary buttons `h-14`, AC −/+ `size-16`, toggle rows `min-h-14`, card padding 16,
gaps 12, the sensors header link is the only 48px header.

## File map

All paths under `apps/kiosk/src/` unless they start with `docs/`.

| File | Create/Modify | Responsibility |
|---|---|---|
| `components/state-styles.ts` (+ `.test.ts`) | Modify | `warning` tone (D2), `HEADER_LINE_CLASS` (D3), value tones `muted`/`faint` |
| `app/dev/ComponentGallery.tsx` | Modify | list the new `warning` tone |
| `styles/tokens.css`, `styles/token-names.ts` | Modify | `--text-value-word` 18px (D16) |
| `components/SensorTile.tsx` | Modify | `numeric` prop: words in sans 18px |
| `data/commands/command-sender.ts` (+ `.test.ts`) | Modify | `SendOptions.supersede` (D4) |
| `data/hooks.ts` | Modify | `useCommand().send(body, options)`; `useViewOnly()` (D11) |
| `data/adapters/mock/mock-rules.ts` (+ `.test.ts`) | Modify | S1 command semantics (R2, R9, R3/R4, screen), R1 ramp, derived status/reporting |
| `data/adapters/mock/mock-ramp.test.ts` | Create | R1 ramp + interlock tests |
| `data/adapters/mock/mock-derived.test.ts` | Create | reporting count + room status tests |
| `data/adapters/mock/time-scale.ts` (+ `.test.ts`) | Create | `?time-scale=` reader (D15) |
| `data/adapters/mock/mock-client.ts` | Modify | pass the time scale to the page's FakeRoom |
| `data/adapters/mock/fake-room.ts` | Modify | arrival order, derived fields, timed effects, panel methods |
| `data/adapters/mock/fake-room-order.test.ts` | Create | arrival-order test |
| `data/adapters/mock/fake-room-timed.test.ts` | Create | projector ramp, H7b, screen travel |
| `data/adapters/mock/fake-room-panel.test.ts` | Create | panel methods (H8, H9, H10, H11, H25, R3 …) |
| `app/dev/MockPanel.tsx` | Modify | one button per S1 hidden state |
| `features/control/display/source-tiles.view.ts` (+ `.test.ts`) | Create | S1.E11/12 selector |
| `features/control/display/projector.view.ts` (+ `.test.ts`) | Create | S1.E13–E15 selector |
| `features/control/display/screen.view.ts` (+ `.test.ts`) | Create | S1.E17/18 selector |
| `features/control/audio/audio.view.ts` (+ `.test.ts`) | Create | S1.E21–E23 selectors |
| `features/control/environment/lights.view.ts` (+ `.test.ts`) | Create | S1.E31 selector |
| `features/control/environment/ac.view.ts` (+ `.test.ts`) | Create | S1.E34–E40 selector |
| `features/control/environment/sensors.view.ts` (+ `.test.ts`) | Create | S1.E41–E45 selector |
| `features/control/CardHeader.tsx` | Create | dot · title / state line · aside · padlock |
| `features/control/display/SourceTile.tsx`, `SourceTiles.tsx` | Create | S1.E11/E12 |
| `features/control/display/ProjectorCard.tsx` | Create | S1.E13–E16 |
| `features/control/display/ScreenCard.tsx` | Create | S1.E17/E18 |
| `features/control/audio/LevelCard.tsx` | Create | S1.E21/E22 |
| `features/control/audio/MuteAllBar.tsx` | Create | S1.E23 |
| `features/control/environment/LightsCard.tsx` | Create | S1.E31–E33 |
| `features/control/environment/AcCard.tsx` | Create | S1.E34–E40 |
| `features/control/environment/SensorsCard.tsx` | Create | S1.E41–E45 |
| `features/control/BottomNav.tsx` | Create | phone section bar |
| `features/control/ControlPage.tsx` | Replace | the S1 grid |
| `app/Header.tsx` | Modify | sticky header (D9) |
| `app/StatusIndicator.tsx` | Modify | S1.E4 → `/devices` (D14) |
| `docs/decisions/D-20-s1-height-budget.md` | Create | decision record for D8 / D16 |

## Tasks

### T1 — `warning` state tone (solid amber dot)
- [x] done

**Files:** `apps/kiosk/src/components/state-styles.ts`, `apps/kiosk/src/components/state-styles.test.ts`,
`apps/kiosk/src/app/dev/ComponentGallery.tsx`

**Context:** SPEC §3.4 and S1.E13 "Warming up / Cooling down (amber dot)", H14, S1.E23 muted "amber dot", S1.E41
"2 of 3 reporting (amber dot)". Decision D2. `Record<StateTone, …>` maps must stay exhaustive, so every map gets
the new key.

**Do:**
1. In `apps/kiosk/src/components/state-styles.ts` replace:
```ts
export type StateTone = "confirmed" | "selected" | "assumed" | "off" | "unknown" | "offline";
```
   with:
```ts
/**
 * `warning` is the solid amber dot SPEC uses outside the assumed ring: projector warming up /
 * cooling down (H14), "no change in draw" (H7b), audio muted (S1.E23), "2 of 3 reporting"
 * (S1.E41), screen moving. Callers pick it explicitly; `stateTone()` never returns it.
 */
export type StateTone = "confirmed" | "selected" | "assumed" | "warning" | "off" | "unknown" | "offline";
```
2. In `apps/kiosk/src/components/state-styles.ts` replace:
```ts
  assumed: "border-2 border-warn bg-transparent",
  off: "bg-text-3",
```
   with:
```ts
  assumed: "border-2 border-warn bg-transparent",
  warning: "bg-warn",
  off: "bg-text-3",
```
3. In `apps/kiosk/src/components/state-styles.ts` replace:
```ts
  assumed: "text-warn",
  off: "text-text-3",
  unknown: "text-text-3",
  offline: "text-danger",
};
```
   with:
```ts
  assumed: "text-warn",
  warning: "text-warn",
  off: "text-text-3",
  unknown: "text-text-3",
  offline: "text-danger",
};
```
4. In `apps/kiosk/src/components/state-styles.ts` replace:
```ts
  assumed: "dashed",
  off: "solid",
```
   with:
```ts
  assumed: "dashed",
  warning: "solid",
  off: "solid",
```
5. In `apps/kiosk/src/app/dev/ComponentGallery.tsx` replace:
```tsx
const TONES: StateTone[] = ["confirmed", "selected", "assumed", "off", "unknown", "offline"];
```
   with:
```tsx
const TONES: StateTone[] = ["confirmed", "selected", "assumed", "warning", "off", "unknown", "offline"];
```

**Test:** In `apps/kiosk/src/components/state-styles.test.ts` replace:
```ts
  it("offline is danger with a 40% danger border", () => {
```
   with:
```ts
  it("warning is a solid amber dot with warn text on a solid card", () => {
    expect(DOT_CLASS.warning).toBe("bg-warn");
    expect(TEXT_CLASS.warning).toBe("text-warn");
    expect(CARD_VARIANT_FOR_TONE.warning).toBe("solid");
  });
  it("offline is danger with a 40% danger border", () => {
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- state-styles` → all pass, including the new "warning" case.

**Commit:** `git commit -m "feat(kiosk): warning state tone for solid amber dots"`

### T2 — Card header line colours and the `muted` / `faint` value tones
- [x] done

**Files:** `apps/kiosk/src/components/state-styles.ts`, `apps/kiosk/src/components/state-styles.test.ts`

**Context:** Decision D3 (screenshot 01: confirmed header lines are grey text-2). S1.E13: standby wattage `3 W` in
`text-2`, unknown wattage `— W` in `text-3`.

**Do:**
1. In `apps/kiosk/src/components/state-styles.ts` replace:
```ts
/** Card border variants (SPEC §3.4 "Card border" column) and which tone uses which. */
```
   with:
```ts
/**
 * Card header state line (screenshot 01: "On · confirmed by draw", "Confirmed by the switch",
 * "Lowered" are text-2; SPEC §3.4 allows `accent` or `text-2` for confirmed). Others as TEXT_CLASS.
 */
export const HEADER_LINE_CLASS: Record<StateTone, string> = {
  ...TEXT_CLASS,
  confirmed: "text-text-2",
  selected: "text-text-2",
};

/** Card border variants (SPEC §3.4 "Card border" column) and which tone uses which. */
```
2. In `apps/kiosk/src/components/state-styles.ts` replace:
```ts
/** Sensor/metric value accents (S1.E44 "Detected", S1.E45 "Open", S2 power). */
export type ValueTone = "default" | "accent" | "warn" | "danger";
export const VALUE_TONE_CLASS: Record<ValueTone, string> = {
  default: "text-text-1",
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
};
```
   with:
```ts
/**
 * Value accents (S1.E44 "Detected", S1.E45 "Open", S2 power, S1.E13 wattage). `muted` = the
 * standby `3 W` in text-2; `faint` = an unknown `— W` in text-3.
 */
export type ValueTone = "default" | "accent" | "warn" | "danger" | "muted" | "faint";
export const VALUE_TONE_CLASS: Record<ValueTone, string> = {
  default: "text-text-1",
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-text-2",
  faint: "text-text-3",
};
```

**Test:**
1. In `apps/kiosk/src/components/state-styles.test.ts` replace:
```ts
  ACTIVE_CONTROL_CLASS, CARD_VARIANT_CLASS, CARD_VARIANT_FOR_TONE, DOT_CLASS, stateTone,
```
   with:
```ts
  ACTIVE_CONTROL_CLASS, CARD_VARIANT_CLASS, CARD_VARIANT_FOR_TONE, DOT_CLASS, HEADER_LINE_CLASS, stateTone,
```
2. In `apps/kiosk/src/components/state-styles.test.ts` replace:
```ts
  it("offline is danger with a 40% danger border", () => {
```
   with:
```ts
  it("card header lines: confirmed in text-2, the rest as the state text", () => {
    expect(HEADER_LINE_CLASS.confirmed).toBe("text-text-2");
    expect(HEADER_LINE_CLASS.assumed).toBe("text-warn");
    expect(HEADER_LINE_CLASS.offline).toBe("text-danger");
  });
  it("offline is danger with a 40% danger border", () => {
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- state-styles` → pass. The existing "never contains raw colour
values" case covers the new classes.

**Commit:** `git commit -m "feat(kiosk): header line colours and muted/faint value tones"`

### T3 — `text-value-word` token and `SensorTile` word values
- [x] done

**Files:** `apps/kiosk/src/styles/tokens.css`, `apps/kiosk/src/styles/token-names.ts`,
`apps/kiosk/src/components/SensorTile.tsx`

**Context:** Decision D16. S1.E44/E45 word values must fit four tiles (86px each) in a 400px column at 1280.
`token-names.test.ts` fails unless `token-names.ts` lists every `--text-*` token, so both files change together.

**Do:**
1. In `apps/kiosk/src/styles/tokens.css` replace:
```css
  --text-value: 24px;
  --text-value--line-height: 28px;
```
   with:
```css
  --text-value: 24px;
  --text-value--line-height: 28px;
  /* Word values in a sensor tile ("Detected", "Closed"): 4 tiles must fit a 400px column at 1280. */
  --text-value-word: 18px;
  --text-value-word--line-height: 28px;
```
2. In `apps/kiosk/src/styles/token-names.ts` replace:
```ts
  "wordmark", "clock", "date", "title", "section", "card-title", "caption", "button", "value",
  "sensor-label",
] as const;
```
   with:
```ts
  "wordmark", "clock", "date", "title", "section", "card-title", "caption", "button", "value",
  "value-word", "sensor-label",
] as const;
```
3. In `apps/kiosk/src/components/SensorTile.tsx` replace:
```tsx
  /** H10: e.g. "14 min ago". */
  staleAgo?: string | null;
  loading?: boolean;
}
```
   with:
```tsx
  /** H10: e.g. "14 min ago" (or "offline", H8). */
  staleAgo?: string | null;
  loading?: boolean;
  /** `false` for word values ("Detected", "Closed"): sans 18px so four tiles fit at 1280. */
  numeric?: boolean;
}
```
4. In `apps/kiosk/src/components/SensorTile.tsx` replace:
```tsx
export function SensorTile({ label, value, caption, tone = "default", staleAgo = null, loading = false }: SensorTileProps) {
```
   with:
```tsx
export function SensorTile({
  label, value, caption, tone = "default", staleAgo = null, loading = false, numeric = true,
}: SensorTileProps) {
```
5. In `apps/kiosk/src/components/SensorTile.tsx` replace:
```tsx
        <p className={cn("font-mono text-value font-semibold", staleAgo !== null ? STALE_TEXT_CLASS : VALUE_TONE_CLASS[tone])}>
```
   with:
```tsx
        <p
          className={cn(
            "font-semibold",
            numeric ? "font-mono text-value" : "font-sans text-value-word",
            staleAgo !== null ? STALE_TEXT_CLASS : VALUE_TONE_CLASS[tone],
          )}
        >
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- token-names` → pass. `pnpm --filter @eduscope/kiosk typecheck`
→ exit 0.

**Commit:** `git commit -m "feat(kiosk): value-word token for sensor word values"`

### T4 — Command sender: `supersede` for slider levels
- [x] done

**Files:** `apps/kiosk/src/data/commands/command-sender.ts`, `apps/kiosk/src/data/commands/command-sender.test.ts`,
`apps/kiosk/src/data/hooks.ts`

**Context:** Decision D4, SPEC §2.4 (throttled updates while dragging + the final value on release), H5 (taps are
still ignored while pending). The pending store's `add()` already replaces the entry for a key; the older
command's `command` events then match no entry and are ignored by `apply-event`.

**Do:**
1. In `apps/kiosk/src/data/commands/command-sender.ts` replace:
```ts
export type SendOutcome = "sent" | "ignored";
```
   with:
```ts
export type SendOutcome = "sent" | "ignored";

export interface SendOptions {
  /**
   * Slider levels (SPEC §2.4): a new value replaces the pending one instead of being ignored, so
   * the drag updates and the release value are never dropped. The older command's result is then
   * ignored (its entry is gone). Taps never set this (H5).
   */
  supersede?: boolean;
}
```
2. In `apps/kiosk/src/data/commands/command-sender.ts` replace:
```ts
  return async function send(key: ControlKey, body: CommandBody): Promise<SendOutcome> {
    if (deps.pending.isPending(key)) return "ignored"; // H5: repeat taps ignored
```
   with:
```ts
  return async function send(key: ControlKey, body: CommandBody, options: SendOptions = {}): Promise<SendOutcome> {
    if (options.supersede !== true && deps.pending.isPending(key)) return "ignored"; // H5: repeat taps ignored
```
3. In `apps/kiosk/src/data/hooks.ts` replace:
```ts
import { createCommandSender } from "./commands/command-sender";
```
   with:
```ts
import { createCommandSender, type SendOptions } from "./commands/command-sender";
```
4. In `apps/kiosk/src/data/hooks.ts` replace:
```ts
    (body: CommandBody) => {
      if (gate.reason === "locked") {
        unlock();
        return;
      }
      if (!gate.enabled) return;
      void sender(key, body);
    },
```
   with:
```ts
    (body: CommandBody, options?: SendOptions) => {
      if (gate.reason === "locked") {
        unlock();
        return;
      }
      if (!gate.enabled) return;
      void sender(key, body, options);
    },
```

**Test:** In `apps/kiosk/src/data/commands/command-sender.test.ts` replace:
```ts
  it("other keys stay usable while one is pending", async () => {
```
   with:
```ts
  it("supersede replaces the pending entry and sends (slider levels)", async () => {
    let n = 0;
    const pending = createPendingStore();
    const api = { sendCommand: vi.fn(async (request: CommandRequest) => accepted(request)) };
    const send = createCommandSender({
      api, pending, inlineErrors: createInlineErrorStore(), newId: () => `00000000-0000-4000-8000-00000000000${++n}`, now: () => 5,
    });
    await send("audio.mic", { kind: "audio.level", channel: "mic", level: 10, final: false }, { supersede: true });
    const outcome = await send("audio.mic", { kind: "audio.level", channel: "mic", level: 20, final: true }, { supersede: true });
    expect(outcome).toBe("sent");
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    expect(pending.entries.get().get("audio.mic")?.clientCmdId).toBe("00000000-0000-4000-8000-000000000002");
    // the first command's result no longer matches an entry
    expect(pending.remove("00000000-0000-4000-8000-000000000001")).toBeUndefined();
    expect(pending.isPending("audio.mic")).toBe(true);
  });

  it("other keys stay usable while one is pending", async () => {
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- command-sender` → 5 tests pass (the existing "ignores a repeat
tap while the key is pending" still passes: taps don't supersede).

**Commit:** `git commit -m "feat(kiosk): slider levels supersede the pending command"`

### T5 — `useViewOnly()` for padlocks
- [x] done

**Files:** `apps/kiosk/src/data/hooks.ts`

**Context:** H12, SPEC S1 view-only presentation, decision D11. Backlog M03-L5: the gate reports `locked` while the
session is still loading; padlocks must not flash, so they use this hook instead of `gate.reason`. Pure markup-level
hook over an existing query; no new logic to test.

**Do:**
1. In `apps/kiosk/src/data/hooks.ts` replace:
```ts
export function useSession() {
  return useQuery(sessionQuery(useApiClient())).data;
}
```
   with:
```ts
export function useSession() {
  return useQuery(sessionQuery(useApiClient())).data;
}

/** H12 padlocks: `true` only for a loaded `view` session (never while the session loads, M03-L5). */
export function useViewOnly(): boolean {
  return useSession()?.access === "view";
}
```

**Verify:** `pnpm --filter @eduscope/kiosk typecheck` → exit 0.

**Commit:** `git commit -m "feat(kiosk): useViewOnly for S1 padlocks"`

### T6 — Mock rules: what each S1 command changes (R2, R9, R3/R4, screen)
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/mock-rules.ts`, `apps/kiosk/src/data/adapters/mock/mock-rules.test.ts`

**Context:** M04 scope "extend FakeRoom so every command kind behaves plausibly". R2: IR success alone never moves
the projector state (the ramp in T11 does); the command status is `assumed`. R9 (decision D6). R3/R4/Q5: AC Power
on after a start sends the default setpoint frame; −/+ do nothing while off. Screen: `moving` first (T11 finishes
the travel). Source select (R10) and lights (R6) already behave.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
// The mock's own rough approximation of core-api's domain rules (never imported from
// apps/core-api). M02: every command lands immediately; M04 adds the R1 draw ramp etc.
```
   with:
```ts
// The mock's own rough approximation of core-api's domain rules (never imported from
// apps/core-api). Commands change state here; FakeRoom adds the timed parts (R1 draw ramp,
// screen travel, H7b) on top.
```
2. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
/** The resulting command status: IR-only targets can never be confirmed (R3). */
export function statusFor(body: CommandBody): "confirmed" | "assumed" {
  return body.kind === "ac.power" || body.kind === "ac.step" ? "assumed" : "confirmed";
}
```
   with:
```ts
/** The resulting command status: IR targets are never confirmed by the command (R2, R3). */
export function statusFor(body: CommandBody): "confirmed" | "assumed" {
  return body.kind === "ac.power" || body.kind === "ac.step" || body.kind === "projector.power" ? "assumed" : "confirmed";
}

/** AC Power on with no setpoint sent since start (R3 "Unknown"): this frame is sent [ASSUMED]. */
export const DEFAULT_AC_SETPOINT_C = 24;

function defaultSetpoint(available: readonly number[]): number | null {
  if (available.includes(DEFAULT_AC_SETPOINT_C)) return DEFAULT_AC_SETPOINT_C;
  return available[Math.floor(available.length / 2)] ?? null;
}
```
3. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
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
```
   with:
```ts
    case "projector.power":
      // R2: IR alone changes nothing but the feedback; the draw ramp (FakeRoom) moves the state.
      return {
        ...state,
        display: {
          ...display,
          projector: {
            ...display.projector,
            feedback: { last_ir: body.on ? "power_on" : "power_off", sent_at: ctx.at, phase: "waiting_for_draw" },
          },
        },
      };
```
4. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
        display: { ...display, screen: observe(display.screen, body.to === "raise" ? "raised" : "lowered", ctx) },
      };
```
   with:
```ts
        display: { ...display, screen: observe(display.screen, "moving", ctx) }, // FakeRoom finishes the travel
      };
```
5. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
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
```
   with:
```ts
    case "audio.mute_all": {
      // R9: mute saves each level and the mixer reads 0; unmute restores the saved levels.
      if (body.muted === (audio.muted_all.value === true)) return state;
      const { mic, pc } = audio.channels;
      const saved = audio.saved_levels;
      return {
        ...state,
        audio: {
          muted_all: observe(audio.muted_all, body.muted, ctx),
          channels: body.muted
            ? { mic: observe(mic, 0, ctx), pc: observe(pc, 0, ctx) }
            : { mic: observe(mic, saved.mic ?? mic.value ?? 0, ctx), pc: observe(pc, saved.pc ?? pc.value ?? 0, ctx) },
          saved_levels: body.muted ? { mic: mic.value, pc: pc.value } : { mic: null, pc: null },
        },
      };
    }
```
6. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
    case "ac.power":
      return {
        ...state,
        environment: {
          ...environment,
          ac: { ...environment.ac, power: observe(environment.ac.power, body.on ? "on" : "off", ctx, "assumed", "ir") },
        },
      };
    case "ac.step": {
```
   with:
```ts
    case "ac.power": {
      const { ac } = environment;
      // Power on sends the frame for the current setpoint (S1.E35); after a start that is the default.
      const setpoint = body.on ? (ac.setpoint_c.value ?? defaultSetpoint(ac.available_setpoints)) : ac.setpoint_c.value;
      return {
        ...state,
        environment: {
          ...environment,
          ac: {
            ...ac,
            power: observe(ac.power, body.on ? "on" : "off", ctx, "assumed", "ir"),
            setpoint_c: body.on && setpoint !== null ? observe(ac.setpoint_c, setpoint, ctx, "assumed", "ir") : ac.setpoint_c,
          },
        },
      };
    }
    case "ac.step": {
      if (environment.ac.power.value !== "on") return state; // Q5: core-api rejects −/+ while off
```

**Test:** In `apps/kiosk/src/data/adapters/mock/mock-rules.test.ts` replace:
```ts
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
```
   with:
```ts
  it("projector.power only records the IR and waits for draw (R2)", () => {
    const next = applyCommandToState(roomState(), { kind: "projector.power", on: false }, ctx);
    expect(next.display.projector.state.value).toBe("running");
    expect(next.display.projector.feedback).toEqual({ last_ir: "power_off", sent_at: ctx.at, phase: "waiting_for_draw" });
    expect(statusFor({ kind: "projector.power", on: false })).toBe("assumed");
  });

  it("source.select is exclusive and confirmed (R10)", () => {
    const next = applyCommandToState(roomState(), { kind: "source.select", input: "smart_board" }, ctx);
    expect(next.display.source).toMatchObject({ value: "smart_board", confidence: "confirmed" });
  });

  it("screen.move starts moving (FakeRoom finishes the travel)", () => {
    const next = applyCommandToState(roomState(), { kind: "screen.move", to: "raise" }, ctx);
    expect(next.display.screen.value).toBe("moving");
  });

  it("mute zeroes and saves the levels; unmute restores them (R9)", () => {
    const muted = applyCommandToState(roomState(), { kind: "audio.mute_all", muted: true }, ctx);
    expect(muted.audio.channels.mic.value).toBe(0);
    expect(muted.audio.channels.pc.value).toBe(0);
    expect(muted.audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    const again = applyCommandToState(muted, { kind: "audio.mute_all", muted: true }, ctx);
    expect(again.audio.saved_levels).toEqual({ mic: 62, pc: 38 }); // a second mute keeps the saved levels
    const unmuted = applyCommandToState(muted, { kind: "audio.mute_all", muted: false }, ctx);
    expect(unmuted.audio.channels.mic.value).toBe(62);
    expect(unmuted.audio.channels.pc.value).toBe(38);
    expect(unmuted.audio.saved_levels).toEqual({ mic: null, pc: null });
  });

  it("ac.power on after a restart sends the default setpoint; ac.step is ignored while off (Q5)", () => {
    const base = roomState();
    const unknown = { value: null, confidence: "unknown" as const, source: "none" as const, updated_at: null, stale: false, changed_by: null };
    const restarted = { ...base, environment: { ...base.environment, ac: { ...base.environment.ac, power: unknown, setpoint_c: unknown } } };
    const on = applyCommandToState(restarted, { kind: "ac.power", on: true }, ctx);
    expect(on.environment.ac.power).toMatchObject({ value: "on", confidence: "assumed" });
    expect(on.environment.ac.setpoint_c).toMatchObject({ value: 24, confidence: "assumed" });
    const off = applyCommandToState(on, { kind: "ac.power", on: false }, ctx);
    expect(applyCommandToState(off, { kind: "ac.step", direction: "up" }, ctx).environment.ac.setpoint_c.value).toBe(24);
  });
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- mock-rules fake-room` → all pass (the existing "audio.mute_all
saves and clears the levels (R9)" case still passes).

**Commit:** `git commit -m "feat(kiosk): mock commands follow R2, R9, R3/R4 and screen travel"`

### T7 — Mock rules: R1 projector draw ramp
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/mock-rules.ts`, `apps/kiosk/src/data/adapters/mock/mock-ramp.test.ts`

**Context:** R1 (>50 W running, <5 W standby, 5–50 W warming/cooling by direction), R2, H7b `waiting_for_draw`,
H14, R11 (interlock holds while the lamp cools, decision D13). Pure functions; FakeRoom drives them with timers in
T11. Values: standby 3 W, running 287 W (screenshot 01), warm-up 6→49 W, cool-down 45→6 W.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
import type { ChangedBy, CommandBody, Confidence, Observed, RoomState, Source } from "@eduscope/contracts";
```
   with:
```ts
import type {
  ChangedBy, CommandBody, Confidence, Observed, ProjectorFeedback, ProjectorState, RoomState, Source,
} from "@eduscope/contracts";
```
2. Append to `apps/kiosk/src/data/adapters/mock/mock-rules.ts`:
```ts

// ── R1 projector draw ramp ─────────────────────────────────────────────────────────────

export const STANDBY_WATTS = 3;
export const RUNNING_WATTS = 287;
const WARM_FROM_W = 6;
const WARM_TO_W = 49;
const COOL_FROM_W = 45;
const COOL_TO_W = 6;

/** Real-time lengths of the ramp; FakeRoom multiplies them by its time scale. */
export interface RampTimes {
  /** IR sent → the draw starts to move ("waiting for draw", H7b). */
  irToDrawMs: number;
  warmUpMs: number;
  coolDownMs: number;
}

export interface ProjectorStep {
  watts: number;
  state: ProjectorState;
  phase: ProjectorFeedback["phase"];
  /** The ramp has reached running / standby. */
  done: boolean;
}

/** Where the R1 ramp is `elapsedMs` after the IR command (>50 W running, <5 W standby). */
export function projectorRamp(on: boolean, elapsedMs: number, times: RampTimes): ProjectorStep {
  if (elapsedMs < times.irToDrawMs) {
    return on
      ? { watts: STANDBY_WATTS, state: "standby", phase: "waiting_for_draw", done: false }
      : { watts: RUNNING_WATTS, state: "running", phase: "waiting_for_draw", done: false };
  }
  const into = elapsedMs - times.irToDrawMs;
  if (on) {
    if (into >= times.warmUpMs) return { watts: RUNNING_WATTS, state: "running", phase: "idle", done: true };
    const watts = Math.round(WARM_FROM_W + ((WARM_TO_W - WARM_FROM_W) * into) / times.warmUpMs);
    return { watts, state: "warming_up", phase: "idle", done: false };
  }
  if (into >= times.coolDownMs) return { watts: STANDBY_WATTS, state: "standby", phase: "idle", done: true };
  const watts = Math.round(COOL_FROM_W - ((COOL_FROM_W - COOL_TO_W) * into) / times.coolDownMs);
  return { watts, state: "cooling_down", phase: "idle", done: false };
}

/** Writes a ramp step: state + live power confirmed by draw; interlock holds while cooling (R11). */
export function applyProjectorStep(state: RoomState, step: ProjectorStep, at: string): RoomState {
  const { projector } = state.display;
  const reading = projector.power.value ?? { watts: 0, volts: 231, kwh_today: 0, rating_a: 13, at };
  return {
    ...state,
    display: {
      ...state.display,
      projector: {
        ...projector,
        state: { ...projector.state, value: step.state, confidence: "confirmed", source: "power_meter", updated_at: at, stale: false },
        power: {
          ...projector.power,
          value: { ...reading, watts: step.watts, at },
          confidence: "confirmed",
          source: "power_meter",
          updated_at: at,
          stale: false,
        },
        feedback: { ...projector.feedback, phase: step.phase },
      },
    },
    interlock: { ...state.interlock, status: step.state === "cooling_down" ? "holding" : "armed" },
  };
}

/** H7b phase only (no change in draw after 90 s, or IR that the draw already agrees with). */
export function setProjectorPhase(state: RoomState, phase: ProjectorFeedback["phase"]): RoomState {
  const { projector } = state.display;
  return { ...state, display: { ...state.display, projector: { ...projector, feedback: { ...projector.feedback, phase } } } };
}
```

**Test:** Create `apps/kiosk/src/data/adapters/mock/mock-ramp.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { applyProjectorStep, projectorRamp, RUNNING_WATTS, setProjectorPhase, STANDBY_WATTS } from "./mock-rules";

const AT = "2026-10-05T10:43:00Z";
const times = { irToDrawMs: 300, warmUpMs: 3000, coolDownMs: 6000 };

describe("R1 projector ramp (mock)", () => {
  it("on: waiting for draw, warming up between 5 and 50 W, then running", () => {
    expect(projectorRamp(true, 0, times)).toEqual({ watts: STANDBY_WATTS, state: "standby", phase: "waiting_for_draw", done: false });
    const warming = projectorRamp(true, 1800, times);
    expect(warming.state).toBe("warming_up");
    expect(warming.watts).toBeGreaterThan(5);
    expect(warming.watts).toBeLessThan(50);
    expect(warming.phase).toBe("idle");
    expect(projectorRamp(true, 3300, times)).toEqual({ watts: RUNNING_WATTS, state: "running", phase: "idle", done: true });
  });

  it("off: cooling down, then standby; the interlock holds while cooling (R11)", () => {
    const cooling = projectorRamp(false, 1000, times);
    expect(cooling.state).toBe("cooling_down");
    const held = applyProjectorStep(roomState(), cooling, AT);
    expect(held.interlock.status).toBe("holding");
    expect(held.display.projector.power.value?.watts).toBe(cooling.watts);
    expect(held.display.projector.state).toMatchObject({ value: "cooling_down", confidence: "confirmed", source: "power_meter" });
    const done = projectorRamp(false, 6300, times);
    expect(done).toEqual({ watts: STANDBY_WATTS, state: "standby", phase: "idle", done: true });
    expect(applyProjectorStep(held, done, AT).interlock.status).toBe("armed");
  });

  it("setProjectorPhase changes only the H7b phase", () => {
    const next = setProjectorPhase(roomState(), "no_change");
    expect(next.display.projector.feedback).toEqual({ ...roomState().display.projector.feedback, phase: "no_change" });
    expect(next.display.projector.state.value).toBe("running");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- mock-ramp` → 3 tests pass.

**Commit:** `git commit -m "feat(kiosk): mock R1 projector draw ramp"`

### T8 — Mock rules: derived room status and reporting count
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/mock-rules.ts`, `apps/kiosk/src/data/adapters/mock/mock-derived.test.ts`

**Context:** S1.E4 normal/degraded/fault, S1.E41 (counts devices, not tiles), H9, H10, R13. ARCHITECTURE §6.4:
core-api recomputes `status` and `sensors.reporting` on every change; the mock does the same in T10.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/mock-rules.ts` replace:
```ts
  ChangedBy, CommandBody, Confidence, Observed, ProjectorFeedback, ProjectorState, RoomState, Source,
```
   with:
```ts
  ChangedBy, CommandBody, Confidence, Observed, ProjectorFeedback, ProjectorState, RoomState, RoomStatus, Source,
```
2. Append to `apps/kiosk/src/data/adapters/mock/mock-rules.ts`:
```ts

// ── Derived fields (core-api recomputes these on every change, ARCHITECTURE §6.4) ──────

/** S1.E41: sensor devices that are online with a fresh, non-null reading on every tile. */
export function deriveReporting(state: RoomState): { count: number; of: number } {
  const { temperature, humidity, occupancy, contact } = state.environment.sensors;
  const readings = [temperature, humidity, occupancy, contact];
  const sensors = state.devices.filter((device) => device.kind === "sensor");
  const count = sensors.filter((device) => {
    if (device.online.value === false) return false;
    const own = readings.filter((reading) => reading.node === device.hw_ref);
    return own.length > 0 && own.every((reading) => !reading.stale && reading.value !== null);
  }).length;
  return { count, of: sensors.length };
}

/** S1.E4 (approximation of core-api `status.ts`): fault > degraded > normal. */
export function deriveRoomStatus(state: RoomState): RoomStatus {
  if (state.zigbee.coordinator.status === "offline") return { level: "fault", text: "Coordinator offline" };
  const offline = state.devices.filter((device) => device.online.value === false);
  const first = offline[0];
  if (first !== undefined) {
    return { level: "degraded", text: offline.length === 1 ? `${first.name} offline` : `${offline.length} devices offline` };
  }
  const { count, of } = state.environment.sensors.reporting;
  if (count < of) return { level: "degraded", text: "Sensor not reporting" };
  return { level: "normal", text: "All systems normal" };
}

/** Recomputes `sensors.reporting` then `room.status`. */
export function withDerived(state: RoomState): RoomState {
  const reporting = deriveReporting(state);
  const withReporting: RoomState = {
    ...state,
    environment: { ...state.environment, sensors: { ...state.environment.sensors, reporting } },
  };
  return { ...withReporting, room: { ...withReporting.room, status: deriveRoomStatus(withReporting) } };
}
```

**Test:** Create `apps/kiosk/src/data/adapters/mock/mock-derived.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { deriveReporting, deriveRoomStatus, withDerived } from "./mock-rules";

describe("mock derived fields", () => {
  it("reporting counts sensor devices, not tiles; stale or offline drops the count (S1.E41)", () => {
    const base = roomState();
    expect(deriveReporting(base)).toEqual({ count: 3, of: 3 });
    const { sensors } = base.environment;
    const stale = { ...base, environment: { ...base.environment, sensors: { ...sensors, humidity: { ...sensors.humidity, stale: true } } } };
    expect(deriveReporting(stale)).toEqual({ count: 2, of: 3 });
    const devices = base.devices.map((d) => (d.id === "door" ? { ...d, online: { ...d.online, value: false } } : d));
    expect(deriveReporting({ ...base, devices })).toEqual({ count: 2, of: 3 });
  });

  it("room status: coordinator offline is a fault, offline device or missing sensor degrades (S1.E4)", () => {
    const base = roomState();
    expect(deriveRoomStatus(base)).toEqual({ level: "normal", text: "All systems normal" });
    const coordinator = { ...base.zigbee.coordinator, status: "offline" as const };
    expect(deriveRoomStatus({ ...base, zigbee: { ...base.zigbee, coordinator } })).toEqual({ level: "fault", text: "Coordinator offline" });
    const devices = base.devices.map((d) => (d.id === "lights" ? { ...d, online: { ...d.online, value: false } } : d));
    expect(deriveRoomStatus({ ...base, devices })).toEqual({ level: "degraded", text: "Lighting switch offline" });
    const { sensors } = base.environment;
    const stale = { ...base, environment: { ...base.environment, sensors: { ...sensors, contact: { ...sensors.contact, stale: true } } } };
    expect(withDerived(stale).room.status).toEqual({ level: "degraded", text: "Sensor not reporting" });
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- mock-derived` → 2 tests pass.

**Commit:** `git commit -m "feat(kiosk): mock derives room status and sensors reporting"`

### T9 — `?time-scale=` for the mock
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/time-scale.ts`, `apps/kiosk/src/data/adapters/mock/time-scale.test.ts`

**Context:** Decision D15 (milestone: "R1 draw ramp with `FAKE_TIME_SCALE`"). Same shape as M03's `?idle-scale`
(`features/kiosk/kiosk-params.ts`). `FakeRoom` gets the `timeScale` option in T11, which also wires this reader
into `mock-client.ts`; this task only adds the reader.

**Do:**
1. Create `apps/kiosk/src/data/adapters/mock/time-scale.ts`:
```ts
import { z } from "zod";

const TimeScale = z.coerce.number().positive().max(1);

/**
 * `?time-scale=0.1` speeds up the mock's timed behaviour (projector ramp, H7b 90 s, screen travel)
 * in dev builds; the hw-service fake has `HW_FAKE_TIME_SCALE` for the same purpose. Invalid → 1.
 */
export function readTimeScale(search: string, dev: boolean): number {
  if (!dev) return 1;
  const raw = new URLSearchParams(search).get("time-scale");
  if (raw === null) return 1;
  const parsed = TimeScale.safeParse(raw);
  return parsed.success ? parsed.data : 1;
}
```

**Test:** Create `apps/kiosk/src/data/adapters/mock/time-scale.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readTimeScale } from "./time-scale";

describe("readTimeScale", () => {
  it("reads ?time-scale in dev builds", () => {
    expect(readTimeScale("?mock-panel&time-scale=0.1", true)).toBe(0.1);
  });
  it("is 1 without the parameter, in production, or when invalid", () => {
    expect(readTimeScale("?mock-panel", true)).toBe(1);
    expect(readTimeScale("?time-scale=0.1", false)).toBe(1);
    expect(readTimeScale("?time-scale=0", true)).toBe(1);
    expect(readTimeScale("?time-scale=2", true)).toBe(1);
    expect(readTimeScale("?time-scale=fast", true)).toBe(1);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- time-scale` → 2 tests pass.

**Commit:** `git commit -m "feat(kiosk): time-scale reader for the mock"`

### T10 — FakeRoom: commands land in arrival order; every change re-derives status
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room-order.test.ts`

**Context:** Decision D7 (unmute, then level, must land in that order; today each command gets its own random
latency, so a fast level can land before a slow unmute and be overwritten by the restore). ARCHITECTURE §6.5
"commands are dispatched in arrival order". `commit()` now runs `withDerived` (T8), so S1.E4 and S1.E41 follow
every change. `sendCommand` queues the command **before** awaiting the HTTP-ack latency; the 202 still resolves
after that latency, and the existing tests keep passing because the timings are unchanged for one command.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import { applyCommandToState, describeCommand, observe, statusFor } from "./mock-rules";
```
   with:
```ts
import { applyCommandToState, describeCommand, observe, statusFor, withDerived } from "./mock-rules";
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly random: () => number;
```
   with:
```ts
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** Epoch ms at which the last accepted command lands: commands land in arrival order. */
  private lastDueAt = 0;
  private readonly random: () => number;
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    const parsed = CommandRequest.parse(request);
    await this.delay();
    const command: Command = {
```
   with:
```ts
    const parsed = CommandRequest.parse(request);
    const ackMs = this.latency();
    const command: Command = {
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    this.process(command);
    return command;
```
   with:
```ts
    this.process(command, ackMs); // queued now, so commands keep their arrival order (unmute → level)
    await this.wait(ackMs);
    return command;
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
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
```
   with:
```ts
  private process(command: Command, ackMs: number): void {
    if (this.timeoutNext) {
      this.timeoutNext = false;
      setTimeout(() => this.emitAll({ type: "command", command: { ...command, status: "timed_out" } }), ackMs + MOCK_COMMAND_TIMEOUT_MS);
      return;
    }
    if (this.failNext) {
      this.failNext = false;
      setTimeout(
        () => this.emitAll({ type: "command", command: { ...command, status: "failed", error: "Command failed" } }),
        ackMs + this.latency(),
      );
      return;
    }
    this.inOrder(() => {
      this.emitAll({ type: "command", command: { ...command, status: "sent" } });
      const by = command.issued_by?.label ?? "schedule";
      this.commit(applyCommandToState(this.state, command.body, { at: this.iso(), by }));
      this.emitAll({ type: "command", command: { ...command, status: statusFor(command.body) } });
      if (command.body.kind !== "audio.level" || command.body.final) {
        this.emitAll({ type: "activity", text: describeCommand(command.body), by, public_id: command.issued_by?.public_id ?? null });
      }
    }, ackMs + this.latency());
  }

  /** Runs `fn` after `delayMs`, but never before an earlier command (core-api dispatches in arrival order). */
  private inOrder(fn: () => void, delayMs: number): void {
    const due = Math.max(this.now() + delayMs, this.lastDueAt + 1);
    this.lastDueAt = due;
    setTimeout(fn, due - this.now());
  }
```
6. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  /** Bump rev and push `state`. Works while dropped: the next snapshot carries the change. */
  private commit(next: RoomState): void {
    this.state = { ...next, rev: this.state.rev + 1 };
```
   with:
```ts
  /** Derive, bump rev and push `state`. Works while dropped: the next snapshot carries the change. */
  private commit(next: RoomState): void {
    this.state = { ...withDerived(next), rev: this.state.rev + 1 };
```
7. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latency()));
  }
```
   with:
```ts
  private delay(): Promise<void> {
    return this.wait(this.latency());
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
```

**Test:** Create `apps/kiosk/src/data/adapters/mock/fake-room-order.test.ts`:
```ts
import type { ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS } from "./fake-room";

let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

describe("FakeRoom command order", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("commands land in arrival order even with random latency (unmute, then level)", async () => {
    // connect 600 · mute 200+200 · unmute 600+600 (slow) · level 200+200 (fast)
    const draws = [1, 0, 0, 1, 1, 0, 0];
    const room = new FakeRoom({ random: () => draws.shift() ?? 1 });
    const events: ServerEvent[] = [];
    room.connect("phone", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MAX_MS);
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "audio.mute_all", muted: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "audio.mute_all", muted: false } }); // slow
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "audio.level", channel: "mic", level: 10, final: true } }); // fast
    await vi.advanceTimersByTimeAsync(4 * MOCK_LATENCY_MAX_MS);
    const state = events.findLast((e) => e.type === "state");
    if (state?.type !== "state") throw new Error("no state");
    expect(state.state.audio.muted_all.value).toBe(false);
    expect(state.state.audio.channels.mic.value).toBe(10);
    expect(state.state.audio.channels.pc.value).toBe(38);
  });

  it("every change re-derives the room status (S1.E4)", () => {
    const room = new FakeRoom({ random: () => 1 });
    const events: ServerEvent[] = [];
    room.connect("phone", { onOpen: vi.fn(), onEvent: (e: ServerEvent) => events.push(e), onClose: vi.fn() });
    vi.advanceTimersByTime(MOCK_LATENCY_MAX_MS);
    room.toggleDeviceOffline("audio");
    const state = events.at(-1);
    if (state?.type !== "state") throw new Error("no state");
    expect(state.state.room.status).toEqual({ level: "degraded", text: "Audio mixer offline" });
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- fake-room` → all FakeRoom tests pass, old and new. (Check that the
order test is real: temporarily change `Math.max(this.now() + delayMs, this.lastDueAt + 1)` to `this.now() + delayMs`
→ the order test fails; change it back.)

**Commit:** `git commit -m "feat(kiosk): mock lands commands in arrival order and derives status"`

### T11 — FakeRoom: projector draw ramp, H7b and screen travel (time-scaled)
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/mock-client.ts`,
`apps/kiosk/src/data/adapters/mock/fake-room-timed.test.ts`

**Context:** R1/R2, H7b (waiting → "no change in draw" after 90 s), H14, H15/R11, S1.E17 "Moving…", decision D15.
A new projector command cancels the running ramp. IR that the draw already agrees with (Power on while running,
Power off while standby) only resets the phase to `idle`.

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import {
  ClientSession, Command, CommandRequest, LoginRequest, RoomState, ServerEvent, type ClientLabel, type ClientType,
  type LoginResult,
} from "@eduscope/contracts";
```
   with:
```ts
import {
  ClientSession, Command, CommandRequest, LoginRequest, RoomState, ServerEvent, type ChangedBy, type ClientLabel,
  type ClientType, type CommandBody, type LoginResult,
} from "@eduscope/contracts";
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
import { applyCommandToState, describeCommand, observe, statusFor, withDerived } from "./mock-rules";
```
   with:
```ts
import {
  applyCommandToState, applyProjectorStep, describeCommand, observe, projectorRamp, setProjectorPhase, statusFor,
  withDerived, type RampTimes,
} from "./mock-rules";
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
/** SPEC §2.3 session lengths, shown in `expires_at` only (the mock never expires on its own). */
```
   with:
```ts
/** Timed behaviour at time scale 1 (`?time-scale=` shortens it). R1 ramp, H7b, screen travel. */
export const MOCK_IR_TO_DRAW_MS = 3_000;
export const MOCK_WARM_UP_MS = 30_000;
export const MOCK_COOL_DOWN_MS = 60_000;
/** H7b: "no change in draw" after 90 s. */
export const MOCK_NO_DRAW_CHANGE_MS = 90_000;
/** Live wattage update while the draw moves. */
export const MOCK_POWER_TICK_MS = 1_000;
export const MOCK_SCREEN_TRAVEL_MS = 8_000;
/** SPEC §2.3 session lengths, shown in `expires_at` only (the mock never expires on its own). */
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  random?: () => number;
  now?: () => number;
}
```
   with:
```ts
  random?: () => number;
  now?: () => number;
  /** Multiplies every timed behaviour (1 = real time). Latency and timeouts are not scaled. */
  timeScale?: number;
}
```
5. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private lastDueAt = 0;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(options: FakeRoomOptions = {}) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
```
   with:
```ts
  private lastDueAt = 0;
  private projectorTimer: ReturnType<typeof setTimeout> | null = null;
  private screenTimer: ReturnType<typeof setTimeout> | null = null;
  private noDrawChangeNext = false;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly timeScale: number;

  constructor(options: FakeRoomOptions = {}) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.timeScale = options.timeScale ?? 1;
```
6. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  /** H8: flip one device's online flag; the room status follows. */
```
   with:
```ts
  /** H7b: the next projector Power on/off leaves the draw unchanged. */
  noDrawChangeNextCommand(): void {
    this.noDrawChangeNext = true;
  }

  /** H8: flip one device's online flag; the room status follows. */
```
7. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
      this.commit(applyCommandToState(this.state, command.body, { at: this.iso(), by }));
      this.emitAll({ type: "command", command: { ...command, status: statusFor(command.body) } });
```
   with:
```ts
      this.commit(applyCommandToState(this.state, command.body, { at: this.iso(), by }));
      this.startTimedEffects(command.body, by);
      this.emitAll({ type: "command", command: { ...command, status: statusFor(command.body) } });
```
8. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
    this.lastDueAt = due;
    setTimeout(fn, due - this.now());
  }
```
   with:
```ts
    this.lastDueAt = due;
    setTimeout(fn, due - this.now());
  }

  /** The parts of a command that take time: the R1 draw ramp (+ H7b) and the screen travel. */
  private startTimedEffects(body: CommandBody, by: ChangedBy): void {
    if (body.kind === "projector.power") this.startProjectorRamp(body.on);
    if (body.kind === "screen.move") {
      if (this.screenTimer !== null) clearTimeout(this.screenTimer);
      this.screenTimer = setTimeout(() => {
        this.screenTimer = null;
        const to = body.to === "raise" ? "raised" : "lowered";
        this.commit({ ...this.state, display: { ...this.state.display, screen: observe(this.state.display.screen, to, { at: this.iso(), by }) } });
      }, this.scaled(MOCK_SCREEN_TRAVEL_MS));
    }
  }

  private startProjectorRamp(on: boolean): void {
    if (this.projectorTimer !== null) clearTimeout(this.projectorTimer);
    this.projectorTimer = null;
    const current = this.state.display.projector.state.value;
    if ((on && current === "running") || (!on && current === "standby")) {
      this.commit(setProjectorPhase(this.state, "idle")); // the draw already agrees
      return;
    }
    if (this.noDrawChangeNext) {
      this.noDrawChangeNext = false;
      this.projectorTimer = setTimeout(() => {
        this.projectorTimer = null;
        this.commit(setProjectorPhase(this.state, "no_change"));
      }, this.scaled(MOCK_NO_DRAW_CHANGE_MS));
      return;
    }
    const startedAt = this.now();
    const times: RampTimes = {
      irToDrawMs: this.scaled(MOCK_IR_TO_DRAW_MS),
      warmUpMs: this.scaled(MOCK_WARM_UP_MS),
      coolDownMs: this.scaled(MOCK_COOL_DOWN_MS),
    };
    const tick = (): void => {
      const step = projectorRamp(on, this.now() - startedAt, times);
      if (step.phase !== "waiting_for_draw") this.commit(applyProjectorStep(this.state, step, this.iso()));
      this.projectorTimer = step.done ? null : setTimeout(tick, this.scaled(MOCK_POWER_TICK_MS));
    };
    this.projectorTimer = setTimeout(tick, this.scaled(MOCK_POWER_TICK_MS));
  }

  private scaled(ms: number): number {
    return Math.max(50, Math.round(ms * this.timeScale));
  }
```
9. Replace the whole file `apps/kiosk/src/data/adapters/mock/mock-client.ts` with:
```ts
import type { ApiClient } from "@/data/api-client";
import { FakeRoom } from "./fake-room";
import { readTimeScale } from "./time-scale";

/** The one FakeRoom of this page; the mock panel drives it directly. */
export const fakeRoom = new FakeRoom({ timeScale: readTimeScale(window.location.search, import.meta.env.DEV) });

export function createMockApiClient(room: FakeRoom = fakeRoom): ApiClient {
  return {
    getSession: () => room.getSession(),
    login: (request) => room.login(request),
    lock: () => room.lock(),
    getState: () => room.getState(),
    sendCommand: (request) => room.sendCommand(request),
    connect: (label, handlers) => room.connect(label, handlers),
  };
}
```

**Test:** Create `apps/kiosk/src/data/adapters/mock/fake-room-timed.test.ts`:
```ts
import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeRoom, MOCK_COOL_DOWN_MS, MOCK_IR_TO_DRAW_MS, MOCK_LATENCY_MAX_MS, MOCK_NO_DRAW_CHANGE_MS, MOCK_SCREEN_TRAVEL_MS,
  MOCK_WARM_UP_MS,
} from "./fake-room";

// Time scale 0.1, latency 600 ms (random = 1).
const SCALE = 0.1;
let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function connected() {
  const room = new FakeRoom({ random: () => 1, timeScale: SCALE });
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

describe("FakeRoom timed behaviour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("projector off: waiting for draw → cooling down (interlock holding) → standby (R1, H7b, H14, R11)", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: false } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    expect(last().display.projector.feedback.phase).toBe("waiting_for_draw");
    expect(last().display.projector.state.value).toBe("running");
    await vi.advanceTimersByTimeAsync(MOCK_IR_TO_DRAW_MS * SCALE + 1000 * SCALE);
    expect(last().display.projector.state.value).toBe("cooling_down");
    expect(last().interlock.status).toBe("holding");
    await vi.advanceTimersByTimeAsync(MOCK_COOL_DOWN_MS * SCALE + 1000 * SCALE);
    expect(last().display.projector.state.value).toBe("standby");
    expect(last().display.projector.power.value?.watts).toBe(3);
    expect(last().interlock.status).toBe("armed");
  });

  it("projector on from standby warms up, then runs at 287 W", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: false } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS + (MOCK_IR_TO_DRAW_MS + MOCK_COOL_DOWN_MS) * SCALE + 200);
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS + MOCK_IR_TO_DRAW_MS * SCALE + 200);
    expect(last().display.projector.state.value).toBe("warming_up");
    await vi.advanceTimersByTimeAsync(MOCK_WARM_UP_MS * SCALE);
    expect(last().display.projector.state.value).toBe("running");
    expect(last().display.projector.power.value?.watts).toBe(287);
  });

  it("no draw change next: the phase turns no_change after 90 s scaled (H7b)", async () => {
    const { room, last } = connected();
    room.noDrawChangeNextCommand();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: false } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS + MOCK_NO_DRAW_CHANGE_MS * SCALE - 100);
    expect(last().display.projector.feedback.phase).toBe("waiting_for_draw");
    await vi.advanceTimersByTimeAsync(200);
    expect(last().display.projector.feedback.phase).toBe("no_change");
    expect(last().display.projector.state.value).toBe("running");
  });

  it("power on while already running needs no draw change", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "projector.power", on: true } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    expect(last().display.projector.feedback.phase).toBe("idle");
  });

  it("screen moves, then arrives", async () => {
    const { room, last } = connected();
    void room.sendCommand({ client_cmd_id: nextId(), body: { kind: "screen.move", to: "raise" } });
    await vi.advanceTimersByTimeAsync(2 * MOCK_LATENCY_MAX_MS);
    expect(last().display.screen.value).toBe("moving");
    await vi.advanceTimersByTimeAsync(MOCK_SCREEN_TRAVEL_MS * SCALE);
    expect(last().display.screen.value).toBe("raised");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- fake-room` → all pass. `pnpm --filter @eduscope/kiosk typecheck` →
exit 0 (`mock-client.ts` reads `window` only in the browser; no test imports it).

**Commit:** `git commit -m "feat(kiosk): mock projector ramp, H7b and screen travel with time scale"`

### T12 — FakeRoom: panel actions for the S1 hidden states
- [x] done

**Files:** `apps/kiosk/src/data/adapters/mock/fake-room.ts`, `apps/kiosk/src/data/adapters/mock/fake-room-panel.test.ts`

**Context:** M04 scope "panel buttons for each S1 hidden state". H8 (projector meter, screen, HDMI switch, lights,
audio — all through `toggleDeviceOffline`), H9 (coordinator: every `transport: "zigbee"` device + the coordinator
device go offline; the ZS06 is Zigbee in the fixture, so H25 follows, `[ASSUMED]` Q4), H25 (blaster), H10
(climate 14 min old), H11 (door never reported), S1.E45 door Open, S1.E11 "Selected, assumed", SPEC §2.4 other
client moves PC audio, S1.E17 Unknown, R3 (decision D5).

**Do:**
1. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  type ClientType, type CommandBody, type LoginResult,
```
   with:
```ts
  type ClientType, type CommandBody, type Device, type LoginResult,
```
2. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
export const MOCK_SCREEN_TRAVEL_MS = 8_000;
```
   with:
```ts
export const MOCK_SCREEN_TRAVEL_MS = 8_000;
/** "Toggle climate stale" backdates the reading by this much (H10 "· 14 min ago"). */
export const MOCK_STALE_AGE_MS = 14 * 60_000;
```
3. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
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
```
   with:
```ts
  /**
   * H8: flip one device's online flag; status and sensor count follow. "projector_socket" is the
   * S1.E13 power meter; "ir_blaster" is H25 (its `ir_blaster.online` follows).
   */
  toggleDeviceOffline(deviceId: string): void {
    const online = this.state.devices.find((device) => device.id === deviceId)?.online.value !== true;
    this.commit(this.withDevicesOnline((device) => device.id === deviceId, online));
  }

  /** H9: the coordinator and every Zigbee device go offline (or all come back). */
  toggleCoordinatorOffline(): void {
    const { coordinator } = this.state.zigbee;
    const online = coordinator.status === "offline";
    const next = this.withDevicesOnline((device) => device.kind === "coordinator" || device.transport === "zigbee", online);
    this.commit({ ...next, zigbee: { ...next.zigbee, coordinator: { ...coordinator, status: online ? "online" : "offline" } } });
  }

  /** S1.E11 "Selected, assumed": the HDMI switch stops confirming the selected input. */
  sourceAssumed(): void {
    const { display } = this.state;
    this.commit({ ...this.state, display: { ...display, source: { ...display.source, confidence: "assumed" } } });
  }

  /** Another client moves PC audio (SPEC §2.4: not applied to a slider while it is dragged). */
  changePcAudioFromPhone(): void {
    const current = this.state.audio.channels.pc.value ?? 0;
    const level = current >= 50 ? 20 : 80;
    this.applyExternal({ kind: "audio.level", channel: "pc", level, final: true }, "phone", PHONE_PUBLIC_ID);
  }

  /** S1.E17 "Unknown": the screen's position source stops reporting (Q2). */
  screenPositionUnknown(): void {
    const { display } = this.state;
    this.commit({ ...this.state, display: { ...display, screen: { ...display.screen, value: "unknown", confidence: "unknown" } } });
  }

  /** R3: a controller restart forgets the AC state → "Unknown" until the next command. */
  restartController(): void {
    const { environment } = this.state;
    const unknown = { value: null, confidence: "unknown" as const, source: "none" as const, updated_at: null, stale: false, changed_by: null };
    this.commit({
      ...this.state,
      environment: { ...environment, ac: { ...environment.ac, power: unknown, setpoint_c: unknown } },
    });
  }

  /** H10: the climate sensor (temperature + humidity) is 14 min old; again → fresh. */
  toggleClimateStale(): void {
    const { sensors } = this.state.environment;
    const stale = !sensors.temperature.stale;
    const at = stale ? new Date(this.now() - MOCK_STALE_AGE_MS).toISOString() : this.iso();
    this.setSensors({ ...sensors, temperature: { ...sensors.temperature, stale, at }, humidity: { ...sensors.humidity, stale, at } });
  }

  /** S1.E45: door Open (amber) ↔ Closed. */
  toggleDoor(): void {
    const { sensors } = this.state.environment;
    const value = sensors.contact.kind === "contact" && sensors.contact.value === "open" ? "closed" : "open";
    this.setSensors({ ...sensors, contact: { kind: "contact", value, node: sensors.contact.node, at: this.iso(), stale: false } });
  }

  /** H11: the door sensor has never reported ("—", "No reading yet"). */
  doorNoReading(): void {
    const { sensors } = this.state.environment;
    this.setSensors({ ...sensors, contact: { kind: "contact", value: null, node: sensors.contact.node, at: null, stale: false } });
  }
```
4. In `apps/kiosk/src/data/adapters/mock/fake-room.ts` replace:
```ts
  private setOccupancy(value: "detected" | "clear"): void {
```
   with:
```ts
  private withDevicesOnline(match: (device: Device) => boolean, online: boolean): RoomState {
    const ctx = { at: this.iso(), by: "by hand" as const };
    const devices = this.state.devices.map((device) =>
      match(device) ? { ...device, online: observe(device.online, online, ctx) } : device,
    );
    const blasterOnline = devices.find((device) => device.id === "ir_blaster")?.online.value !== false;
    const irBlaster = this.state.ir_blaster;
    return { ...this.state, devices, ir_blaster: { ...irBlaster, online: observe(irBlaster.online, blasterOnline, ctx) } };
  }

  private setSensors(sensors: RoomState["environment"]["sensors"]): void {
    this.commit({ ...this.state, environment: { ...this.state.environment, sensors } });
  }

  private setOccupancy(value: "detected" | "clear"): void {
```

**Test:** Create `apps/kiosk/src/data/adapters/mock/fake-room-panel.test.ts`:
```ts
import type { RoomState, ServerEvent } from "@eduscope/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, MOCK_LATENCY_MAX_MS, MOCK_STALE_AGE_MS } from "./fake-room";

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
  return { room, events, last };
}

describe("FakeRoom panel actions (S1 hidden states)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coordinator offline: fault, every Zigbee device and the blaster offline, no sensors reporting (H9)", () => {
    const { room, last } = connected();
    room.toggleCoordinatorOffline();
    const state = last();
    expect(state.room.status).toEqual({ level: "fault", text: "Coordinator offline" });
    expect(state.zigbee.coordinator.status).toBe("offline");
    expect(state.devices.find((d) => d.id === "lights")?.online.value).toBe(false);
    expect(state.devices.find((d) => d.id === "audio")?.online.value).toBe(true); // local, not Zigbee
    expect(state.ir_blaster.online.value).toBe(false);
    expect(state.environment.sensors.reporting).toEqual({ count: 0, of: 3 });
    room.toggleCoordinatorOffline();
    expect(last().room.status.level).toBe("normal");
  });

  it("blaster offline mirrors ir_blaster.online (H25)", () => {
    const { room, last } = connected();
    room.toggleDeviceOffline("ir_blaster");
    expect(last().ir_blaster.online.value).toBe(false);
    expect(last().room.status).toEqual({ level: "degraded", text: "ZS06 offline" });
  });

  it("climate stale backdates temperature + humidity by 14 min; 2 of 3 reporting (H10)", () => {
    const { room, last } = connected();
    room.toggleClimateStale();
    const { sensors } = last().environment;
    expect(sensors.temperature.stale).toBe(true);
    expect(sensors.humidity.stale).toBe(true);
    expect(Date.now() - new Date(sensors.temperature.at ?? 0).getTime()).toBe(MOCK_STALE_AGE_MS);
    expect(sensors.reporting).toEqual({ count: 2, of: 3 });
    room.toggleClimateStale();
    expect(last().environment.sensors.reporting).toEqual({ count: 3, of: 3 });
  });

  it("door toggles open/closed; no reading clears it (H11)", () => {
    const { room, last } = connected();
    room.toggleDoor();
    expect(last().environment.sensors.contact).toMatchObject({ kind: "contact", value: "open" });
    room.toggleDoor();
    expect(last().environment.sensors.contact).toMatchObject({ kind: "contact", value: "closed" });
    room.doorNoReading();
    expect(last().environment.sensors.contact).toMatchObject({ value: null, at: null });
  });

  it("source assumed, PC audio from phone, screen unknown, controller restart (AC unknown)", () => {
    const { room, events, last } = connected();
    room.sourceAssumed();
    expect(last().display.source.confidence).toBe("assumed");
    room.changePcAudioFromPhone();
    expect(last().audio.channels.pc).toMatchObject({ value: 80, changed_by: "phone" });
    expect(events.at(-1)).toEqual({ type: "activity", text: "PC audio set to 80", by: "phone", public_id: "mock-phone" });
    room.screenPositionUnknown();
    expect(last().display.screen).toMatchObject({ value: "unknown", confidence: "unknown" });
    room.restartController();
    expect(last().environment.ac.power).toMatchObject({ value: null, confidence: "unknown" });
    expect(last().environment.ac.setpoint_c.value).toBeNull();
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- fake-room` → all pass (the existing "toggling a device offline
degrades the room status (H8)" case still passes).

**Commit:** `git commit -m "feat(kiosk): mock panel actions for every S1 hidden state"`

### T13 — Mock panel buttons
- [x] done

**Files:** `apps/kiosk/src/app/dev/MockPanel.tsx`

**Context:** Exposes T11/T12 in `?mock-panel`. Existing buttons already cover "switch offline" (Toggle lights
offline), "by hand" (Change by hand), "from phone", fail/time out next command, audio offline.

**Do:**
1. In `apps/kiosk/src/app/dev/MockPanel.tsx` replace:
```tsx
  { label: "Occupancy detected", run: () => fakeRoom.occupancyDetected() },
];
```
   with:
```tsx
  { label: "Occupancy detected", run: () => fakeRoom.occupancyDetected() },
  // M04: every S1 hidden state (start with `?time-scale=0.1` for a fast projector ramp).
  { label: "Source assumed", run: () => fakeRoom.sourceAssumed() },
  { label: "No draw change (next IR)", run: () => fakeRoom.noDrawChangeNextCommand() },
  { label: "Toggle power meter offline", run: () => fakeRoom.toggleDeviceOffline("projector_socket") },
  { label: "Screen position unknown", run: () => fakeRoom.screenPositionUnknown() },
  { label: "Toggle screen offline", run: () => fakeRoom.toggleDeviceOffline("projection_screen") },
  { label: "Toggle HDMI switch offline", run: () => fakeRoom.toggleDeviceOffline("hdmi_switch") },
  // Delayed so it can land while you drag the PC slider (M04 AC6).
  { label: "Phone changes PC audio (in 3 s)", run: () => window.setTimeout(() => fakeRoom.changePcAudioFromPhone(), 3000) },
  { label: "Toggle blaster offline", run: () => fakeRoom.toggleDeviceOffline("ir_blaster") },
  { label: "Toggle coordinator offline", run: () => fakeRoom.toggleCoordinatorOffline() },
  { label: "Restart controller (AC unknown)", run: () => fakeRoom.restartController() },
  { label: "Toggle climate stale", run: () => fakeRoom.toggleClimateStale() },
  { label: "Toggle door open", run: () => fakeRoom.toggleDoor() },
  { label: "Door: no reading", run: () => fakeRoom.doorNoReading() },
];
```

**Verify:** `pnpm --filter @eduscope/kiosk typecheck` → exit 0. `pnpm --filter @eduscope/kiosk dev`, open
`http://localhost:5173/?mock-panel`: the panel lists the 13 new buttons below "Occupancy detected" (scroll inside the
panel). "Phone changes PC audio (in 3 s)" fires 3 s after the tap, so it can land during a drag (T28). Nothing on the page changes yet (S1 is still the placeholder).

**Commit:** `git commit -m "feat(kiosk): mock panel buttons for S1 hidden states"`

### T14 — Selector: source tiles (S1.E11/E12)
- [x] done

**Files:** `apps/kiosk/src/features/control/display/source-tiles.view.ts`,
`apps/kiosk/src/features/control/display/source-tiles.view.test.ts`

**Context:** S1.E11/E12 states: "Selected, confirmed" (`selected-fill` + green border), "Tap to select",
"Switching…" (pending, `[INFERRED]`), "Selected, assumed" (amber border, `[INFERRED]`); R10. The milestone notes
ask for text/enablement decisions in pure `*.view.ts` selectors, tested.

**Do:**
1. Create `apps/kiosk/src/features/control/display/source-tiles.view.ts`:
```ts
import type { HdmiInput, Observed } from "@eduscope/contracts";
import type { ActiveVariant, StateTone } from "@/components/state-styles";

// S1.E11 / S1.E12 source tiles (R10: exactly one input is active).

export const SOURCE_TILES: readonly { input: HdmiInput; label: string }[] = [
  { input: "podium_pc", label: "Podium PC" },
  { input: "smart_board", label: "Smart board" },
];

export interface SourceTileView {
  caption: "Selected, confirmed" | "Selected, assumed" | "Switching…" | "Tap to select";
  /** Caption colour; `null` = plain caption (text-2). */
  captionTone: StateTone | null;
  /** Tile fill: `selected` (teal + green border), `assumed` (amber border), `null` (neutral). */
  active: ActiveVariant | null;
  /** This input is the selected one: a tap does nothing. */
  selected: boolean;
}

export function sourceTileView(source: Observed<HdmiInput>, input: HdmiInput, pending: boolean): SourceTileView {
  const selected = source.value === input;
  if (selected && source.confidence === "confirmed") {
    return { caption: "Selected, confirmed", captionTone: "selected", active: "selected", selected };
  }
  if (selected) return { caption: "Selected, assumed", captionTone: "assumed", active: "assumed", selected };
  if (pending) return { caption: "Switching…", captionTone: null, active: null, selected };
  return { caption: "Tap to select", captionTone: null, active: null, selected };
}
```

**Test:** Create `apps/kiosk/src/features/control/display/source-tiles.view.test.ts`:
```ts
import type { HdmiInput, Observed } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { sourceTileView } from "./source-tiles.view";

const source = (value: HdmiInput | null, confidence: Observed<HdmiInput>["confidence"] = "confirmed"): Observed<HdmiInput> => ({
  value, confidence, source: "hdmi_switch", updated_at: null, stale: false, changed_by: null,
});

describe("sourceTileView (S1.E11/E12)", () => {
  it("the selected, confirmed input", () => {
    expect(sourceTileView(source("podium_pc"), "podium_pc", false)).toEqual({
      caption: "Selected, confirmed", captionTone: "selected", active: "selected", selected: true,
    });
  });
  it("the other input reads Tap to select", () => {
    expect(sourceTileView(source("podium_pc"), "smart_board", false)).toEqual({
      caption: "Tap to select", captionTone: null, active: null, selected: false,
    });
  });
  it("a pending tile reads Switching…", () => {
    expect(sourceTileView(source("podium_pc"), "smart_board", true).caption).toBe("Switching…");
  });
  it("selected but unconfirmed reads Selected, assumed with the amber fill", () => {
    expect(sourceTileView(source("smart_board", "assumed"), "smart_board", false)).toEqual({
      caption: "Selected, assumed", captionTone: "assumed", active: "assumed", selected: true,
    });
  });
  it("no input known: both tiles read Tap to select", () => {
    expect(sourceTileView(source(null, "unknown"), "podium_pc", false).caption).toBe("Tap to select");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- source-tiles` → 5 tests pass.

**Commit:** `git commit -m "feat(kiosk): source tile selector"`

### T15 — Selector: projector state line, wattage and buttons (S1.E13–E15)
- [x] done

**Files:** `apps/kiosk/src/features/control/display/projector.view.ts`,
`apps/kiosk/src/features/control/display/projector.view.test.ts`

**Context:** S1.E13 (all five lines), S1.E14/E15 active states, R1, R2, H7b (waiting / no change), H14, H15
(decision D13), H25, S1.E13 "Power meter offline · state unknown" (hollow ring, `— W`). The meter is the
`projector_socket` device; IR buttons follow `ir_blaster` (D18).

**Do:**
1. Create `apps/kiosk/src/features/control/display/projector.view.ts`:
```ts
import type { Interlock, RoomState } from "@eduscope/contracts";
import type { ActiveVariant, StateTone, ValueTone } from "@/components/state-styles";
import { formatWatts } from "@/lib/format";

// S1.E13–E15: projector state line, wattage and Power on/off (R1, R2, H7b, H14, H15, H25).

export interface ProjectorInput {
  projector: RoomState["display"]["projector"];
  interlock: Interlock;
  /** `online.value` of the S60 power meter device (`projector_socket`). */
  meterOnline: boolean | null | undefined;
  /** `online.value` of the IR blaster device (`ir_blaster`). */
  blasterOnline: boolean | null | undefined;
}

export interface ProjectorView {
  tone: StateTone;
  stateLine: string;
  watts: string;
  wattsTone: ValueTone;
  powerOnActive: ActiveVariant | null;
  powerOffActive: ActiveVariant | null;
  /** S1.E14 `[INFERRED]`: Power on is disabled while the interlock holds (lamp cooling). */
  powerOnBlocked: boolean;
  /** H15 line, or null. */
  holdLine: string | null;
  /** H25 line, or null. */
  blasterLine: string | null;
}

const IR_LABEL = { power_on: "Power on", power_off: "Power off" } as const;

interface Base {
  tone: StateTone;
  stateLine: string;
  wattsTone: ValueTone;
  on: boolean | null;
}

function base(projector: ProjectorInput["projector"]): Base {
  const { value, confidence } = projector.state;
  const how = confidence === "confirmed" ? "confirmed by draw" : "assumed";
  const tone = (confirmed: StateTone): StateTone => (confidence === "confirmed" ? confirmed : "assumed");
  switch (value) {
    case "running":
      return { tone: tone("confirmed"), stateLine: `On · ${how}`, wattsTone: "accent", on: true };
    case "standby":
      return { tone: tone("off"), stateLine: `Standby · ${how}`, wattsTone: "muted", on: false };
    case "warming_up":
      return { tone: "warning", stateLine: "Warming up", wattsTone: "warn", on: true };
    case "cooling_down":
      return { tone: "warning", stateLine: "Cooling down", wattsTone: "warn", on: false };
    case "unknown":
    case null:
      return { tone: "unknown", stateLine: "Unknown", wattsTone: "faint", on: null };
  }
}

export function projectorView({ projector, interlock, meterOnline, blasterOnline }: ProjectorInput): ProjectorView {
  const holding = interlock.status === "holding";
  const common = {
    powerOnBlocked: holding,
    holdLine: holding ? "Mains held on until projector cools" : null,
    blasterLine: blasterOnline === false ? "IR blaster offline" : null,
  };
  if (meterOnline === false) {
    return {
      ...common, tone: "unknown", stateLine: "Power meter offline · state unknown", watts: formatWatts(null),
      wattsTone: "faint", powerOnActive: null, powerOffActive: null,
    };
  }
  const b = base(projector);
  const { last_ir: lastIr, phase } = projector.feedback;
  let { tone, stateLine } = b;
  if (lastIr !== null && phase === "waiting_for_draw") stateLine = `${IR_LABEL[lastIr]} sent · waiting for draw`;
  if (lastIr !== null && phase === "no_change") {
    stateLine = `${IR_LABEL[lastIr]} sent · no change in draw`;
    tone = "warning";
  }
  return {
    ...common, tone, stateLine,
    watts: formatWatts(projector.power.value?.watts ?? null),
    wattsTone: projector.power.value === null ? "faint" : b.wattsTone,
    powerOnActive: b.on === true ? "confirmed" : null,
    powerOffActive: b.on === false ? "neutral" : null,
  };
}
```

**Test:** Create `apps/kiosk/src/features/control/display/projector.view.test.ts`:
```ts
import type { ProjectorFeedback, ProjectorState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { projectorView, type ProjectorInput } from "./projector.view";

function input(
  value: ProjectorState | null, watts: number | null, feedback: Partial<ProjectorFeedback> = {}, extra: Partial<ProjectorInput> = {},
): ProjectorInput {
  const { display, interlock } = roomState();
  const { projector } = display;
  return {
    projector: {
      ...projector,
      state: { ...projector.state, value },
      power: { ...projector.power, value: watts === null ? null : { watts, volts: 231, kwh_today: 1, rating_a: 13, at: "2026-10-05T10:41:30Z" } },
      feedback: { ...projector.feedback, phase: "idle", ...feedback },
    },
    interlock,
    meterOnline: true,
    blasterOnline: true,
    ...extra,
  };
}

describe("projectorView (S1.E13–E15)", () => {
  it("running: On · confirmed by draw, green 287 W, Power on active", () => {
    expect(projectorView(input("running", 287))).toMatchObject({
      tone: "confirmed", stateLine: "On · confirmed by draw", watts: "287 W", wattsTone: "accent",
      powerOnActive: "confirmed", powerOffActive: null, powerOnBlocked: false, holdLine: null, blasterLine: null,
    });
  });
  it("running but not confirmed by draw reads On · assumed", () => {
    const base = input("running", 287);
    const assumed = { ...base, projector: { ...base.projector, state: { ...base.projector.state, confidence: "assumed" as const } } };
    expect(projectorView(assumed)).toMatchObject({ tone: "assumed", stateLine: "On · assumed" });
  });
  it("standby: grey dot, 3 W in text-2, Power off active", () => {
    expect(projectorView(input("standby", 3))).toMatchObject({
      tone: "off", stateLine: "Standby · confirmed by draw", watts: "3 W", wattsTone: "muted",
      powerOnActive: null, powerOffActive: "neutral",
    });
  });
  it("warming up / cooling down: amber dot, live wattage (H14)", () => {
    expect(projectorView(input("warming_up", 27))).toMatchObject({ tone: "warning", stateLine: "Warming up", watts: "27 W", powerOnActive: "confirmed" });
    expect(projectorView(input("cooling_down", 30))).toMatchObject({ tone: "warning", stateLine: "Cooling down", powerOffActive: "neutral" });
  });
  it("IR sent, waiting for draw keeps the current tone (H7b)", () => {
    expect(projectorView(input("standby", 3, { last_ir: "power_on", phase: "waiting_for_draw" }))).toMatchObject({
      tone: "off", stateLine: "Power on sent · waiting for draw",
    });
  });
  it("no change in draw after 90 s is amber (H7b)", () => {
    expect(projectorView(input("running", 287, { last_ir: "power_off", phase: "no_change" }))).toMatchObject({
      tone: "warning", stateLine: "Power off sent · no change in draw",
    });
  });
  it("power meter offline: hollow ring, — W, state unknown", () => {
    expect(projectorView(input("running", 287, {}, { meterOnline: false }))).toMatchObject({
      tone: "unknown", stateLine: "Power meter offline · state unknown", watts: "— W", wattsTone: "faint",
      powerOnActive: null, powerOffActive: null,
    });
  });
  it("unknown state: Unknown, no active button", () => {
    expect(projectorView(input(null, null))).toMatchObject({ tone: "unknown", stateLine: "Unknown", watts: "— W", powerOnActive: null, powerOffActive: null });
  });
  it("interlock holding blocks Power on and shows the H15 line", () => {
    const view = projectorView(input("cooling_down", 30, {}, { interlock: { status: "holding", rule_text: "" } }));
    expect(view.powerOnBlocked).toBe(true);
    expect(view.holdLine).toBe("Mains held on until projector cools");
  });
  it("blaster offline shows the H25 line", () => {
    expect(projectorView(input("running", 287, {}, { blasterOnline: false })).blasterLine).toBe("IR blaster offline");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- projector.view` → 10 tests pass.

**Commit:** `git commit -m "feat(kiosk): projector selector"`

### T16 — Selector: projection screen (S1.E17/E18)
- [x] done

**Files:** `apps/kiosk/src/features/control/display/screen.view.ts`,
`apps/kiosk/src/features/control/display/screen.view.test.ts`

**Context:** S1.E17 Lowered / Raised / Moving… / Unknown, S1.E18 opposite action, Q2, H8, decision D12, D17.

**Do:**
1. Create `apps/kiosk/src/features/control/display/screen.view.ts`:
```ts
import type { Observed, ScreenPosition } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";

// S1.E17 / S1.E18: the button names the opposite action (Q2: two-state, no Stop).

export interface ScreenView {
  tone: StateTone;
  stateLine: string;
  action: { label: "Raise" | "Lower"; to: "raise" | "lower" };
  /** Disabled while the screen is moving (there is no Stop, Q2). */
  actionBlocked: boolean;
}

const RAISE = { label: "Raise", to: "raise" } as const;
const LOWER = { label: "Lower", to: "lower" } as const;

export function screenView(screen: Observed<ScreenPosition>, online: boolean | null | undefined, deviceName: string): ScreenView {
  const action = screen.value === "raised" || screen.value === "unknown" || screen.value === null ? LOWER : RAISE;
  if (online === false) {
    return { tone: "offline", stateLine: `${deviceName} offline · last known state`, action, actionBlocked: false };
  }
  const assumed = screen.confidence === "assumed";
  switch (screen.value) {
    case "lowered":
      return { tone: assumed ? "assumed" : "confirmed", stateLine: assumed ? "Lowered · assumed" : "Lowered", action, actionBlocked: false };
    case "raised":
      return { tone: assumed ? "assumed" : "off", stateLine: assumed ? "Raised · assumed" : "Raised", action, actionBlocked: false };
    case "moving":
      return { tone: "warning", stateLine: "Moving…", action, actionBlocked: true };
    case "unknown":
    case null:
      return { tone: "unknown", stateLine: "Unknown", action, actionBlocked: false };
  }
}
```

**Test:** Create `apps/kiosk/src/features/control/display/screen.view.test.ts`:
```ts
import type { Observed, ScreenPosition } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { screenView } from "./screen.view";

const screen = (value: ScreenPosition | null, confidence: Observed<ScreenPosition>["confidence"] = "confirmed"): Observed<ScreenPosition> => ({
  value, confidence, source: "switch", updated_at: null, stale: false, changed_by: null,
});

describe("screenView (S1.E17/E18)", () => {
  it("Lowered: green dot, button Raise", () => {
    expect(screenView(screen("lowered"), true, "Projection screen")).toEqual({
      tone: "confirmed", stateLine: "Lowered", action: { label: "Raise", to: "raise" }, actionBlocked: false,
    });
  });
  it("Raised: grey dot, button Lower", () => {
    expect(screenView(screen("raised"), true, "Projection screen")).toEqual({
      tone: "off", stateLine: "Raised", action: { label: "Lower", to: "lower" }, actionBlocked: false,
    });
  });
  it("Moving…: amber dot, button blocked", () => {
    expect(screenView(screen("moving"), true, "Projection screen")).toMatchObject({ tone: "warning", stateLine: "Moving…", actionBlocked: true });
  });
  it("Unknown: hollow ring, button Lower", () => {
    expect(screenView(screen("unknown", "unknown"), true, "Projection screen")).toMatchObject({
      tone: "unknown", stateLine: "Unknown", action: { label: "Lower", to: "lower" },
    });
  });
  it("assumed position says so", () => {
    expect(screenView(screen("lowered", "assumed"), true, "Projection screen")).toMatchObject({ tone: "assumed", stateLine: "Lowered · assumed" });
  });
  it("device offline (H8)", () => {
    expect(screenView(screen("lowered"), false, "Projection screen")).toMatchObject({
      tone: "offline", stateLine: "Projection screen offline · last known state", action: { label: "Raise", to: "raise" },
    });
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- screen.view` → 6 tests pass.

**Commit:** `git commit -m "feat(kiosk): projection screen selector"`

### T17 — Selector: level cards (S1.E21/E22, H18)
- [x] done

**Files:** `apps/kiosk/src/features/control/audio/audio.view.ts`, `apps/kiosk/src/features/control/audio/audio.view.test.ts`

**Context:** S1.E21/E22 value `62`, Muted (`[INFERRED]`: value "Muted", thumb at the saved level), offline (H8,
D17). Decision D6.

**Do:**
1. Create `apps/kiosk/src/features/control/audio/audio.view.ts`:
```ts
import type { Observed } from "@eduscope/contracts";

// S1.E21–E23: level cards and the mute-all bar (R9, H18).

export interface LevelView {
  /** `62`, `Muted` (H18) or `—`. */
  valueText: string;
  /** Thumb position: the saved level while muted (H18), else the server level. */
  sliderValue: number | null;
  muted: boolean;
  /** H8 line, or null. */
  offlineLine: string | null;
}

export function levelView(
  level: Observed<number>, mutedAll: Observed<boolean>, saved: number | null, online: boolean | null | undefined, deviceName: string,
): LevelView {
  const muted = mutedAll.value === true;
  return {
    valueText: muted ? "Muted" : level.value === null ? "—" : String(level.value),
    sliderValue: muted ? (saved ?? level.value) : level.value,
    muted,
    offlineLine: online === false ? `${deviceName} offline · last known state` : null,
  };
}
```

**Test:** Create `apps/kiosk/src/features/control/audio/audio.view.test.ts`:
```ts
import type { Observed } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { levelView } from "./audio.view";

const obs = <T,>(value: T | null): Observed<T> => ({
  value, confidence: "confirmed", source: "mixer", updated_at: null, stale: false, changed_by: null,
});

describe("levelView (S1.E21/E22)", () => {
  it("shows the server level", () => {
    expect(levelView(obs(62), obs(false), null, true, "Audio mixer")).toEqual({
      valueText: "62", sliderValue: 62, muted: false, offlineLine: null,
    });
  });
  it("muted: value Muted, thumb at the saved level (H18)", () => {
    expect(levelView(obs(0), obs(true), 62, true, "Audio mixer")).toEqual({
      valueText: "Muted", sliderValue: 62, muted: true, offlineLine: null,
    });
  });
  it("unknown level reads —", () => {
    expect(levelView(obs<number>(null), obs(false), null, true, "Audio mixer").valueText).toBe("—");
  });
  it("mixer offline (H8)", () => {
    expect(levelView(obs(62), obs(false), null, false, "Audio mixer").offlineLine).toBe("Audio mixer offline · last known state");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- audio.view` → 4 tests pass.

**Commit:** `git commit -m "feat(kiosk): level card selector"`

### T18 — Selector: mute-all bar (S1.E23)
- [ ] done

**Files:** `apps/kiosk/src/features/control/audio/audio.view.ts`, `apps/kiosk/src/features/control/audio/audio.view.test.ts`

**Context:** S1.E23: unmuted grey dot "Mute all audio"; muted amber dot, "Unmute all audio", `warn-fill` (the
`assumed` active variant is `warn-fill` + amber border). R9.

**Do:**
1. In `apps/kiosk/src/features/control/audio/audio.view.ts` replace:
```ts
import type { Observed } from "@eduscope/contracts";
```
   with:
```ts
import type { Observed } from "@eduscope/contracts";
import type { ActiveVariant, StateTone } from "@/components/state-styles";
```
2. Append to `apps/kiosk/src/features/control/audio/audio.view.ts`:
```ts

export interface MuteBarView {
  label: "Mute all audio" | "Unmute all audio";
  dotTone: StateTone;
  active: ActiveVariant | null;
  /** The `muted` value a tap sends. */
  nextMuted: boolean;
}

export function muteBarView(mutedAll: Observed<boolean>): MuteBarView {
  return mutedAll.value === true
    ? { label: "Unmute all audio", dotTone: "warning", active: "assumed", nextMuted: false }
    : { label: "Mute all audio", dotTone: "off", active: null, nextMuted: true };
}
```

**Test:**
1. In `apps/kiosk/src/features/control/audio/audio.view.test.ts` replace:
```ts
import { levelView } from "./audio.view";
```
   with:
```ts
import { levelView, muteBarView } from "./audio.view";
```
2. Append to `apps/kiosk/src/features/control/audio/audio.view.test.ts`:
```ts

describe("muteBarView (S1.E23)", () => {
  it("unmuted: grey dot, Mute all audio", () => {
    expect(muteBarView(obs(false))).toEqual({ label: "Mute all audio", dotTone: "off", active: null, nextMuted: true });
  });
  it("muted: amber dot, warn fill, Unmute all audio", () => {
    expect(muteBarView(obs(true))).toEqual({ label: "Unmute all audio", dotTone: "warning", active: "assumed", nextMuted: false });
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- audio.view` → 6 tests pass.

**Commit:** `git commit -m "feat(kiosk): mute-all bar selector"`

### T19 — Selector: lights (S1.E31–E33)
- [ ] done

**Files:** `apps/kiosk/src/features/control/environment/lights.view.ts`,
`apps/kiosk/src/features/control/environment/lights.view.test.ts`

**Context:** S1.E31 "Confirmed by the switch" / "Switch offline · last known state" (H8, R6). A row tap sends the
opposite of the server value (never a local toggle, R12).

**Do:**
1. Create `apps/kiosk/src/features/control/environment/lights.view.ts`:
```ts
import type { StateTone } from "@/components/state-styles";

// S1.E31: the lights header line (R6: always confirmed by the switch; H8 when offline).

export interface LightsView {
  tone: StateTone;
  line: "Confirmed by the switch" | "Switch offline · last known state";
}

export function lightsView(online: boolean | null | undefined): LightsView {
  return online === false
    ? { tone: "offline", line: "Switch offline · last known state" }
    : { tone: "confirmed", line: "Confirmed by the switch" };
}

/** A row tap sends the opposite of the server value; unknown (null) turns it on. */
export function nextLightOn(value: boolean | null): boolean {
  return value !== true;
}
```

**Test:** Create `apps/kiosk/src/features/control/environment/lights.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { lightsView, nextLightOn } from "./lights.view";

describe("lightsView (S1.E31)", () => {
  it("online: green dot, Confirmed by the switch", () => {
    expect(lightsView(true)).toEqual({ tone: "confirmed", line: "Confirmed by the switch" });
    expect(lightsView(undefined)).toEqual({ tone: "confirmed", line: "Confirmed by the switch" });
  });
  it("offline: red dot, last known state (H8)", () => {
    expect(lightsView(false)).toEqual({ tone: "offline", line: "Switch offline · last known state" });
  });
  it("a tap sends the opposite of the server value", () => {
    expect(nextLightOn(true)).toBe(false);
    expect(nextLightOn(false)).toBe(true);
    expect(nextLightOn(null)).toBe(true);
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- lights.view` → 3 tests pass.

**Commit:** `git commit -m "feat(kiosk): lights selector"`

### T20 — Selector: air conditioning (S1.E34–E40)
- [ ] done

**Files:** `apps/kiosk/src/features/control/environment/ac.view.ts`,
`apps/kiosk/src/features/control/environment/ac.view.test.ts`

**Context:** S1.E34 "On · assumed" / "Off · assumed" / "Unknown" (R3, H7), S1.E35/E36 active fills, S1.E38–E40
(R4 captured setpoints only, H19 bounds, Q5 disabled while Off; also disabled while Unknown), S1.E39 dimmed when not
On, H25.

**Do:**
1. Create `apps/kiosk/src/features/control/environment/ac.view.ts`:
```ts
import type { AcState } from "@eduscope/contracts";
import type { ActiveVariant, StateTone } from "@/components/state-styles";
import { formatCelsius } from "@/lib/format";

// S1.E34–E40: AC is never confirmed (R3); −/+ step through captured setpoints (R4, H19, Q5).

export interface AcView {
  tone: StateTone;
  stateLine: "On · assumed" | "Off · assumed" | "Unknown";
  powerOnActive: ActiveVariant | null;
  powerOffActive: ActiveVariant | null;
  /** `24°` or `—`. */
  setpoint: string;
  /** S1.E39: dimmed unless the AC is assumed On. */
  setpointDimmed: boolean;
  canStepDown: boolean;
  canStepUp: boolean;
  /** H25 line, or null. */
  blasterLine: string | null;
}

export function acView(ac: AcState, blasterOnline: boolean | null | undefined): AcView {
  const unknown = ac.power.value === null || ac.power.confidence === "unknown";
  const on = !unknown && ac.power.value === "on";
  const current = ac.setpoint_c.value;
  const canStep = (direction: "down" | "up"): boolean =>
    on && current !== null && ac.available_setpoints.some((t) => (direction === "down" ? t < current : t > current));
  return {
    tone: unknown ? "unknown" : "assumed",
    stateLine: unknown ? "Unknown" : on ? "On · assumed" : "Off · assumed",
    powerOnActive: on ? "assumed" : null,
    powerOffActive: !unknown && !on ? "neutral" : null,
    setpoint: formatCelsius(current, 0),
    setpointDimmed: !on,
    canStepDown: canStep("down"),
    canStepUp: canStep("up"),
    blasterLine: blasterOnline === false ? "IR blaster offline" : null,
  };
}
```

**Test:** Create `apps/kiosk/src/features/control/environment/ac.view.test.ts`:
```ts
import type { AcState } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { acView } from "./ac.view";

function ac(power: "on" | "off" | null, setpoint: number | null): AcState {
  const base = roomState().environment.ac;
  return {
    ...base,
    power: { ...base.power, value: power, confidence: power === null ? "unknown" : "assumed" },
    setpoint_c: { ...base.setpoint_c, value: setpoint, confidence: setpoint === null ? "unknown" : "assumed" },
  };
}

describe("acView (S1.E34–E40)", () => {
  it("assumed On: amber ring, Power on active, both steps enabled mid-range", () => {
    expect(acView(ac("on", 24), true)).toEqual({
      tone: "assumed", stateLine: "On · assumed", powerOnActive: "assumed", powerOffActive: null,
      setpoint: "24°", setpointDimmed: false, canStepDown: true, canStepUp: true, blasterLine: null,
    });
  });
  it("− is disabled at the lowest captured setpoint, + at the highest (H19)", () => {
    expect(acView(ac("on", 18), true)).toMatchObject({ canStepDown: false, canStepUp: true });
    expect(acView(ac("on", 30), true)).toMatchObject({ canStepDown: true, canStepUp: false });
  });
  it("assumed Off: Power off active, setpoint dimmed, both steps disabled (Q5)", () => {
    expect(acView(ac("off", 24), true)).toMatchObject({
      stateLine: "Off · assumed", powerOnActive: null, powerOffActive: "neutral", setpointDimmed: true,
      canStepDown: false, canStepUp: false,
    });
  });
  it("Unknown before any command (R3): hollow ring, —, nothing active", () => {
    expect(acView(ac(null, null), true)).toEqual({
      tone: "unknown", stateLine: "Unknown", powerOnActive: null, powerOffActive: null,
      setpoint: "—", setpointDimmed: true, canStepDown: false, canStepUp: false, blasterLine: null,
    });
  });
  it("only captured setpoints count (R4)", () => {
    const sparse = { ...ac("on", 22), available_setpoints: [22, 26] };
    expect(acView(sparse, true)).toMatchObject({ canStepDown: false, canStepUp: true });
  });
  it("blaster offline shows the H25 line", () => {
    expect(acView(ac("on", 24), false).blasterLine).toBe("IR blaster offline");
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- ac.view` → 6 tests pass.

**Commit:** `git commit -m "feat(kiosk): air conditioning selector"`

### T21 — Selector: room sensors (S1.E41–E45)
- [ ] done

**Files:** `apps/kiosk/src/features/control/environment/sensors.view.ts`,
`apps/kiosk/src/features/control/environment/sensors.view.test.ts`

**Context:** S1.E41 "3 reporting" (green) / "2 of 3 reporting" (amber) / "No sensors reporting" (red); S1.E42–E45
formats (°C 1 dp, % integer, Detected green, Clear text-1, Open amber, Closed text-1); H10 "· 14 min ago"; H11;
H8/H9 "· offline" (D17); D16 numeric vs word. Captions come from the device registry (`device.hw_ref ===
reading.node` → `device.model`), never hardcoded.

**Do:**
1. Create `apps/kiosk/src/features/control/environment/sensors.view.ts`:
```ts
import type { Device, RoomState, SensorKind, SensorReading } from "@eduscope/contracts";
import type { StateTone, ValueTone } from "@/components/state-styles";
import { formatAgo, formatCelsius, formatPercent } from "@/lib/format";

// S1.E41–E45 (R13, H8/H9, H10, H11). Counts devices, not tiles: climate = 1 device, 2 tiles.

export interface SensorTileView {
  kind: SensorKind;
  label: string;
  /** Formatted value, or null = no reading ever (H11). */
  value: string | null;
  /** Model from the device registry, e.g. `SNZB-02P`. */
  caption: string;
  tone: ValueTone;
  /** Numbers in mono 24px; words ("Detected", "Closed") in sans 18px. */
  numeric: boolean;
  /** Caption suffix: `14 min ago` (H10) or `offline` (H8/H9); null when fresh. */
  suffix: string | null;
}

export interface SensorsView {
  reportingTone: StateTone;
  reportingText: string;
  tiles: SensorTileView[];
}

type Sensors = RoomState["environment"]["sensors"];

const LABELS: Record<SensorKind, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
  occupancy: "Occupancy",
  contact: "Door",
};

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

export function reportingLine({ count, of }: Sensors["reporting"]): { tone: StateTone; text: string } {
  if (of > 0 && count >= of) return { tone: "confirmed", text: `${count} reporting` };
  if (count === 0) return { tone: "offline", text: "No sensors reporting" };
  return { tone: "warning", text: `${count} of ${of} reporting` };
}

export function sensorsView(sensors: Sensors, devices: readonly Device[], now: Date): SensorsView {
  const reporting = reportingLine(sensors.reporting);
  const tiles = [sensors.temperature, sensors.humidity, sensors.occupancy, sensors.contact].map((reading): SensorTileView => {
    const device = devices.find((d) => d.hw_ref === reading.node);
    const { value, tone } = formatReading(reading);
    const suffix =
      device?.online.value === false ? "offline" : reading.stale && reading.at !== null ? formatAgo(reading.at, now) : null;
    const numeric = reading.kind === "temperature" || reading.kind === "humidity";
    return { kind: reading.kind, label: LABELS[reading.kind], value, caption: device?.model ?? reading.node, tone, numeric, suffix };
  });
  return { reportingTone: reporting.tone, reportingText: reporting.text, tiles };
}
```

**Test:** Create `apps/kiosk/src/features/control/environment/sensors.view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { reportingLine, sensorsView } from "./sensors.view";

const NOW = new Date("2026-10-05T10:42:00Z");

describe("reportingLine (S1.E41)", () => {
  it("all reporting: green, `3 reporting`", () => {
    expect(reportingLine({ count: 3, of: 3 })).toEqual({ tone: "confirmed", text: "3 reporting" });
  });
  it("some: amber, `2 of 3 reporting`", () => {
    expect(reportingLine({ count: 2, of: 3 })).toEqual({ tone: "warning", text: "2 of 3 reporting" });
  });
  it("none: red, `No sensors reporting`", () => {
    expect(reportingLine({ count: 0, of: 3 })).toEqual({ tone: "offline", text: "No sensors reporting" });
  });
});

describe("sensorsView (S1.E42–E45)", () => {
  it("screenshot 01 values with model captions", () => {
    const { environment, devices } = roomState();
    expect(sensorsView(environment.sensors, devices, NOW).tiles).toEqual([
      { kind: "temperature", label: "Temperature", value: "26.4°", caption: "SNZB-02P", tone: "default", numeric: true, suffix: null },
      { kind: "humidity", label: "Humidity", value: "61%", caption: "SNZB-02P", tone: "default", numeric: true, suffix: null },
      { kind: "occupancy", label: "Occupancy", value: "Detected", caption: "SNZB-03P", tone: "accent", numeric: false, suffix: null },
      { kind: "contact", label: "Door", value: "Closed", caption: "SNZB-04PR2", tone: "default", numeric: false, suffix: null },
    ]);
  });
  it("stale reading: `14 min ago` suffix (H10)", () => {
    const { environment, devices } = roomState();
    const temperature = { ...environment.sensors.temperature, stale: true, at: "2026-10-05T10:28:00Z" };
    const view = sensorsView({ ...environment.sensors, temperature }, devices, NOW);
    expect(view.tiles[0]?.suffix).toBe("14 min ago");
  });
  it("no reading ever: value null (H11)", () => {
    const { environment, devices } = roomState();
    const contact = { kind: "contact" as const, value: null, node: "r101_door", at: null, stale: false };
    expect(sensorsView({ ...environment.sensors, contact }, devices, NOW).tiles[3]).toMatchObject({ value: null, suffix: null });
  });
  it("door open is amber, occupancy clear is plain", () => {
    const { environment, devices } = roomState();
    const contact = { ...environment.sensors.contact, kind: "contact" as const, value: "open" as const };
    const occupancy = { ...environment.sensors.occupancy, kind: "occupancy" as const, value: "clear" as const };
    const tiles = sensorsView({ ...environment.sensors, contact, occupancy }, devices, NOW).tiles;
    expect(tiles[3]).toMatchObject({ value: "Open", tone: "warn" });
    expect(tiles[2]).toMatchObject({ value: "Clear", tone: "default" });
  });
  it("offline sensor device: `offline` suffix (H8/H9)", () => {
    const { environment, devices } = roomState();
    const offline = devices.map((d) => (d.id === "room_climate" ? { ...d, online: { ...d.online, value: false } } : d));
    const tiles = sensorsView(environment.sensors, offline, NOW).tiles;
    expect(tiles[0]?.suffix).toBe("offline");
    expect(tiles[1]?.suffix).toBe("offline");
    expect(tiles[2]?.suffix).toBeNull();
  });
});
```

**Verify:** `pnpm --filter @eduscope/kiosk test -- sensors.view` → 8 tests pass.

**Commit:** `git commit -m "feat(kiosk): room sensors selector"`

### T22 — `CardHeader` (dot · title / state line · aside · padlock)
- [ ] done

**Files:** `apps/kiosk/src/features/control/CardHeader.tsx`

**Context:** Screenshot 01: every S1 card header is a 10px dot, a 16px semibold title, a 12px state line under it,
and an optional right side (`287 W`, `ZBM5`, `IR REMOTE`). H12 adds a padlock at the far right. H1: skeletons for
dot and line while loading. Used only by `features/control` cards (so it lives in the feature, not `components/`).
Line colour from `HEADER_LINE_CLASS` (D3).

States: loading (`tone === null` → skeleton dot + 128px skeleton line) · every `StateTone` · locked (padlock).

**Do:**
1. Create `apps/kiosk/src/features/control/CardHeader.tsx`:
```tsx
import type { ReactNode } from "react";
import { LockBadge } from "@/components/LockBadge";
import { StateDot } from "@/components/StateDot";
import { HEADER_LINE_CLASS, type StateTone } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";

export interface CardHeaderProps {
  title: string;
  /** `null` while loading (H1): skeleton instead of dot and line. */
  tone: StateTone | null;
  line: string | null;
  /** Right side: wattage, tag ("ZBM5", "IR REMOTE"). */
  aside?: ReactNode;
  /** H12 padlock. */
  locked: boolean;
  className?: string;
}

/** S1 card header: dot · title over state line · aside · padlock (SPEC §3.2 card title/subtitle). */
export function CardHeader({ title, tone, line, aside, locked, className }: CardHeaderProps) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      {tone === null ? <Skeleton className="mt-1.5 size-2.5 rounded-full" /> : <StateDot tone={tone} className="mt-1.5" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-card-title font-semibold text-text-1">{title}</h3>
        {tone === null || line === null ? (
          <Skeleton className="mt-0.5 h-4 w-32" />
        ) : (
          <p className={cn("text-caption", HEADER_LINE_CLASS[tone])}>{line}</p>
        )}
      </div>
      {aside}
      {locked && <LockBadge />}
    </div>
  );
}
```

**Verify:** `pnpm --filter @eduscope/kiosk typecheck` → exit 0; `pnpm lint` → 0 problems.

**Commit:** `git commit -m "feat(kiosk): S1 card header"`

### T23 — `ControlPage` grid: three sections, responsive columns
- [ ] done

**Files:** `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** SPEC §2.2 + ARCHITECTURE §4.1. One grid, mobile first:
- base (<600): one column, order Display → Audio → Environment, `pb-14` so the fixed BottomNav (T35) never covers
  the last card;
- `sm:` (600–1023): two columns; Display (row 1) and Audio (row 2) in column 1; Environment in column 2 spanning
  both rows (`sm:row-span-2`); `sm:grid-rows-[auto_1fr]` gives any extra height to row 2, so Display and Audio
  stay 16px apart;
- `lg:` (≥1024): three equal columns in one row.
Column gap 16 (`gap-4`); inside a section label → card and card → card are 12 (`gap-3`). Sections get
`scroll-mt-18` (D9) and ids `display` / `audio` / `environment` for BottomNav. Cards are added by T25–T33; until
then the page shows the three section labels. Decision D8: no `h-dvh`/`overflow-hidden`.

**Do:**
1. Replace the whole file `apps/kiosk/src/features/control/ControlPage.tsx` with:
```tsx
import { SectionLabel } from "@/components/SectionLabel";

// SPEC §2.2 / ARCHITECTURE §4.1: one grid. Phone: Display → Audio → Environment. 600–1023:
// Display + Audio stacked left, Environment right. ≥1024: three columns, no scroll at 1280×800.
// scroll-mt-18 = sticky 56px header + 16px, so BottomNav jumps land below the header.
const SECTION = "flex min-w-0 scroll-mt-18 flex-col gap-3";

export function ControlPage() {
  return (
    <div className="grid grid-cols-1 gap-4 pb-14 sm:grid-cols-2 sm:grid-rows-[auto_1fr] sm:pb-0 lg:grid-cols-3 lg:grid-rows-1">
      <section id="display" aria-label="Display" className={SECTION}>
        <SectionLabel>Display</SectionLabel>
      </section>
      <section id="audio" aria-label="Audio" className={`${SECTION} sm:col-start-1 lg:col-start-2 lg:row-start-1`}>
        <SectionLabel>Audio</SectionLabel>
      </section>
      <section
        id="environment"
        aria-label="Environment"
        className={`${SECTION} sm:col-start-2 sm:row-span-2 sm:row-start-1 lg:col-start-3 lg:row-span-1`}
      >
        <SectionLabel>Environment</SectionLabel>
      </section>
    </div>
  );
}
```

**Verify:** `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/`. At 1280 wide: "DISPLAY", "AUDIO",
"ENVIRONMENT" side by side at x = 24, 440, 856. At 800: "DISPLAY" and "ENVIRONMENT" on the first row, "AUDIO" under
"DISPLAY". At 390: the three labels stacked. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): S1 grid with three sections"`

### T24 — `SourceTile` (one input tile)
- [ ] done

**Files:** `apps/kiosk/src/features/control/display/SourceTile.tsx`

**Context:** S1.E11/E12, screenshot 01 left column top: title 16px semibold over a 12px caption, left aligned, the
whole tile is the button (min 72px tall, `px-4 py-3`, radius 8, 2px border). Fills from `state-styles.ts`:
`selected` → `selected-fill` + `accent-border`; `assumed` → `warn-fill` + amber border; none → `control` +
`border-strong`. Caption colours: "Selected, confirmed" `accent`, "Selected, assumed" `warn`, "Switching…" and
"Tap to select" `text-2`. Pressed on touch-down (`usePressed`).

States: loading (caption skeleton) · selected confirmed · selected assumed · not selected · pending (border pulses,
caption "Switching…" from the selector, taps ignored) · disabled (40%, H2/H3/H8) · locked (padlock right of the title,
the tile stays tappable at full colour so `useCommand` opens S4).

**Do:**
1. Create `apps/kiosk/src/features/control/display/SourceTile.tsx`:
```tsx
import { LockBadge } from "@/components/LockBadge";
import {
  ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS, PENDING_CONTROL_CLASS, TEXT_CLASS,
} from "@/components/state-styles";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import type { SourceTileView } from "./source-tiles.view";

export interface SourceTileProps {
  label: string;
  /** `null` while loading (H1). */
  view: SourceTileView | null;
  pending: boolean;
  disabled: boolean;
  locked: boolean;
  onPress: () => void;
}

/** S1.E11 / S1.E12: title over caption, left aligned; the whole tile is the target. */
export function SourceTile({ label, view, pending, disabled, locked, onPress }: SourceTileProps) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      disabled={disabled}
      aria-pressed={view?.selected === true}
      aria-busy={pending}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex min-h-18 min-w-0 flex-col items-start justify-center gap-0.5 rounded-btn border-2 px-4 py-3 text-left",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        view?.active ? ACTIVE_CONTROL_CLASS[view.active] : INACTIVE_CONTROL_CLASS,
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-card-title font-semibold text-text-1">{label}</span>
        {locked && <LockBadge />}
      </span>
      {view === null ? (
        <Skeleton className="h-4 w-24" />
      ) : (
        <span className={cn("text-caption", view.captionTone === null ? "text-text-2" : TEXT_CLASS[view.captionTone])}>
          {view.caption}
        </span>
      )}
    </button>
  );
}
```

**Verify:** `pnpm --filter @eduscope/kiosk typecheck` → exit 0.

**Commit:** `git commit -m "feat(kiosk): source tile"`

### T25 — `SourceTiles` on the page (S1.E11/E12)
- [ ] done

**Files:** `apps/kiosk/src/features/control/display/SourceTiles.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Two tiles side by side at **every** width (`grid grid-cols-2 gap-3`; ~171px each at 390, SPEC §2.2).
Each tile has its own pending key (`display.source:podium_pc`, `display.source:smart_board`) and the gate of the
`hdmi_switch` device. Tapping the selected tile sends nothing (S1.E11). H8: a red line "HDMI switch offline · last
known state" under the tiles (D17); H6: `InlineError` under that.

**Do:**
1. Create `apps/kiosk/src/features/control/display/SourceTiles.tsx`:
```tsx
import { InlineError } from "@/components/InlineError";
import { ObservedLine } from "@/components/ObservedLine";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { SourceTile } from "./SourceTile";
import { SOURCE_TILES, sourceTileView } from "./source-tiles.view";

const DEVICE_ID = "hdmi_switch";

/** S1.E11 + S1.E12 side by side at every width (SPEC §2.2). */
export function SourceTiles() {
  const source = useRoomState((state) => state.display.source);
  const device = useRoomState((state) => state.devices.find((d) => d.id === DEVICE_ID));
  const locked = useViewOnly();
  const podium = useCommand("display.source:podium_pc", DEVICE_ID);
  const board = useCommand("display.source:smart_board", DEVICE_ID);
  const commands = { podium_pc: podium, smart_board: board };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        {SOURCE_TILES.map(({ input, label }) => {
          const command = commands[input];
          const view = source === undefined ? null : sourceTileView(source, input, command.pending);
          return (
            <SourceTile
              key={input}
              label={label}
              view={view}
              pending={command.pending}
              disabled={gateDisablesControl(command.gate)}
              locked={locked}
              onPress={() => {
                if (view?.selected === true) return; // S1.E11: tapping the selected tile does nothing
                command.send({ kind: "source.select", input });
              }}
            />
          );
        })}
      </div>
      {device?.online.value === false && <ObservedLine tone="offline" text={`${device.name} offline · last known state`} />}
      <InlineError message={podium.error ?? board.error} />
    </div>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { SectionLabel } from "@/components/SectionLabel";
```
   with:
```tsx
import { SectionLabel } from "@/components/SectionLabel";
import { SourceTiles } from "./display/SourceTiles";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <SectionLabel>Display</SectionLabel>
```
   with:
```tsx
        <SectionLabel>Display</SectionLabel>
        <SourceTiles />
```

**Verify:** `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/?mock-panel`, tap "Be kiosk" (control
without a PIN). "Podium PC / Selected, confirmed" (teal fill, green border) and "Smart board / Tap to select". Tap
"Smart board": its caption reads "Switching…" with a pulsing border, then "Selected, confirmed" while Podium PC reads
"Tap to select". Tap Smart board again: nothing is sent (no pulse). Panel "Source assumed": "Selected, assumed" with
amber fill and border. Panel "Toggle HDMI switch offline": tiles dimmed and the red line shows. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): source tiles on S1"`

### T26 — `ProjectorCard` (S1.E13–E16)
- [ ] done

**Files:** `apps/kiosk/src/features/control/display/ProjectorCard.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Screenshot 01 left column middle: header (dot, "Projector", state line; wattage right in mono 24px),
then Power on / Power off side by side (`grid grid-cols-2 gap-3`, both `size="primary"` = 56px, at every width),
then the caption "Commanded over IR · state read back from the S60 power meter" (12px text-2; wraps on phones).
Card border from `CARD_VARIANT_FOR_TONE[view.tone]` (dashed when unknown/assumed). Pending keys
`projector.ir:on` / `projector.ir:off`, gated on `ir_blaster` (D18). Power on also disabled while the interlock
holds (D13).

States: loading (skeleton line + wattage) · On · confirmed by draw (green dot, green `287 W`, Power on green fill) ·
Standby · confirmed by draw (grey dot, `3 W` text-2, Power off neutral highlight) · Warming up / Cooling down (amber
dot, amber live W) · "Power on sent · waiting for draw" · "… · no change in draw" (amber, H7b) · Power meter offline ·
state unknown (hollow ring, `— W`, dashed border) · Unknown · H15 amber line "Mains held on until projector cools" +
Power on disabled · H25 red line "IR blaster offline" + both disabled · pending (pulse) · H6 inline error · locked.

**Do:**
1. Create `apps/kiosk/src/features/control/display/ProjectorCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { CARD_VARIANT_FOR_TONE, VALUE_TONE_CLASS } from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { CardHeader } from "../CardHeader";
import { projectorView } from "./projector.view";

/** S1.E13–E16. Power on/off go over IR, so they follow the blaster (H25). */
export function ProjectorCard() {
  const view = useRoomState((state) =>
    projectorView({
      projector: state.display.projector,
      interlock: state.interlock,
      meterOnline: state.devices.find((d) => d.id === "projector_socket")?.online.value,
      blasterOnline: state.devices.find((d) => d.id === "ir_blaster")?.online.value,
    }),
  );
  const locked = useViewOnly();
  const on = useCommand("projector.ir:on", "ir_blaster");
  const off = useCommand("projector.ir:off", "ir_blaster");

  return (
    <Card variant={view === undefined ? "solid" : CARD_VARIANT_FOR_TONE[view.tone]} className="flex flex-col gap-3">
      <CardHeader
        title="Projector"
        tone={view?.tone ?? null}
        line={view?.stateLine ?? null}
        locked={locked}
        aside={
          view === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <span className={cn("shrink-0 font-mono text-value font-semibold", VALUE_TONE_CLASS[view.wattsTone])}>{view.watts}</span>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <CommandButton
          label="Power on"
          size="primary"
          active={view?.powerOnActive ?? null}
          pending={on.pending}
          disabled={gateDisablesControl(on.gate) || view?.powerOnBlocked === true}
          onPress={() => on.send({ kind: "projector.power", on: true })}
        />
        <CommandButton
          label="Power off"
          size="primary"
          active={view?.powerOffActive ?? null}
          pending={off.pending}
          disabled={gateDisablesControl(off.gate)}
          onPress={() => off.send({ kind: "projector.power", on: false })}
        />
      </div>
      <p className="text-caption text-text-2">Commanded over IR · state read back from the S60 power meter</p>
      {view?.holdLine != null && <p className="text-caption text-warn">{view.holdLine}</p>}
      {view?.blasterLine != null && <p className="text-caption text-danger">{view.blasterLine}</p>}
      <InlineError message={on.error ?? off.error} />
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { SourceTiles } from "./display/SourceTiles";
```
   with:
```tsx
import { SourceTiles } from "./display/SourceTiles";
import { ProjectorCard } from "./display/ProjectorCard";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <SourceTiles />
```
   with:
```tsx
        <SourceTiles />
        <ProjectorCard />
```

**Verify:** `pnpm --filter @eduscope/kiosk dev`, open `http://localhost:5173/?mock-panel&time-scale=0.1`, "Be kiosk".
Initially "On · confirmed by draw", green `287 W`, Power on green. Tap Power off: ~1 s "Power off sent · waiting for
draw", then "Cooling down" (amber dot) with the wattage falling and the amber line "Mains held on until projector
cools" (Power on disabled), then after ~6 s "Standby · confirmed by draw", `3 W` grey, Power off highlighted. Tap
Power on: "Power on sent · waiting for draw" → "Warming up" (amber, live W) → after ~3 s "On · confirmed by draw"
`287 W`. Panel "No draw change (next IR)", tap Power off: "Power off sent · waiting for draw" for ~9 s, then
"Power off sent · no change in draw" in amber. Panel "Toggle power meter offline": hollow grey ring, `— W`, "Power
meter offline · state unknown", dashed border. Panel "Toggle blaster offline": both buttons dimmed, red "IR blaster
offline". `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): projector card on S1"`

### T27 — `ScreenCard` (S1.E17/E18)
- [ ] done

**Files:** `apps/kiosk/src/features/control/display/ScreenCard.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Screenshot 01 left column bottom: header left (`flex-1`), one 56px button right (`w-28`), on one row at
every width. Pending key `screen`, gate `projection_screen`.

States: loading · Lowered (green dot, "Raise") · Raised (grey dot, "Lower") · Moving… (amber dot, button disabled) ·
Unknown (hollow ring, "Lower") · "Lowered · assumed" (amber ring) · H8 "Projection screen offline · last known
state" (red, button disabled) · pending · H6 · locked.

**Do:**
1. Create `apps/kiosk/src/features/control/display/ScreenCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { CARD_VARIANT_FOR_TONE } from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { CardHeader } from "../CardHeader";
import { screenView } from "./screen.view";

const DEVICE_ID = "projection_screen";

/** S1.E17 / S1.E18: header left, the one action button right (also at 390px). */
export function ScreenCard() {
  const view = useRoomState((state) => {
    const device = state.devices.find((d) => d.id === DEVICE_ID);
    return screenView(state.display.screen, device?.online.value, device?.name ?? "Projection screen");
  });
  const locked = useViewOnly();
  const move = useCommand("screen", DEVICE_ID);

  return (
    <Card variant={view === undefined ? "solid" : CARD_VARIANT_FOR_TONE[view.tone]} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CardHeader title="Projection screen" tone={view?.tone ?? null} line={view?.stateLine ?? null} locked={locked} className="flex-1" />
        <CommandButton
          label={view?.action.label ?? "Raise"}
          size="primary"
          className="w-28 shrink-0"
          pending={move.pending}
          disabled={view === undefined || gateDisablesControl(move.gate) || view.actionBlocked}
          onPress={() => {
            if (view !== undefined) move.send({ kind: "screen.move", to: view.action.to });
          }}
        />
      </div>
      <InlineError message={move.error} />
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { ProjectorCard } from "./display/ProjectorCard";
```
   with:
```tsx
import { ProjectorCard } from "./display/ProjectorCard";
import { ScreenCard } from "./display/ScreenCard";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <ProjectorCard />
```
   with:
```tsx
        <ProjectorCard />
        <ScreenCard />
```

**Verify:** dev server as in T26. "Projection screen / Lowered" + "Raise". Tap Raise: "Moving…" (amber dot, button
dimmed) → ~1 s later "Raised" (grey dot) + "Lower". Panel "Screen position unknown": "Unknown", hollow ring, button
"Lower". Panel "Toggle screen offline": red line, button dimmed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): projection screen card on S1"`

### T28 — `LevelCard` ×2 (S1.E21/E22)
- [ ] done

**Files:** `apps/kiosk/src/features/control/audio/LevelCard.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Screenshot 01 middle column: title left, mono 24px value right, full-width `LevelSlider` below (track 8,
thumb 30 in a 48px hit area; full width at every size). SPEC §2.4: thumb follows the finger, throttled updates,
final value on release, other clients' changes ignored while dragging (all inside `LevelSlider`). Levels are sent with
`{ supersede: true }` (D4). While muted the first drag update unmutes all, once per mute (D7, H18, Q8b). Pending key
`audio.mic` / `audio.pc`, gate `audio`. Locked sliders call `unlock` on press (M03 T22).

States: loading (value skeleton, slider disabled) · normal (`62`) · Muted (value "Muted" in text-2, track at 40%,
thumb at the saved level) · dragging · pending (pulse) · H8 red line "Audio mixer offline · last known state" +
disabled · H6 · locked (padlock left of the value; a press opens S4).

**Do:**
1. Create `apps/kiosk/src/features/control/audio/LevelCard.tsx`:
```tsx
import type { AudioChannel } from "@eduscope/contracts";
import { useEffect, useRef } from "react";
import { Card } from "@/components/Card";
import { InlineError } from "@/components/InlineError";
import { LevelSlider } from "@/components/LevelSlider";
import { LockBadge } from "@/components/LockBadge";
import { ObservedLine } from "@/components/ObservedLine";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { levelView } from "./audio.view";

const DEVICE_ID = "audio";
const TITLES: Record<AudioChannel, string> = { mic: "Lecturer microphone", pc: "PC audio" };

/** S1.E21 / S1.E22: title + value, full-width slider (SPEC §2.4, H18). */
export function LevelCard({ channel }: { channel: AudioChannel }) {
  const view = useRoomState((state) => {
    const device = state.devices.find((d) => d.id === DEVICE_ID);
    const { audio } = state;
    return levelView(audio.channels[channel], audio.muted_all, audio.saved_levels[channel], device?.online.value, device?.name ?? "Audio mixer");
  });
  const locked = useViewOnly();
  const level = useCommand(`audio.${channel}`, DEVICE_ID);
  const muteAll = useCommand("audio.mute_all", DEVICE_ID);
  // H18 / Q8b: the first drag update while muted unmutes all first (once per mute).
  const unmuteSent = useRef(false);
  const muted = view?.muted === true;
  useEffect(() => {
    if (!muted) unmuteSent.current = false;
  }, [muted]);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h3 className="flex-1 text-card-title font-semibold text-text-1">{TITLES[channel]}</h3>
        {locked && <LockBadge />}
        {view === undefined ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <span className={cn("font-mono text-value font-semibold", view.muted ? "text-text-2" : "text-text-1")}>{view.valueText}</span>
        )}
      </div>
      <LevelSlider
        label={TITLES[channel]}
        value={view?.sliderValue ?? null}
        muted={muted}
        pending={level.pending}
        disabled={view === undefined || gateDisablesControl(level.gate)}
        onPressLocked={level.gate.reason === "locked" ? level.unlock : undefined}
        onChange={(next, final) => {
          if (muted && !unmuteSent.current) {
            unmuteSent.current = true;
            muteAll.send({ kind: "audio.mute_all", muted: false });
          }
          level.send({ kind: "audio.level", channel, level: next, final }, { supersede: true });
        }}
      />
      {view?.offlineLine != null && <ObservedLine tone="offline" text={view.offlineLine} />}
      <InlineError message={level.error} />
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { ScreenCard } from "./display/ScreenCard";
```
   with:
```tsx
import { ScreenCard } from "./display/ScreenCard";
import { LevelCard } from "./audio/LevelCard";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <SectionLabel>Audio</SectionLabel>
```
   with:
```tsx
        <SectionLabel>Audio</SectionLabel>
        <LevelCard channel="mic" />
        <LevelCard channel="pc" />
```

**Verify:** dev server, "Be kiosk". "Lecturer microphone 62" and "PC audio 38". Drag the PC thumb slowly from ~10 % to
~75 %: the thumb follows the pointer the whole way; on release the value settles at the release level (e.g. `74`)
within ~1.5 s and stays there. Tap the panel's "Phone changes PC audio (in 3 s)", then start dragging the PC slider
and keep holding for 4 s: the toast "PC audio set to … · from phone" appears and the value number changes, but the
thumb stays under the pointer; on release the thumb settles to the released level.
`pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): level cards on S1"`

### T29 — `MuteAllBar` (S1.E23)
- [ ] done

**Files:** `apps/kiosk/src/features/control/audio/MuteAllBar.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Screenshot 01: a full-column-width bar (radius 10, 56px tall, `h-14`), dot + label centred. Muted =
`warn-fill` + amber border + amber dot (`muteBarView`). Pending key `audio.mute_all` (shared with the LevelCard's
unmute-on-drag), gate `audio`. Padlock pinned right inside the bar.

States: loading (disabled, "Mute all audio") · unmuted · muted ("Unmute all audio") · pending · disabled (H2/H3/H8) ·
H6 · locked.

**Do:**
1. Create `apps/kiosk/src/features/control/audio/MuteAllBar.tsx`:
```tsx
import { InlineError } from "@/components/InlineError";
import { LockBadge } from "@/components/LockBadge";
import { StateDot } from "@/components/StateDot";
import {
  ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS, PENDING_CONTROL_CLASS,
} from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { muteBarView } from "./audio.view";

/** S1.E23: full column width, dot + label centred (R9, H18). */
export function MuteAllBar() {
  const view = useRoomState((state) => muteBarView(state.audio.muted_all));
  const locked = useViewOnly();
  const mute = useCommand("audio.mute_all", "audio");
  const pressed = usePressed();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        {...pressed}
        disabled={view === undefined || gateDisablesControl(mute.gate)}
        aria-pressed={view?.nextMuted === false}
        aria-busy={mute.pending}
        onClick={() => {
          if (view !== undefined && !mute.pending) mute.send({ kind: "audio.mute_all", muted: view.nextMuted });
        }}
        className={cn(
          "relative flex h-14 w-full items-center justify-center gap-3 rounded-card border-2 px-4 text-button font-semibold",
          "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
          view?.active ? ACTIVE_CONTROL_CLASS[view.active] : INACTIVE_CONTROL_CLASS,
          mute.pending && PENDING_CONTROL_CLASS,
          (view === undefined || gateDisablesControl(mute.gate)) && DISABLED_CONTROL_CLASS,
        )}
      >
        <StateDot tone={view?.dotTone ?? "unknown"} />
        {view?.label ?? "Mute all audio"}
        {locked && (
          <span className="absolute right-4">
            <LockBadge />
          </span>
        )}
      </button>
      <InlineError message={mute.error} />
    </div>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { LevelCard } from "./audio/LevelCard";
```
   with:
```tsx
import { LevelCard } from "./audio/LevelCard";
import { MuteAllBar } from "./audio/MuteAllBar";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <LevelCard channel="pc" />
```
   with:
```tsx
        <LevelCard channel="pc" />
        <MuteAllBar />
```

**Verify:** dev server, "Be kiosk". Tap "Mute all audio": bar turns amber "Unmute all audio", both values read
"Muted", tracks dim, thumbs stay at 62 / 38. Tap "Unmute all audio": values `62` / `38` again (R9). Mute again, then
drag the mic slider to ~30 %: the bar returns to "Mute all audio", PC audio shows `38` again and the mic settles at
the dragged level (H18). `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): mute-all bar on S1"`

### T30 — `LightsCard` (S1.E31–E33)
- [ ] done

**Files:** `apps/kiosk/src/features/control/environment/LightsCard.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Screenshot 01 right column top: header (green dot, "Lights", "Confirmed by the switch", mono `ZBM5` tag
right = the part of `device.model` before the first "-"), then the two existing `ToggleRow`s (whole ≥56px row is the
target; `gap-2`). Pending keys `lights.front` / `lights.rear`, gate `lights`. H8 card border `danger/40`.

States: loading (rows disabled, "—") · On (green track, "On" green) · Off (grey track, "Off" text-3) · pending ·
H8 "Switch offline · last known state" (red dot, rows disabled at 40%, last values kept) · H6 · locked.

**Do:**
1. Create `apps/kiosk/src/features/control/environment/LightsCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { InlineError } from "@/components/InlineError";
import { ToggleRow } from "@/components/ToggleRow";
import { CARD_VARIANT_FOR_TONE } from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { CardHeader } from "../CardHeader";
import { lightsView, nextLightOn } from "./lights.view";

const DEVICE_ID = "lights";

/** S1.E31–E33: the whole ≥56px row toggles (R6). */
export function LightsCard() {
  const lights = useRoomState((state) => state.environment.lights);
  const device = useRoomState((state) => state.devices.find((d) => d.id === DEVICE_ID));
  const locked = useViewOnly();
  const front = useCommand("lights.front", DEVICE_ID);
  const rear = useCommand("lights.rear", DEVICE_ID);
  const view = device === undefined ? null : lightsView(device.online.value);
  const tag = device?.model?.split("-")[0] ?? null; // "ZBM5-2C-86W" → "ZBM5"

  return (
    <Card variant={view === null ? "solid" : CARD_VARIANT_FOR_TONE[view.tone]} className="flex flex-col gap-3">
      <CardHeader
        title="Lights"
        tone={view?.tone ?? null}
        line={view?.line ?? null}
        locked={locked}
        aside={tag !== null && <span className="mt-1 font-mono text-caption font-semibold text-text-3">{tag}</span>}
      />
      <div className="flex flex-col gap-2">
        <ToggleRow
          label="Front of room"
          on={lights?.front.value ?? null}
          pending={front.pending}
          disabled={lights === undefined || gateDisablesControl(front.gate)}
          onToggle={() => front.send({ kind: "lights.set", gang: "front", on: nextLightOn(lights?.front.value ?? null) })}
        />
        <ToggleRow
          label="Rear of room"
          on={lights?.rear.value ?? null}
          pending={rear.pending}
          disabled={lights === undefined || gateDisablesControl(rear.gate)}
          onToggle={() => rear.send({ kind: "lights.set", gang: "rear", on: nextLightOn(lights?.rear.value ?? null) })}
        />
      </div>
      <InlineError message={front.error ?? rear.error} />
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { MuteAllBar } from "./audio/MuteAllBar";
```
   with:
```tsx
import { MuteAllBar } from "./audio/MuteAllBar";
import { LightsCard } from "./environment/LightsCard";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <SectionLabel>Environment</SectionLabel>
```
   with:
```tsx
        <SectionLabel>Environment</SectionLabel>
        <LightsCard />
```

**Verify:** dev server, "Be kiosk". Tap anywhere on the "Rear of room" row (including the label at the far left):
the row pulses, then the toggle goes green and "On". Panel "Change by hand": toast "Front of room turned off · by
hand" and the Front row turns Off. Panel "Toggle lights offline": red dot, "Switch offline · last known state", rows
dimmed and not tappable, red-tinted border. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): lights card on S1"`

### T31 — `AcCard` (S1.E34–E40)
- [ ] done

**Files:** `apps/kiosk/src/features/control/environment/AcCard.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Screenshot 01 right column middle: **always** `variant="dashed"` (the `border-dashed` token, R3); header
with the ring, "Air conditioning", state line, tag "IR REMOTE" (10px bold uppercase text-2); Power on / Power off
56px side by side; setpoint row on **one line at every width**: "Setpoint" label (`flex-1`), − (64×64, `size-16`),
value (`w-20`, mono 24), + (64×64). At 390 the row is 326px wide and fits. Pending keys `ac:on`, `ac:off`,
`ac:down`, `ac:up`; gate `ir_blaster` (D18).

States: loading · On · assumed (amber ring, Power on `warn-fill` + amber border) · Off · assumed (Power off neutral
highlight, value text-3, −/+ disabled) · Unknown (hollow grey ring, `—`, nothing highlighted, −/+ disabled) · − disabled
at the lowest captured setpoint, + at the highest (H19, 40%) · H25 red "IR blaster offline" + all disabled · pending ·
H6 · locked.

**Do:**
1. Create `apps/kiosk/src/features/control/environment/AcCard.tsx`:
```tsx
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { CardHeader } from "../CardHeader";
import { acView } from "./ac.view";

const BLASTER = "ir_blaster";

/** S1.E34–E40. The border is always dashed (R3: AC is assumed at best). */
export function AcCard() {
  const view = useRoomState((state) =>
    acView(state.environment.ac, state.devices.find((d) => d.id === BLASTER)?.online.value),
  );
  const locked = useViewOnly();
  const on = useCommand("ac:on", BLASTER);
  const off = useCommand("ac:off", BLASTER);
  const down = useCommand("ac:down", BLASTER);
  const up = useCommand("ac:up", BLASTER);

  return (
    <Card variant="dashed" className="flex flex-col gap-3">
      <CardHeader
        title="Air conditioning"
        tone={view?.tone ?? null}
        line={view?.stateLine ?? null}
        locked={locked}
        aside={<span className="mt-1 text-sensor-label font-bold uppercase text-text-2">IR remote</span>}
      />
      <div className="grid grid-cols-2 gap-3">
        <CommandButton
          label="Power on"
          size="primary"
          active={view?.powerOnActive ?? null}
          pending={on.pending}
          disabled={view === undefined || gateDisablesControl(on.gate)}
          onPress={() => on.send({ kind: "ac.power", on: true })}
        />
        <CommandButton
          label="Power off"
          size="primary"
          active={view?.powerOffActive ?? null}
          pending={off.pending}
          disabled={view === undefined || gateDisablesControl(off.gate)}
          onPress={() => off.send({ kind: "ac.power", on: false })}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-caption text-text-2">Setpoint</span>
        <CommandButton
          label="−"
          className="size-16 px-0 text-title"
          pending={down.pending}
          disabled={view?.canStepDown !== true || gateDisablesControl(down.gate)}
          onPress={() => down.send({ kind: "ac.step", direction: "down" })}
        />
        {view === undefined ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span className={cn("w-20 text-center font-mono text-value font-semibold", view.setpointDimmed ? "text-text-3" : "text-text-1")}>
            {view.setpoint}
          </span>
        )}
        <CommandButton
          label="+"
          className="size-16 px-0 text-title"
          pending={up.pending}
          disabled={view?.canStepUp !== true || gateDisablesControl(up.gate)}
          onPress={() => up.send({ kind: "ac.step", direction: "up" })}
        />
      </div>
      {view?.blasterLine != null && <p className="text-caption text-danger">{view.blasterLine}</p>}
      <InlineError message={on.error ?? off.error ?? down.error ?? up.error} />
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { LightsCard } from "./environment/LightsCard";
```
   with:
```tsx
import { LightsCard } from "./environment/LightsCard";
import { AcCard } from "./environment/AcCard";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <LightsCard />
```
   with:
```tsx
        <LightsCard />
        <AcCard />
```

**Verify:** dev server, "Be kiosk", panel "Restart controller (AC unknown)": "Unknown", hollow ring, `—`, −/+ dimmed,
dashed border. Power on → "On · assumed", amber ring, Power on amber, `24°`. Tap + six times → `30°` and + dimmed
(H19). Power off → "Off · assumed", value grey, −/+ dimmed. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): air conditioning card on S1"`

### T32 — `SensorsCard` (S1.E41–E45)
- [ ] done

**Files:** `apps/kiosk/src/features/control/environment/SensorsCard.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** Screenshot 01 right column bottom. The header row ("ROOM SENSORS" + dot + "3 reporting") is one
48px link to `/devices` (S1.E41 `[INFERRED]`), pulled into the card padding (`-mx-2 -mt-2`) to keep the height
budget. Tiles: `@container` on the card, `grid grid-cols-2 gap-x-2 gap-y-4 @min-[22rem]:grid-cols-4` → 4 across at
1280 (86px tiles), 2×2 at 1024, 800 and 390 (D16). Server time drives "· 14 min ago" (`useServerNow`, falls back to
the state's `server_time`). No padlock: nothing to control (D11).

States: loading (4 skeleton tiles) · fresh · stale (value text-3, caption "SNZB-02P · 14 min ago", count "2 of 3
reporting" amber dot) · no reading ("—" + "No reading yet") · offline (caption "· offline", H8/H9; count "No sensors
reporting" red dot when none) · Detected (green) · Clear · Open (amber) · Closed.

**Do:**
1. Create `apps/kiosk/src/features/control/environment/SensorsCard.tsx`:
```tsx
import { Link } from "react-router";
import { Card } from "@/components/Card";
import { SensorTile } from "@/components/SensorTile";
import { StateDot } from "@/components/StateDot";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { usePressed } from "@/lib/use-pressed";
import { Skeleton } from "@/ui/skeleton";
import { sensorsView } from "./sensors.view";

const TILE_KINDS = ["temperature", "humidity", "occupancy", "contact"] as const;

/** S1.E41–E45: header opens S2 (S1.E41); tiles 2×2 below `lg`, one row of four at `lg`. */
export function SensorsCard() {
  const now = useServerNow();
  const state = useRoomState((s) => ({ sensors: s.environment.sensors, devices: s.devices, serverTime: s.server_time }));
  const view = state === undefined ? null : sensorsView(state.sensors, state.devices, now ?? new Date(state.serverTime));
  const pressed = usePressed();

  return (
    <Card className="@container flex flex-col gap-2">
      <Link
        to="/devices"
        {...pressed}
        className="-mx-2 -mt-2 flex min-h-12 items-center justify-between gap-2 rounded-btn px-2 active:bg-surface-2 data-[pressed=true]:bg-surface-2"
      >
        <h3 className="text-section font-bold uppercase text-text-2">Room sensors</h3>
        {view === null ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <span className="flex items-center gap-2 text-caption text-text-2">
            <StateDot tone={view.reportingTone} />
            {view.reportingText}
          </span>
        )}
      </Link>
      <div className="grid grid-cols-2 gap-x-2 gap-y-4 @min-[22rem]:grid-cols-4">
        {view === null
          ? TILE_KINDS.map((kind) => <SensorTile key={kind} label={kind} value={null} caption="" loading />)
          : view.tiles.map((tile) => (
              <SensorTile
                key={tile.kind}
                label={tile.label}
                value={tile.value}
                caption={tile.caption}
                tone={tile.tone}
                numeric={tile.numeric}
                staleAgo={tile.suffix}
              />
            ))}
      </div>
    </Card>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { AcCard } from "./environment/AcCard";
```
   with:
```tsx
import { AcCard } from "./environment/AcCard";
import { SensorsCard } from "./environment/SensorsCard";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <AcCard />
```
   with:
```tsx
        <AcCard />
        <SensorsCard />
```

**Verify:** dev server at 1280×800: `26.4°  61%  Detected  Closed` in one row, captions `SNZB-02P`, `SNZB-02P`,
`SNZB-03P`, `SNZB-04PR2`, "● 3 reporting". Panel "Toggle climate stale": temperature and humidity grey with "· 14 min
ago", "2 of 3 reporting" amber. "Toggle door open": "Open" amber. "Door: no reading": "—" + "No reading yet". Tap the
header row → `/devices`. In DevTools at 1024 wide the tiles are 2×2 and nothing overlaps. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): room sensors card on S1"`

### T33 — Sticky header
- [ ] done

**Files:** `apps/kiosk/src/app/Header.tsx`

**Context:** Decision D9 (milestone note: section anchors must clear the sticky header). `z-30`: above page content
(same layer as BottomNav, which never overlaps it), below sheets (`z-50`) and the PIN overlay (`z-[100]`).

**Do:**
1. In `apps/kiosk/src/app/Header.tsx` replace:
```tsx
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
```
   with:
```tsx
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
```

**Verify:** dev server at 390×844: scroll down; the 56px header stays on top and cards pass under it. At 1280×800
nothing changes (no scroll). `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): sticky header"`

### T34 — S1.E4 status opens `/devices` (≥600)
- [ ] done

**Files:** `apps/kiosk/src/app/StatusIndicator.tsx`

**Context:** S1.E4 "On tap `[INFERRED]` Opens S2"; decision D14. The text becomes a 48px-tall link with a pressed
state; the phone dot button and its sheet are unchanged.

**Do:**
1. In `apps/kiosk/src/app/StatusIndicator.tsx` replace:
```tsx
import { useState } from "react";
```
   with:
```tsx
import { useState } from "react";
import { Link } from "react-router";
```
2. In `apps/kiosk/src/app/StatusIndicator.tsx` replace:
```tsx
import { cn } from "@/lib/utils";
```
   with:
```tsx
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
```
3. In `apps/kiosk/src/app/StatusIndicator.tsx` replace:
```tsx
/** S1.E4. ≥600: dot + text. <600: a 48×48 dot button that opens a bottom sheet with the text. */
export function StatusIndicator() {
  const status = useRoomState((state) => state.room.status);
  const [open, setOpen] = useState(false);
```
   with:
```tsx
/**
 * S1.E4. ≥600: dot + text, a link to S2 (`[INFERRED]` on tap). <600: a 48×48 dot button that opens
 * a bottom sheet with the text (SPEC §2.2).
 */
export function StatusIndicator() {
  const status = useRoomState((state) => state.room.status);
  const [open, setOpen] = useState(false);
  const pressed = usePressed();
```
4. In `apps/kiosk/src/app/StatusIndicator.tsx` replace:
```tsx
      <p className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-caption text-text-2 sm:flex">
        {dot}
        {text}
      </p>
```
   with:
```tsx
      <Link
        to="/devices"
        {...pressed}
        className="hidden min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-btn px-2 text-caption text-text-2 active:bg-control data-[pressed=true]:bg-control sm:flex"
      >
        {dot}
        {text}
      </Link>
```

**Verify:** dev server at 1280: click "All systems normal" → `/devices`. At 390: the dot still opens the "System
status" sheet. Re-run the M03 FX1 header check at 600, 1024 and 1280 with a technician session (Lock visible): icon
widths `20`, `true`, `0`. `pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): header status opens the devices page"`

### T35 — `BottomNav` (phone)
- [ ] done

**Files:** `apps/kiosk/src/features/control/BottomNav.tsx`, `apps/kiosk/src/features/control/ControlPage.tsx`

**Context:** SPEC §2.2 phone: three 48px segments "Display · Audio · Environment" that jump to each section,
`sm:hidden`. Decision D10 (`fixed`, the page already has `pb-14`). Each segment calls
`scrollIntoView({ block: "start" })`; the sections' `scroll-mt-18` keeps them below the sticky header (T33).

**Do:**
1. Create `apps/kiosk/src/features/control/BottomNav.tsx`:
```tsx
import { usePressed } from "@/lib/use-pressed";

export const CONTROL_SECTIONS = [
  { id: "display", label: "Display" },
  { id: "audio", label: "Audio" },
  { id: "environment", label: "Environment" },
] as const;

function Segment({ id, label }: { id: string; label: string }) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="h-12 text-button font-semibold text-text-2 active:bg-control data-[pressed=true]:bg-control"
    >
      {label}
    </button>
  );
}

/** SPEC §2.2 phone: a fixed bottom bar with three 48px segments that jump to each section. */
export function BottomNav() {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-header sm:hidden">
      {CONTROL_SECTIONS.map((section) => (
        <Segment key={section.id} id={section.id} label={section.label} />
      ))}
    </nav>
  );
}
```
2. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
import { SensorsCard } from "./environment/SensorsCard";
```
   with:
```tsx
import { SensorsCard } from "./environment/SensorsCard";
import { BottomNav } from "./BottomNav";
```
3. In `apps/kiosk/src/features/control/ControlPage.tsx` replace:
```tsx
        <SensorsCard />
      </section>
```
   with:
```tsx
        <SensorsCard />
      </section>
      <BottomNav />
```

**Verify:** dev server at 390×844 (touch emulation): a bar with three equal 48px segments at the bottom. Tap
"Environment": the page scrolls so "ENVIRONMENT" sits 16px under the header (its top at y = 72). "Display" scrolls
back. Scrolled to the end, the Room sensors card is fully above the bar. At 600 and wider the bar is gone.
`pnpm verify` → exit 0.

**Commit:** `git commit -m "feat(kiosk): phone bottom bar for S1 sections"`

### T36 — Decision record D-20 (height budget, no viewport lock, sensor container query)
- [ ] done

**Files:** `docs/decisions/D-20-s1-height-budget.md`

**Context:** CLAUDE.md: changing a decision needs a record in `docs/decisions/`. ARCHITECTURE §4.1 says S1 at `lg`
is `lg:h-dvh lg:overflow-hidden` and only `sm:`/`lg:` are used; this plan does neither (D8, D16). ARCHITECTURE itself
is not edited.

**Do:**
1. Create `docs/decisions/D-20-s1-height-budget.md`:
```md
# D-20 — S1 fits 1280×800 by height budget, not by locking the page

Date: 2026-10-13 · Milestone: M04 · Supersedes: ARCHITECTURE §4.1, the sentence "At 1280×800 `lg` must fit
without scrolling: page is `lg:h-dvh lg:overflow-hidden` with flex columns", and the rule "Only `sm:` and `lg:`
are used" for one element.

## Context

SPEC §2.2 requires S1 to fit 1280×800 with no scrolling. Locking the page to the viewport height at `lg` with
`overflow-hidden` also applies to every other `lg` window: a podium-PC browser at 1280×~650 or a 1024×700 laptop
would clip the bottom of the Environment column (Room sensors) with no way to reach it.

The four sensor tiles (S1.E42–E45) fit in one row in a 400px column (1280 wide) but not in a 314px column
(1024 wide). Viewport breakpoints cannot tell these apart because both are `lg`.

## Decision

1. S1 has a natural height. Cards follow a fixed vertical budget (header 64, `main` padding 24 + 24, section
   label 16 + 12, card gaps 12, primary buttons 56, AC −/+ 64, toggle rows 56, card padding 16). Measured at
   1280×800: the tallest column ends at 708px normally and at 768px in the worst state (blaster offline, stale
   captions, no reading), under 800. Shorter windows scroll normally.
2. The Room sensors tiles use a container query: `@container` on the card and
   `grid-cols-2 @min-[22rem]:grid-cols-4` on the tile grid (4 across when the card's inner width is at least
   352px, otherwise 2×2).

## Consequences

- No content is ever clipped. A future S1 element must fit in the budget's spare space (about 30px in the
  worst case) or the budget must be re-measured at 1280×800.
- Acceptance and review check "no scroll at 1280×800" by measurement
  (`document.documentElement.scrollHeight === 800`), not by CSS.
```

**Verify:** the file exists; `pnpm verify` → exit 0 (docs are not linted).

**Commit:** `git commit -m "docs: decision D-20 S1 height budget"`

### T37 — Acceptance walk-through (M04 criteria)
- [ ] done

**Files:** this plan file only (tick the boxes below; write any failure under `## Blockers` and stop).

**Context:** Every M04 acceptance criterion with the exact check. Start the dev server once:
`pnpm --filter @eduscope/kiosk dev`. "Kiosk" below = open the mock panel, tap "Be kiosk" (control without a PIN),
then collapse the panel ("Mock panel −") unless a step uses it. Use Chromium DevTools device mode for sizes
(1280×800, 1024×800, 800×1000, 390×844 with touch). The console one-liners are pasted into DevTools.

**Do:** check each item; tick it when it holds.

- [ ] **AC1 — 1280×800, three columns, no page scroll, matches screenshot 01.** Open `/?mock-panel`, collapse the
  panel. Console: `[document.documentElement.scrollHeight, innerHeight]` → `[800, 800]`. Compare with
  `reference/screens/01-control-page.png` column by column: DISPLAY (Podium PC "Selected, confirmed" | Smart board
  "Tap to select"; Projector "On · confirmed by draw" `287 W` Power on green | Power off; caption; Projection screen
  "Lowered" + Raise), AUDIO (Lecturer microphone `62`, PC audio `38`, "Mute all audio"), ENVIRONMENT (Lights "Confirmed
  by the switch" `ZBM5`, Front of room On, Rear of room Off; Air conditioning "On · assumed" `IR REMOTE` dashed, Power on
  amber, Setpoint − `24°` +; ROOM SENSORS "● 3 reporting", `26.4°` `61%` Detected Closed with model captions).
  Expected differences: primary buttons are 56px (SPEC §3.3), padlocks show for `view` (AC11).
- [ ] **AC2 — 800 and 390.** At 800×1000: console
  `[...document.querySelectorAll("main section")].filter(s=>s.id).map(s=>[s.id,Math.round(s.getBoundingClientRect().left)])`
  → `[["display",16],["audio",16],["environment",408]]`, Audio below Display. At 390×844 (touch): one column in the
  order Display → Audio → Environment; the bottom bar has three 48px segments that jump to each section (T35); source
  tiles and both power pairs side by side; sliders full width; AC row "Setpoint − 24° +" on one line; sensors 2×2.
  Console: `document.documentElement.scrollWidth === innerWidth` → `true`, and
  `[...document.querySelectorAll("main button, main a, main [role=slider], nav button")].filter(e=>{const r=e.getBoundingClientRect();return r.width<48||r.height<48}).length`
  → `0`.
- [ ] **AC3 — source tiles.** Kiosk. Tap "Smart board": "Switching…" with a pulsing border, then "Selected, confirmed";
  Podium PC "Tap to select". Tap Smart board again: no pulse, nothing sent. Panel "Source assumed": "Selected, assumed",
  amber border.
- [ ] **AC4 — projector.** Reload `/?mock-panel&time-scale=0.1`, kiosk. Power off, wait for "Standby · confirmed by draw"
  `3 W`. Power on: "Power on sent · waiting for draw" → "Warming up" (amber dot, live W) → "On · confirmed by draw" green
  `287 W`. Panel "No draw change (next IR)", Power off: ~9 s later "Power off sent · no change in draw" in amber.
  Panel "Toggle power meter offline": hollow ring, "— W", "Power meter offline · state unknown".
- [ ] **AC5 — screen.** "Raise" when Lowered; tap → "Moving…" → "Raised" with "Lower". Panel "Screen position unknown":
  "Unknown".
- [ ] **AC6 — sliders and mute.** Kiosk. Drag the mic thumb: it follows the pointer; on release the number settles to
  the released value. Panel "Phone changes PC audio (in 3 s)", then drag the PC slider and hold for 4 s: the toast
  appears, the thumb stays under the pointer until release. "Mute all audio" → "Unmute all audio" (amber), sliders
  dimmed, both values "Muted"; "Unmute all audio" → `62` / previous PC level again (R9).
- [ ] **AC7 — lights.** Tap the "Rear of room" label (far left of the row): it toggles. Panel "Change by hand": toast
  "Front of room turned … · by hand". Panel "Toggle lights offline": red dot, "Switch offline · last known state", rows
  disabled.
- [ ] **AC8 — AC.** Panel "Restart controller (AC unknown)": "Unknown", dashed border. Power on → "On · assumed", amber
  ring; − / + step 23° … 18° / 25° … 30°; − disabled at 18°, + at 30° (H19); Power off → both disabled.
- [ ] **AC9 — sensors.** Panel "Toggle climate stale": `26.4°` and `61%` grey with "· 14 min ago", header "2 of 3
  reporting" amber. Panel "Door: no reading": "—" + "No reading yet". "Toggle door open": "Open" amber.
- [ ] **AC10 — coordinator / blaster.** Panel "Toggle coordinator offline": header status red "Coordinator offline";
  Lights in H8; sensor captions "· offline", "No sensors reporting"; projector and AC IR buttons disabled with "IR blaster
  offline" (the ZS06 is a Zigbee device). Toggle back. Panel "Toggle blaster offline": projector and AC buttons
  disabled, both cards show "IR blaster offline" (H25); header amber "ZS06 offline".
- [ ] **AC11 — view-only.** Reload `/?mock-panel` (remote `view`). Console:
  `document.querySelectorAll("main [aria-label=Locked]").length` → `9` (2 tiles, Projector, Screen, 2 levels, Mute,
  Lights, AC). Tap Power off → "Enter room PIN"; enter `1234`: the projector did **not** change; tap again → it acts.
  Pressing a slider while locked also opens the PIN.
- [ ] **AC12 — `pnpm verify` green** and the selector tests exist: `projector.view.test.ts` (state line text),
  `ac.view.test.ts` (button enablement), `sensors.view.test.ts` (reporting text), `source-tiles.view.test.ts` (tile
  label), `screen.view.test.ts` (button label). `pnpm build` → exit 0 (the >500 kB chunk warning is M02-L1).

**Verify:** all 12 boxes ticked; `pnpm verify` → exit 0.

**Commit:** `git commit -m "chore: M04 acceptance walk-through"`

## Checkpoints

- After T13: "Human: nothing on S1 yet; skim `mock-rules.ts` (ramp + derived) and the new panel buttons (two minutes)."
- After T27: "Human: run `pnpm --filter @eduscope/kiosk dev`, open `/?mock-panel&time-scale=0.1`, Be kiosk; compare the
  DISPLAY column with screen 01 at 1280×800 and at 390×844; run the projector ramp once."
- After T32: "Human: compare the whole page with screen 01 at 1280×800 (no scroll) and 800×1000; check AUDIO and
  ENVIRONMENT states from the panel."
- After T35: "Human: 390×844 with touch: bottom bar jumps, sticky header, nothing hidden under the bar."

## Blockers

(executor writes here; leave empty)

## Nice-to-haves (not tasks)

- While dragging, show the dragged level in the value number too (today the number shows the server value and only
  the thumb follows the finger).
- Highlight the BottomNav segment of the section in view.
- Move toasts above the phone BottomNav (sonner `mobileOffset`), so a 4 s toast never covers the segments.
- Remove `app/dev/LiveDemo.tsx` from the component gallery now that S1 uses every component for real.
- Mock: reject `ac.step` while off at the HTTP level (like core-api's precondition error) instead of ignoring it.
- A "Stop" for the projection screen if Q2 says the driver has one.
