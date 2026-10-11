# M03 — Access & kiosk behaviour
Depends on: M02            Machine: Arch        Est: ½ day

## Goal
Add the client side of access control and the kiosk-only behaviour, against the mock: the PIN
overlay, session state, Lock, view-only padlocks, the technician gate on Settings, session
expiry, and the kiosk's idle dim/blank with a wake-tap guard. The UI only reflects access;
enforcement arrives with core-api in M08.

## Scope
- ARCHITECTURE §4.7, §5 (client view only).
- `features/pin/`: `PinOverlay` (S4.E1–E5), `PinPad` (64×64 keys; phone: keypad in the lower
  half), dots (4 or 6), auto-submit, wrong-PIN shake + "Wrong PIN", lockout countdown "Too many
  tries · wait 0:58" from `retry_after_s` (H17), Cancel.
- `useRequireAccess(level)` → `ensure()`; the tapped action is **not** replayed after unlock.
- `features/session/`: Lock button (S1.E8, remote `control`/`technician` only), `session` query,
  `session` WS event handling, expiry toast "Locked · enter PIN to control" (H24), leaving
  `/settings/*` → `/` when technician is lost.
- Settings guard on all `/settings/*` routes (S1.E7, S2.E4): technician PIN, cancel → `/`.
- View-only presentation (H12): `useControlGate` returns `locked`; padlock on card headers via
  `LockBadge`; tapping a locked control opens S4 with the room PIN.
- Mock adapter: sessions (room PIN `1234`, technician `123456`), 5 wrong → 60 s lockout, expiry
  simulation in the mock panel ("expire session"), "be kiosk" / "be remote" toggle.
- `features/kiosk/` (client_type `kiosk` only): 2 min idle → navigate `/` + drop technician;
  5 min → dim overlay (80% black); 15 min → black; first tap while dimmed/blank only wakes
  (capture-phase `pointerdown`, R15); occupancy `detected` transition wakes (H23).
- Touch hardening (SPEC §2.6), all clients: `touch-action: manipulation`, no hover-only
  affordances audit; kiosk only: `user-select:none`, `-webkit-touch-callout:none`,
  `cursor:none`, context menu prevented.
- SPEC: §2.3, §2.6, S1.E7 (gate), S1.E8, S3.E3 (Lock beside), S4.E1–E5, H12, H17, H23, H24, R14,
  R15.

## Out of scope
Server-side enforcement, cookies, throttling (M08). OS-level screen blanking and Chromium flags
(M10).

## Acceptance criteria
1. As remote `view` (mock default): the component demo controls show a padlock; tapping one opens
   "Enter room PIN" with 4 dots; `1234` unlocks, the overlay closes, the control did **not** fire,
   a second tap fires it.
2. Five wrong room PINs → keypad disabled, "Too many tries · wait 0:59" counting down; it
   re-enables at 0.
3. Header Settings while not technician → "Technician PIN" with 6 dots; `123456` → `/settings/remote`;
   Cancel → stays on `/` in `view`/`control`. Typing `/settings/network` in the URL bar triggers
   the same gate.
4. As remote `control`, a Lock button appears in the header; tapping it drops to `view` in place
   (no navigation); on `/settings/*` it navigates to `/`.
5. Mock panel "expire session" → toast "Locked · enter PIN to control", padlocks return (H24).
6. Mock panel "be kiosk": no Lock button, controls usable without PIN, Settings still asks for the
   technician PIN.
7. As kiosk with shortened timers (`?idle-scale=0.01`): after the scaled 2 min the app returns to
   `/` and technician is dropped; after 5 min the screen dims; after 15 min it is black. The first
   tap on a dimmed screen wakes it and a control under the finger does **not** fire. Mock panel
   "occupancy detected" wakes it.
8. At 390px the PIN keypad sits in the lower half of the screen with 64×64 keys; at 1280×800 it
   is a centred overlay.
9. `pnpm verify` green, with Vitest covering: PIN input reducer (auto-submit, backspace, lockout
   countdown), `useRequireAccess` decision table, kiosk idle timer state machine (fake timers),
   wake-tap guard swallowing exactly one event.

## Notes for the planner
- Client-side role checks are UX only (CLAUDE.md). Write the guard so M08 only swaps the mock
  session for the real `/api/session`; no UI change.
- Idle timers must be injectable (`idle-scale` dev param or a constructor option) so tests and
  manual checks don't wait 15 minutes.
- The kiosk/remote decision comes from `session.client_type` (server-decided), never from the
  user agent.
- The wake overlay must cover everything including the PIN overlay and toasts.
