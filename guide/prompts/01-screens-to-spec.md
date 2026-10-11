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
{{PI_DISPLAY}}   — e.g. "Pi 5, 7\" official touchscreen 1280x800 landscape" (or "unknown")
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
- Target display: {{PI_DISPLAY}}. Room: {{ROOM_ID}}. Notes: {{EXTRA_NOTES}}.

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
8. **Kiosk constraints.** Touch-only, no hover, no text selection, no
   scrolling on the Control page if it can be avoided, screen sleep/wake, and
   technician access for Settings (propose a PIN gate if one isn't shown).
9. **Open questions.** Everything you couldn't determine.

### Output — `docs/SPEC.md`
Sections: 1 Overview · 2 Display & kiosk constraints · 3 Design tokens ·
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
- [ ] Open questions are answered or explicitly deferred
- [ ] Commit: `git commit -am "docs: SPEC"`
