/** Names of the design tokens in tokens.css (no values). Kept in sync by token-names.test.ts. */
export const COLOR_TOKENS = [
  "bg", "header", "surface", "surface-2", "control", "border", "border-strong", "border-dashed",
  "text-1", "text-2", "text-3", "accent", "accent-fill", "accent-border", "selected-fill",
  "toggle-on", "toggle-off", "knob", "warn", "warn-fill", "brand", "danger", "danger-fill",
  "callout-fill", "callout-border", "badge-router-fill", "badge-router-text", "sleep",
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const TYPE_TOKENS = [
  "wordmark", "clock", "date", "title", "section", "card-title", "caption", "button", "value",
  "sensor-label",
] as const;
export type TypeToken = (typeof TYPE_TOKENS)[number];

export const RADIUS_TOKENS = ["card", "btn", "chip"] as const;
export type RadiusToken = (typeof RADIUS_TOKENS)[number];
