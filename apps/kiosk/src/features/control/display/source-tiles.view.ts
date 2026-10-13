import type { HdmiInput, Observed } from "@eduscope/contracts";
import type { ActiveVariant, StateTone } from "@/components/state-styles";

// S1.E11 / S1.E12 source tiles (R10: exactly one input is active).

export const SOURCE_TILES: readonly { input: HdmiInput; label: string }[] = [
  { input: "podium_pc", label: "Podium PC" },
  { input: "smart_board", label: "Smart board" },
];

export interface SourceTileView {
  caption: "Selected, confirmed" | "Selected, assumed" | "Switching…" | "Tap to select";
  /** Caption colour; `null` = plain caption (text-2). */
  captionTone: StateTone | null;
  /** Tile fill: `selected` (teal + green border), `assumed` (amber border), `null` (neutral). */
  active: ActiveVariant | null;
  /** This input is the selected one: a tap does nothing. */
  selected: boolean;
}

export function sourceTileView(source: Observed<HdmiInput>, input: HdmiInput, pending: boolean): SourceTileView {
  const selected = source.value === input;
  if (selected && source.confidence === "confirmed") {
    return { caption: "Selected, confirmed", captionTone: "selected", active: "selected", selected };
  }
  if (selected) return { caption: "Selected, assumed", captionTone: "assumed", active: "assumed", selected };
  if (pending) return { caption: "Switching…", captionTone: null, active: null, selected };
  return { caption: "Tap to select", captionTone: null, active: null, selected };
}
