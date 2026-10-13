import type { Observed } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { levelView } from "./audio.view";

const obs = <T,>(value: T | null): Observed<T> => ({
  value, confidence: "confirmed", source: "mixer", updated_at: null, stale: false, changed_by: null,
});

describe("levelView (S1.E21/E22)", () => {
  it("shows the server level", () => {
    expect(levelView(obs(62), obs(false), null, true, "Audio mixer")).toEqual({
      valueText: "62", sliderValue: 62, muted: false, offlineLine: null,
    });
  });
  it("muted: value Muted, thumb at the saved level (H18)", () => {
    expect(levelView(obs(0), obs(true), 62, true, "Audio mixer")).toEqual({
      valueText: "Muted", sliderValue: 62, muted: true, offlineLine: null,
    });
  });
  it("unknown level reads —", () => {
    expect(levelView(obs<number>(null), obs(false), null, true, "Audio mixer").valueText).toBe("—");
  });
  it("mixer offline (H8)", () => {
    expect(levelView(obs(62), obs(false), null, false, "Audio mixer").offlineLine).toBe("Audio mixer offline · last known state");
  });
});
