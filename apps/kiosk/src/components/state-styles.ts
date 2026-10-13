import type { Confidence } from "@eduscope/contracts";

// SPEC §3.4 state language in ONE place (ARCHITECTURE §4.2). Components never pick state
// colours themselves; they ask for a tone and use these class maps. Literal strings only, so
// Tailwind generates every class.

/**
 * `warning` is the solid amber dot SPEC uses outside the assumed ring: projector warming up /
 * cooling down (H14), "no change in draw" (H7b), audio muted (S1.E23), "2 of 3 reporting"
 * (S1.E41), screen moving. Callers pick it explicitly; `stateTone()` never returns it.
 */
export type StateTone = "confirmed" | "selected" | "assumed" | "warning" | "off" | "unknown" | "offline";

export interface StateInput {
  confidence: Confidence;
  /** The value means on / active / detected. */
  active: boolean;
  /** A choice that is the current one (source tile, S3 device). */
  selected?: boolean;
  /** The device is offline or the command failed. */
  offline?: boolean;
  /** `false` when the observed value is null (never reported). */
  hasValue?: boolean;
}

/** Priority: offline > unknown > assumed > selected > confirmed (active) > off. */
export function stateTone(input: StateInput): StateTone {
  if (input.offline === true) return "offline";
  if (input.confidence === "unknown" || input.hasValue === false) return "unknown";
  if (input.confidence === "assumed") return "assumed";
  if (input.selected === true) return "selected";
  return input.active ? "confirmed" : "off";
}

/** Dot (StateDot). Hollow rings for assumed and unknown. */
export const DOT_CLASS: Record<StateTone, string> = {
  confirmed: "bg-accent",
  selected: "bg-accent",
  assumed: "border-2 border-warn bg-transparent",
  warning: "bg-warn",
  off: "bg-text-3",
  unknown: "border-2 border-text-3 bg-transparent",
  offline: "bg-danger",
};

/** State text (ObservedLine, "On"/"Off" labels). */
export const TEXT_CLASS: Record<StateTone, string> = {
  confirmed: "text-accent",
  selected: "text-accent",
  assumed: "text-warn",
  warning: "text-warn",
  off: "text-text-3",
  unknown: "text-text-3",
  offline: "text-danger",
};

/** Card border variants (SPEC §3.4 "Card border" column) and which tone uses which. */
export type CardVariant = "solid" | "dashed" | "danger";
export const CARD_VARIANT_CLASS: Record<CardVariant, string> = {
  solid: "border-border",
  dashed: "border-dashed border-border-dashed",
  danger: "border-danger/40",
};
export const CARD_VARIANT_FOR_TONE: Record<StateTone, CardVariant> = {
  confirmed: "solid",
  selected: "solid",
  assumed: "dashed",
  warning: "solid",
  off: "solid",
  unknown: "dashed",
  offline: "danger",
};

/** Stale (H10): dot at 40%, value in text-3. Applied on top of the tone. */
export const STALE_DOT_CLASS = "opacity-40";
export const STALE_TEXT_CLASS = "text-text-3";

/** CommandButton fills. Always border-2 so switching state never shifts layout. */
export type ActiveVariant = "confirmed" | "selected" | "assumed" | "neutral";
export const ACTIVE_CONTROL_CLASS: Record<ActiveVariant, string> = {
  confirmed: "border-accent-border bg-accent-fill text-text-1",
  selected: "border-accent-border bg-selected-fill text-text-1",
  assumed: "border-warn bg-warn-fill text-text-1",
  neutral: "border-text-2 bg-surface-2 text-text-1",
};
export const INACTIVE_CONTROL_CLASS = "border-border-strong bg-control text-text-1";
/** H5: the tapped control's border pulses text-2; its label does not change. */
export const PENDING_CONTROL_CLASS = "animate-pending";
/** H19 and every disabled control: 40% opacity, no pointer events. */
export const DISABLED_CONTROL_CLASS = "pointer-events-none opacity-40";

/** H2/H3: last known values stay visible but greyed (applied to the page while not live). */
export const GREYED_CLASS = "opacity-60 grayscale";

/** S1.E4 room status dot. */
export type StatusLevel = "normal" | "degraded" | "fault" | "connecting";
export const STATUS_DOT_CLASS: Record<StatusLevel, string> = {
  normal: "bg-accent",
  degraded: "bg-warn",
  fault: "bg-danger",
  connecting: "border-2 border-text-3 bg-transparent",
};

/** Sensor/metric value accents (S1.E44 "Detected", S1.E45 "Open", S2 power). */
export type ValueTone = "default" | "accent" | "warn" | "danger";
export const VALUE_TONE_CLASS: Record<ValueTone, string> = {
  default: "text-text-1",
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
};
