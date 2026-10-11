# M06 — Settings (S3, S3b–S3e)
Depends on: M05            Machine: Arch        Est: 1 day

## Goal
Build the technician Settings area against the mock: the Remote configuration tab matching
screenshot 03 (IR devices, commands, capture and test flows), and the inferred Network,
Schedule, Devices (incl. PIN change and permit join) and About tabs. This completes the
frontend; the milestone ends at the FRONTEND COMPLETE GATE.

## Scope
- `features/settings/`: shell (S3.E1–E5 header + tabs, horizontally scrolling tab strip on phone
  with the active tab scrolled into view), `remote/` (S3.E6–E17), `network/` (S3b),
  `schedule/` (S3c), `devices/` (S3d), `about/` (S3e).
- Remote config: device list with counts (amber if any untested, Q22), "+ Add device" sheet
  (name, brand, transport ZS06/mcu, kind), BLASTER and FALLBACK cards, command table, "+ Add a
  command" sheet (AC: setpoint °C, mode, fan), HOW CAPTURE WORKS (verbatim copy; phone: first
  sentence + "More").
- Capture flow H21 (Listening… with 20 s countdown + Cancel → "Captured · now test it" / "Nothing
  received" + Try again), test flow H22 ("Did the {device} react?" Yes/No), untested H20, blaster
  offline H25 (Test/Re-learn disabled), R5, R8 ("via ZS06"/"via MCU").
- Phone master → detail via `/settings/remote/:deviceId` with back arrow.
- S3b read-only rows incl. connected clients. S3c class blocks + timed actions list with enable
  toggle, delete, "+ Add block"/"+ Add action" sheets. S3d device registry list + edit sheet
  (rename, transport, remove), "Permit joining" (starts the S2.E21 countdown), Room PIN / Technician
  PIN "Change" sheets using `PinPad`. S3e room, version, uptime, Pi model, QR for
  `http://r-101.local` + URL text, "Restart controller" with confirm dialog.
- Mock adapter: IR devices/commands store, learn (resolves after 3 s or times out via panel),
  test, test-result, schedule, devices, PIN change, network/about data, restart (simulates a
  disconnect + resync).
- Query keys `["ir","devices"]`, `["schedule"]`, `["devices"]`, `["system",…]`; WS `ir_capture`
  and `invalidate` handling.

## Out of scope
Server routes and persistence (M09). Editing network settings (SPEC: none in v1).

## Acceptance criteria
1. At 1280×800, `/settings/remote` matches screenshot 03: tabs, left column (Air conditioning
   `14`, Projector `2` selected, + Add device, BLASTER, FALLBACK), right column (Projector header,
   Power on/off rows with Test/Re-learn, + Add a command, HOW CAPTURE WORKS).
2. Re-learn on "Power on": row shows "Listening… point the remote at the ZS06 and press the
   button" with a 20 s countdown and Cancel; mock captures → "Captured · now test it" with Test
   highlighted; status "untested" amber and the device count turns amber.
3. Test → "Did the Projector react?" Yes → "Tuya code · tested ✓ just now"; No → "no reaction"
   in red. Panel "nothing received" → "Nothing received" + Try again; the old code is kept.
4. Panel "blaster offline" → BLASTER card red, Test/Re-learn disabled.
5. + Add device creates "Screen relay · Other · via MCU" in the list; + Add a command on AC with
   25 °C / cool / auto creates the row as "Not captured" and starts capture.
6. Network, Schedule, Devices, About tabs render with mock data; schedule add/toggle/delete and
   device rename persist within the mock session; Room PIN change requires 4 digits twice
   (confirm), Technician PIN 6; About shows a scannable QR that a phone camera reads as
   `http://r-101.local`.
7. "Restart controller" asks to confirm; confirming shows the reconnecting banner, then "Back
   online".
8. At 390px: tab strip scrolls inside itself; Remote config shows the device list first; tapping a
   device opens its commands with a back arrow; command rows are two lines with Test and Re-learn
   at half width, ≥48px tall.
9. Losing technician (mock panel "expire session") while on any settings tab navigates to `/`.
10. **FRONTEND COMPLETE GATE:** with `VITE_API_MODE=mock`, `pnpm --filter @eduscope/kiosk build
    && preview`, then click through S1, S2, S3–S3e and S4 in `chromium --kiosk
    --window-size=1280,800` and at 390px; no console errors.
11. `pnpm verify` green, with Vitest covering: capture/test row state machine, command status
    text mapping (all S3.E14 variants), device count colour rule, schedule time/day validation,
    PIN change confirm logic.

## Notes for the planner
- Use `qrcode` (SVG output) for the About QR; the URL comes from `AboutInfo.url`, not hardcoded.
- IR codes are never shown in the UI and never needed by the kiosk except as `captured: boolean`.
- Capture status arrives via the `ir_capture` WS event, not polling; the mock must emit it.
- Sheets/dialogs use shadcn `sheet`/`dialog` from `ui/`; on phone sheets open from the bottom.
- Settings content is technician-only data; queries must not run until `session.access ===
  "technician"` (they would 403 in M08).
