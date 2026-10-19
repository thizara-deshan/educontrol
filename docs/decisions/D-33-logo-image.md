# D-33 — S1.E1 is the eduscope CENTRAL logo image

Date: 2026-10-19 · Status: **requested by the owner 2026-10-19** · Supersedes: SPEC S1.E1 (text wordmark
"eduscope" + "CENTRAL").

## Decision

S1.E1 shows the owner's logo, `apps/kiosk/src/assets/eduscope-central-logo.png` (1423×244, white "eduscope" and
red "CENTRAL" on transparent), 32 px tall from `sm:`, 24 px on phones, left-aligned. On a phone it scales down to
the width the header buttons leave. Alt text "eduscope CENTRAL".

## Consequences

- The colours are in the image, not in `tokens.css`; the header background must stay dark for the white text.
