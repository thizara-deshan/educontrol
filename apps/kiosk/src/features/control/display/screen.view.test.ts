import type { Observed, ScreenPosition } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { screenView } from "./screen.view";

const screen = (value: ScreenPosition | null, confidence: Observed<ScreenPosition>["confidence"] = "confirmed"): Observed<ScreenPosition> => ({
  value, confidence, source: "switch", updated_at: null, stale: false, changed_by: null,
});

describe("screenView (S1.E17/E18)", () => {
  it("Lowered: green dot, button Raise", () => {
    expect(screenView(screen("lowered"), true, "Projection screen")).toEqual({
      tone: "confirmed", stateLine: "Lowered", action: { label: "Raise", to: "raise" }, actionBlocked: false,
    });
  });
  it("Raised: grey dot, button Lower", () => {
    expect(screenView(screen("raised"), true, "Projection screen")).toEqual({
      tone: "off", stateLine: "Raised", action: { label: "Lower", to: "lower" }, actionBlocked: false,
    });
  });
  it("Moving…: amber dot, button blocked", () => {
    expect(screenView(screen("moving"), true, "Projection screen")).toMatchObject({ tone: "warning", stateLine: "Moving…", actionBlocked: true });
  });
  it("Unknown: hollow ring, button Lower", () => {
    expect(screenView(screen("unknown", "unknown"), true, "Projection screen")).toMatchObject({
      tone: "unknown", stateLine: "Unknown", action: { label: "Lower", to: "lower" },
    });
  });
  it("assumed position says so", () => {
    expect(screenView(screen("lowered", "assumed"), true, "Projection screen")).toMatchObject({ tone: "assumed", stateLine: "Lowered · assumed" });
  });
  it("device offline (H8)", () => {
    expect(screenView(screen("lowered"), false, "Projection screen")).toMatchObject({
      tone: "offline", stateLine: "Projection screen offline · last known state", action: { label: "Raise", to: "raise" },
    });
  });
});
