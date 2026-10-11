# M02 — App shell & data layer
Depends on: M01            Machine: Arch        Est: 1 day

## Goal
Build everything the screens stand on: routing, the app shell and header, the responsive frame,
the `ApiClient` with a realistic mock room that pushes the same events the real server will,
the connection state machine and banner, the pending-command flow, attributed toasts and the
shared components. At the end the app navigates between placeholder pages, shows live mock state
in the header, and survives a simulated disconnect/resync.

## Scope
- ARCHITECTURE §4.1 (frame), §4.3 (routing), §4.4 (ApiClient, adapters, query keys), §4.5
  (realtime), §4.6 (command flow), §4.8 (layering).
- `app/`: `router.tsx` (all routes from §4.3; S1/S2/S3 pages are placeholders), `providers.tsx`
  (QueryClient, ApiClient context), `AppShell`, `Header`, `ConnectionBanner`, `Toaster` (sonner),
  `ErrorBoundary`.
- Header: S1.E1 wordmark, S1.E2 clock + S1.E3 date (server time via offset), S1.E4 status slot
  (dot + text; phone: dot only, tap opens a sheet with the text), S1.E5 room chip, S1.E6
  Devices, S1.E7 Settings (navigates; technician gate is M03). Phone variant per SPEC §2.2.
- `data/`: `api-client.ts`, `adapters/mock/` (`FakeRoom` seeded from
  `fixtures/state/room-normal.json`, 200–600 ms latency, emits `snapshot`/`state`/`command`/
  `activity`), `adapters/http/` (fetch + WS, typed and zod-parsed — exercised by tests only
  until M08), `query-keys.ts`, `realtime/connection.ts` + `apply-event.ts`,
  `commands/` (pending store, `useCommand`).
- Mock dev panel (`?mock-panel`): drop connection, make unreachable (>10 s), restore,
  "change from phone", "change by hand", toggle a device offline, fail next command, time out next
  command.
- `lib/`: `store.ts` (useSyncExternalStore helper), server-time offset, formatters (time
  `HH:mm`, date `ddd d MMM`, watts, °C, %), `client-label.ts`.
- `components/`: `state-styles.ts`, `StateDot`, `ObservedLine`, `Card` (solid/dashed/danger),
  `SectionLabel`, `CommandButton` (pending pulse, active variants confirmed/assumed/neutral),
  `ToggleRow`, `LevelSlider` (drag rules incl. throttle), `SensorTile`, `MetricTile`,
  `KeyValueRow`, `InlineError` (6 s), `LockBadge`, `DashedAddButton`, `Skeleton` usage.
- `useControlGate()` (connection + access + device online).
- SPEC: §2.4, §2.5, §3.4, S1.E1–E7, S1.E9, S5, H1–H6b, H13, R12.

## Out of scope
PIN overlay, sessions, Lock, kiosk idle (M03). Real S1/S2/S3 content (M04–M06). core-api.

## Acceptance criteria
1. `/`, `/devices`, `/settings/remote` … `/settings/about` each render a placeholder inside the
   shell; unknown paths redirect to `/`; browser back/forward works.
2. At 1280×800 the header matches screenshot 01 (wordmark, `10:42`-style clock, date, "● All
   systems normal", `R-101`, Devices, Settings). At 390px it is one 56px row, clock/date hidden,
   icon-only buttons ≥48×48, status shows only a dot and tapping it opens a sheet with the text.
3. On first load the header status reads "Connecting…" and value slots show skeletons (H1) until
   the mock snapshot arrives.
4. Mock panel "drop connection": amber "Reconnecting…" banner appears, all controls on the
   component demo page disable and grey but keep values (H3). After 10 s it turns red "Can't
   reach R-101 controller" with a 48px Retry (H2). "Restore" → green "Back online" for 2 s, then
   hidden (H4).
5. With DevTools, set the tab hidden then visible while the mock is "dropped and restored": the
   client reconnects immediately and shows the snapshot values, not the pre-drop values.
6. A temporary `/dev/components` route (dev builds only) shows every shared component in each
   state from SPEC §3.4 (confirmed, selected, assumed, off, unknown, stale, offline, pending).
7. Tapping a `CommandButton` on the demo page shows the pulsing pending border, the label does not
   change; the value changes only when the mock pushes `state`. Repeat taps while pending are
   ignored. "Fail next command" → red inline error for 6 s (H6a); "Time out next command" → "No
   response · tap to retry" (H6b).
8. Mock panel "change from phone" → toast "Rear of room turned on · from phone" at the bottom for
   4 s (H13).
9. `pnpm verify` green, with Vitest covering: `apply-event` (each event type, stale `rev`
   dropped, snapshot clears pending), connection state machine (fake timers: backoff sequence,
   10 s unreachable, visibility resync), pending store, `state-styles` mapping, `LevelSlider`
   throttle logic, formatters, `client-label`, http adapter parsing (with a stubbed `fetch`).

## Notes for the planner
- Add: `react-router` v7, `@tanstack/react-query`, `sonner` (via shadcn), `lucide-react`.
- The mock must go through the **same** `apply-event` path as the http adapter; never let the
  mock write the query cache directly.
- `["state"]`: `staleTime: Infinity`, `refetchOnWindowFocus: false`.
- Slider throttle 200 ms, `final:true` on release; incoming state ignored for that channel while
  dragging (SPEC §2.4).
- The mock approximates domain rules in its own code; never import from `apps/core-api`.
- Keep `features/` empty except placeholders; shared pieces go to `components/`.
- Pressed state on touch-down: `active:` plus a `data-pressed` attribute set on `pointerdown`.
