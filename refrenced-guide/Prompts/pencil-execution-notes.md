# Pencil Execution Notes — Practical Gotchas for .pen Design Work

> **Companion doc to [Prompt 09 — UI Design Plan](09-ui-design-plan.md).**
> Use it when executing design plans with the Pencil MCP and something behaves
> unexpectedly.
>
> ⚠️ **Reliability disclaimer:** these notes were captured while executing real
> design plans with a specific version of Pencil (mid-2026). Pencil updates
> frequently — **some of these issues may already be fixed**, and APIs/tool names
> may have changed. Treat this document as a troubleshooting aid when you hit a
> problem, **not** as the source of truth for Pencil. The source of truth is
> always the official Pencil documentation and the tool's own `get_guidelines`
> output. If a workaround here contradicts current Pencil docs, trust the docs.

## How to use this doc

Don't read it upfront and pre-apply every workaround — Pencil may have moved on.
Instead: execute your design plan normally, and when you hit one of the symptoms
below (timeouts creating files, black fills, question-mark icons, overflowing
text, files staying 0 bytes on disk), check the matching section.

---

## 1. Bootstrapping a new `.pen` file

`.pen` files are encrypted — they can't be scaffolded with normal filesystem
tools. Symptoms when "creating" one goes wrong: `open_document` on a non-existent
path **times out**, or Pencil silently creates a *new untitled* document at the
editor root instead of at your path.

**Working recipe:**

1. Pre-create a zero-byte placeholder at the exact target path with the shell:

   ```powershell
   New-Item -ItemType File -Path "designs/pages/my-page.pen" -Force | Out-Null
   ```

   (macOS/Linux: `mkdir -p designs/pages && touch designs/pages/my-page.pen`)

2. Call `open_document` with that exact path — the placeholder opens as a fresh
   empty Pencil document.
3. **Immediately** call `set_variables` with your full design token set (§2)
   **before** any `batch_design` calls.
4. Then create frames with `batch_design`.

## 2. Set design tokens per file, before any design ops

Tokens **do not propagate across files** — a `_tokens.pen` file does not make its
variables available to other files. Every new page/panel/dialog file needs its own
copy of the token set, applied via `set_variables` right after `open_document`.

Use *your* design system's values; the shape looks like:

```json
{
  "variables": {
    "color.background": { "type": "color", "value": "<your hex>" },
    "color.foreground": { "type": "color", "value": "<your hex>" },
    "color.primary":    { "type": "color", "value": "<your hex>" },
    "color.border":     { "type": "color", "value": "<your hex>" },
    "...all semantic colors your components reference...": {},

    "font.display": { "type": "string", "value": "<heading family>" },
    "font.body":    { "type": "string", "value": "<body family>" },

    "text.sm":  { "type": "number", "value": 14 },
    "text.base": { "type": "number", "value": 16 },

    "radius.md": { "type": "number", "value": 6 }
  }
}
```

**Why order matters:** if you `batch_design` first and `set_variables` after, the
earlier elements hard-code default fills (e.g. `#000000`) instead of storing
variable references — and they will **not** retroactively pick the variables up.
The only fix is to delete and recreate those frames.

**Alias tip:** if your plans use both `$font.heading` and `$font.display`, treat
them as synonyms and stay consistent within a file.

## 3. Font-weight variables: known quirk

`fontWeight` on a Pencil text node requires a **string** (`"600"`), but a
`weight.*` variable declared as `"type": "number"` gets locked to number and
can't be re-typed — subsequent `batch_design` calls fail with a type error.

**Workaround:** don't reference `$weight.*` variables in `fontWeight`. Pass
literal strings inline: `fontWeight: "400" / "500" / "600" / "700"`.

## 4. Lucide icon names

Some Lucide icon names in older docs/plans don't match the set bundled with
Pencil (Lucide renamed several around v0.300, e.g. `alert-triangle` →
`triangle-alert`, `check-circle` → `circle-check`). If an icon renders as the
fallback question-mark glyph, the name is wrong — check the current Lucide
catalogue for the renamed equivalent, or pick the closest semantic match for
icons that aren't bundled at all.

## 5. Text wrapping inside flex containers

Long text inside a flex container overflows its bounds unless you set **both**:

```text
textGrowth: "fixed-width",   // locks width, forces wrapping
width: "fill_container"      // consume the parent's available width
```

Apply to every multi-line description, banner, preview snippet, and body
paragraph. Short single-line labels (buttons, badges, headings) don't need it.

## 6. Icon-only buttons

Don't include a text-label child in a button meant to be icon-only — you'll get
overflow. Compact pattern: a small frame with `padding: [8, 10, 8, 10]` containing
just the `icon_font` node.

## 7. Fixed widths for rail/sidebar panels

Pick one explicit width convention for sidebar/rail panels (e.g. 380 px) and set
it on the outermost panel frame. Don't let `width: "fill_container"` blow a side
panel out to full canvas width.

## 8. Deterministic frame placement

For reproducible plans, place frames at fixed coordinates instead of relying on
find-empty-space tools: first frame at `x: 0, y: 0`, each next frame at
`y: prevY + prevHeight + 60`. Keeps documents scannable and runs repeatable.

## 9. Persisting `.pen` files to disk

Pencil holds documents in memory and **does not autosave**. After your design
calls, the on-disk file may still be 0 bytes even though `get_editor_state`
shows all frames. Switching documents does **not** flush to disk.

Reliable workflow: finish all design calls for a file, then save via the Pencil
UI (close the tab → **Save** prompt). Trust `get_editor_state` — not the on-disk
file size — as the source of truth for what's been edited until the save happens.

## 10. One file per surface

Each plan task lists its `File(s):` — keep that 1:1 mapping. Don't consolidate
multiple surfaces into one scratch `.pen` file; design files should pair cleanly
with the source files that implement them (e.g. `designs/pages/dashboard.pen` ↔
your dashboard page component). If a run accidentally merged surfaces, split them
before continuing.

## 11. Verification ritual after every task

Before marking a design task done:

1. `get_editor_state` — every expected top-level frame present, correctly named.
2. `snapshot_layout` (depth 0) — frame x/y/width/height match the plan.
3. `get_screenshot` per frame — eyeball fills, fonts, icons, wrapping. Watch for:
   - pure `#000000` fills → tokens were set too late (§2) → recreate the frame
   - question-mark icons → wrong icon name (§4)
   - text escaping its container → missing wrap properties (§5)
   - icon buttons with stray labels (§6)

## 12. Keep your own notes

When you discover a new pitfall in *your* project, append it to your project's
copy of this document in the same style — concrete symptom, cause, copy-pasteable
fix. (That's exactly how this document was born.)

---

*Generalized from execution notes captured on a real bootcamp project
(May 2026). The original, project-specific version — with the full token set and
project file names — lives in that repo at `docs/plans/ui/PENCIL-EXECUTION-NOTES.md`.*
