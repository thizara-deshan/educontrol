# D-21 — Every browser has a session row; Lock and expiry downgrade it in place

Date: 2026-10-14 · Milestone: M08 · Supersedes: ARCHITECTURE §5, the sentence "**Lock:** `POST /api/session/lock`
deletes the row (kiosk: drops back to `control`), clears the cookie, pushes `session` to that session's sockets."

## Context

`ClientSession.public_id` is required on every `GET /api/session` answer, and the kiosk ignores `activity` toasts
whose `public_id` is its own (H13). A browser that never unlocked still needs a stable `public_id`, and a browser
that locks must keep the same one, or it would toast its own commands after re-unlocking. The WS hub can push
`session` events (H24 expiry, Lock from another tab) only to sockets whose upgrade carried a session cookie.

## Decision

1. `GET /api/session` (and login, lock, commands) gives a browser without a valid cookie a `sessions` row at its
   baseline (remote `view`, kiosk `control`) and sets the signed `ec_sid` cookie (`HttpOnly; SameSite=Strict;
   Path=/`). Remote rows that stay `view` are deleted by the 15 s sweep 7 days after creation.
2. Lock and expiry **downgrade the row in place** (remote → `view`, kiosk → `control`; `unlocked_at`,
   `last_activity`, `expires_at` cleared). The row, cookie and `public_id` stay. The change is pushed as `session`.
3. The kiosk http adapter requests `GET /api/session` before it opens the WebSocket, so the upgrade carries the
   cookie and the hub can address that socket.

## Consequences

- One code path for "a session ended" (lock, idle expiry, M09 class-block end): downgrade + push.
- `sessions` also holds view-only browsers; S3b's client list (M09) comes from the WS hub, not from this table.
- A cookie is set for every visitor, including view-only ones. It carries no access by itself: access lives in the
  row and is re-checked on every request.
