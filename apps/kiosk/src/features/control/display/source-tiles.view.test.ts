import type { HdmiInput, Observed } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { sourceTileView } from "./source-tiles.view";

const source = (value: HdmiInput | null, confidence: Observed<HdmiInput>["confidence"] = "confirmed"): Observed<HdmiInput> => ({
  value, confidence, source: "hdmi_switch", updated_at: null, stale: false, changed_by: null,
});

describe("sourceTileView (S1.E11/E12)", () => {
  it("the selected, confirmed input", () => {
    expect(sourceTileView(source("podium_pc"), "podium_pc", false)).toEqual({
      caption: "Selected, confirmed", captionTone: "selected", active: "selected", selected: true,
    });
  });
  it("the other input reads Tap to select", () => {
    expect(sourceTileView(source("podium_pc"), "smart_board", false)).toEqual({
      caption: "Tap to select", captionTone: null, active: null, selected: false,
    });
  });
  it("a pending tile reads Switching…", () => {
    expect(sourceTileView(source("podium_pc"), "smart_board", true).caption).toBe("Switching…");
  });
  it("selected but unconfirmed reads Selected, assumed with the amber fill", () => {
    expect(sourceTileView(source("smart_board", "assumed"), "smart_board", false)).toEqual({
      caption: "Selected, assumed", captionTone: "assumed", active: "assumed", selected: true,
    });
  });
  it("no input known: both tiles read Tap to select", () => {
    expect(sourceTileView(source(null, "unknown"), "podium_pc", false).caption).toBe("Tap to select");
  });
});
