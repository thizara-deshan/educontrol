# Prompt 01 — Screens → Spec

> **Setup** · run once · **Model:** Opus 5.5 · new session
> **Inputs:** `reference/screens/*.png`, `reference/prototype/` (if any), your answers
> **Output:** `docs/SPEC.md`

## When to use
First step. It turns the prototype screenshots into a written spec that every later
prompt can point to: what's on each screen, every state, every interaction, and the
domain data behind them.

## Variables
```
{{PI_DISPLAY}}   — e.g. "Pi 5, 7\" official touchscreen 1280x800 landscape" or "headless"
{{LAN_CLIENTS}}  — e.g. "lecturer phones, podium PC browser, technician laptop"
{{ROOM_ID}}      — e.g. "R-101"
{{EXTRA_NOTES}}  — anything you know that the screens don't show (or "none")
```

## The prompt
````text
You are a senior product engineer writing the build spec for a Raspberry Pi
touchscreen kiosk called "Eduscope Central". It controls a classroom's display,
audio, lights, air conditioning, and sensors.

### Inputs
- Every image in `reference/screens/` (look at each one carefully, at full detail).
- `reference/prototype/` if it exists. Its source is authoritative for exact
  colors, sizes, and copy.
- Pi display: {{PI_DISPLAY}}. Room: {{ROOM_ID}}. Notes: {{EXTRA_NOTES}}.
- The UI is served by the Pi to ANY browser on the same network
  ({{LAN_CLIENTS}}), not only to the Pi's own screen.

IGNORE the viewer chrome visible in the screenshots (the top bar with
"Eduscope Central kiosk UI", "Share", "Can view", the "← Control page" breadcrumb
bar, and the "Fill / Fit" buttons). That is the prototype viewer, not our app.

### Process
1. **Screen inventory.** For each screen: purpose, route, layout grid (columns,
   approximate proportions), and header contents.
2. **Element inventory.** For every element, in reading order: what it is, the
   data it shows, every visible state (on/off, selected, confirmed/assumed,
   online/offline), and what happens on tap. Note copy verbatim.
3. **Hidden states.** List states the screens imply but don't show: loading,
   hardware offline, command in flight, command failed, sensor stale, no data.
   Propose how each looks, consistent with the existing visual language.
4. **Unshown screens.** Settings has tabs (Network, Schedule, Devices, About)
   that aren't shown, and the Devices page is cut off at the bottom (battery
   devices table, "Shutdown interlock" card). Spec them minimally and mark
   them `[INFERRED]`.
5. **Design tokens.** Extract the palette (background, surface, border, text
   levels, accent green, warning amber, brand red), typography (UI font,
   monospace for numbers/IDs), radii, spacing, and touch target sizes. Give
   hex estimates and mark them `[ESTIMATED]` unless they came from prototype source.
6. **Domain model.** Derive the entities (Room, Device, Channel/Output,
   Sensor reading, IR command, Zigbee node, Coordinator…) with fields and
   enums. Model state *confidence* explicitly: the UI distinguishes
   "confirmed" (read back from hardware), "assumed" (IR sent, no feedback),
   and unknown.
7. **Interactions & rules.** Every user action → expected command → expected
   feedback. Include the domain rules stated on screen (e.g. projector
   >50 W = running, <5 W = standby; AC setpoints are separate captured
   frames, not +/- commands; "test every captured code").
8. **Clients & access.**
   - Client types: the Pi's own screen (if any) and remote browsers on the
     LAN (phone, laptop). For each screen, describe the phone-width (390px)
     layout: column stacking order, what collapses, and what stays reachable
     with one thumb.
   - Touch-first everywhere: no hover-only affordances, ≥48px targets.
   - Access: anyone on the LAN can load the URL. Propose (a) a room PIN that
     unlocks control for a remote browser, (b) a technician PIN for
     Settings, (c) whether the Pi's own screen skips the room PIN, (d) how a
     session ends. Add a PIN screen to the screen inventory `[INFERRED]`.
   - Multi-client: two people control at once. The UI must always show the
     current hardware state pushed from the server, not the local tap.
   - Connection states: server unreachable, reconnecting, and resynced
     (a phone waking from sleep).
   - The Pi's own screen (if any): no text selection, screen sleep/wake.
9. **Open questions.** Everything you couldn't determine.

### Output — `docs/SPEC.md`
Sections: 1 Overview · 2 Clients, access & layout · 3 Design tokens ·
4 Screens (one subsection per screen with element table:
| Element | Data | States | On tap | Notes |) · 5 Hidden states ·
6 Domain model · 7 Interactions & rules · 8 Open questions.

Give each screen and element an ID (S1, S1.E3…) so later docs can reference them.

### Rules
- Describe only what the screens show or clearly imply. Mark anything else
  `[INFERRED]` and keep it minimal.
- No implementation detail (no file paths or libraries). That belongs to prompt 02.
- Copy UI text exactly.

### Gate
First present: the screen inventory, the domain model summary, and the open
questions. STOP and wait for my answers. Then write the full file.
````

## Gate checklist
- [ ] Every element in every screenshot appears in an element table
- [ ] Confirmed/assumed/unknown state is part of the domain model
- [ ] Phone layout and PIN/access rules are decided (not left open)
- [ ] Open questions are answered or explicitly deferred
- [ ] Commit: `git commit -am "docs: SPEC"`
