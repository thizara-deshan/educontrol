# M05 — Devices page (S2)
Depends on: M04            Machine: Arch        Est: ½ day

## Goal
Build the read-only S2 Zigbee devices page so it matches screenshot 02 at 1280×800 and the phone
layout at 390px, rendering mesh, router, battery-device, coordinator and interlock state from
`RoomState`, including every degraded state.

## Scope
- `features/devices/`: `DevicesPage`, header variant (S2.E1–E4), `routers/` (LightingSwitchCard,
  ProjectorSocketCard with MetricTiles), `battery/` (table ≥600px, card list <600px), `side/`
  (CoordinatorCard, MeshCard, RedundancyCallout, InterlockCard).
- SPEC S2.E1–E23, phone layout for S2 (§2.2), H8, H9, H10, H11, H15, H16, R7, R11 (presentation),
  R13.
- Mock panel additions: router offline, battery low (≤20, ≤10), sensor stale, joining open with
  countdown, interlock holding/bypassed, coordinator starting/offline, no battery devices.

## Out of scope
Any control on S2 (read-only, Q11). Permit-join button (S3d, M06). Server mesh counting (M08).

## Acceptance criteria
1. At 1280×800 S2 matches screenshot 02: main column ~75% with the two router cards and the
   battery table, side column with Coordinator, Mesh, "TWO ROUTERS, NO SINGLE PATH", Shutdown
   interlock.
2. "← Controls" returns to S1; Settings goes through the technician gate (M03).
3. Router cards show model · friendly name in mono, "Router" badge, `LQI 214`/`231`; gang tiles
   On/Off; metrics `287 W` (green) · `231 V` · `1.84 kWh` · `13 A`.
4. Battery table rows Room climate, Motion, Door with reading, battery, link, last seen. Panel
   "battery 18%" → amber, "battery 8%" → red, header status degraded "Sensor battery low" (H16).
   Panel "stale" → last seen amber, reading `text-3` (H10). Panel "no battery devices" →
   "No battery devices paired".
5. Panel "lighting switch offline" → its card shows red dot and "Offline · last seen 5 min ago"
   instead of LQI; callout turns amber "ONE ROUTER LEFT" naming the lighting switch (R7).
6. Panel "coordinator offline" → S2.E3 red, coordinator values greyed (H9). "Joining open" →
   "Open · 4:12 left" in amber counting down.
7. Panel "interlock holding" → "Waiting for projector to cool · 112 W" (H15).
8. At 390px: header with back "Controls", title, coordinator dot, Settings icon; order routers →
   battery cards (3 lines each) → coordinator → mesh → callout → interlock; power metrics 2×2;
   no horizontal scroll.
9. `pnpm verify` green, with Vitest covering the S2 selectors (last-seen formatting, battery
   severity, callout variant, joining countdown text, empty state).

## Notes for the planner
- Battery list is the one place two markups in one component are allowed (ARCHITECTURE §4.1).
- Reuse `MetricTile`, `KeyValueRow`, `StateDot` from M02; don't fork them.
- "12s ago" relative times are computed from **server time** (offset), refreshed every second
  via one shared ticker, not one interval per row.
