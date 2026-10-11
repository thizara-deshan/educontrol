import { describe, expect, it } from "vitest";
import {
  ACTIVE_CONTROL_CLASS, CARD_VARIANT_CLASS, CARD_VARIANT_FOR_TONE, DOT_CLASS, stateTone, STATUS_DOT_CLASS, TEXT_CLASS,
  VALUE_TONE_CLASS, type StateInput, type StateTone,
} from "./state-styles";

describe("stateTone", () => {
  it.each<[StateInput, StateTone]>([
    [{ confidence: "confirmed", active: true }, "confirmed"],
    [{ confidence: "confirmed", active: false }, "off"],
    [{ confidence: "confirmed", active: true, selected: true }, "selected"],
    [{ confidence: "assumed", active: true }, "assumed"],
    [{ confidence: "assumed", active: false }, "assumed"],
    [{ confidence: "unknown", active: false }, "unknown"],
    [{ confidence: "confirmed", active: true, hasValue: false }, "unknown"],
    [{ confidence: "confirmed", active: true, offline: true }, "offline"],
    [{ confidence: "assumed", active: true, offline: true }, "offline"],
    [{ confidence: "unknown", active: false, offline: true }, "offline"],
  ])("%o → %s", (input, expected) => {
    expect(stateTone(input)).toBe(expected);
  });
});

describe("SPEC §3.4 class maps", () => {
  it("confirmed is a solid accent dot with accent text", () => {
    expect(DOT_CLASS.confirmed).toBe("bg-accent");
    expect(TEXT_CLASS.confirmed).toBe("text-accent");
  });
  it("assumed is a hollow warn ring, warn text and a dashed card", () => {
    expect(DOT_CLASS.assumed).toContain("border-warn");
    expect(DOT_CLASS.assumed).toContain("bg-transparent");
    expect(TEXT_CLASS.assumed).toBe("text-warn");
    expect(CARD_VARIANT_FOR_TONE.assumed).toBe("dashed");
    expect(CARD_VARIANT_CLASS.dashed).toContain("border-dashed");
  });
  it("unknown is a hollow grey ring and a dashed card", () => {
    expect(DOT_CLASS.unknown).toContain("border-text-3");
    expect(CARD_VARIANT_FOR_TONE.unknown).toBe("dashed");
  });
  it("offline is danger with a 40% danger border", () => {
    expect(DOT_CLASS.offline).toBe("bg-danger");
    expect(CARD_VARIANT_FOR_TONE.offline).toBe("danger");
    expect(CARD_VARIANT_CLASS.danger).toBe("border-danger/40");
  });
  it("active controls use the SPEC fills", () => {
    expect(ACTIVE_CONTROL_CLASS.confirmed).toContain("bg-accent-fill");
    expect(ACTIVE_CONTROL_CLASS.selected).toContain("bg-selected-fill");
    expect(ACTIVE_CONTROL_CLASS.assumed).toContain("bg-warn-fill");
  });
  it("never contains raw colour values", () => {
    const all = [
      ...Object.values(DOT_CLASS), ...Object.values(TEXT_CLASS), ...Object.values(CARD_VARIANT_CLASS),
      ...Object.values(ACTIVE_CONTROL_CLASS), ...Object.values(STATUS_DOT_CLASS),
      ...Object.values(VALUE_TONE_CLASS),
    ];
    for (const cls of all) expect(cls).not.toMatch(/#|rgb\(|\[/);
  });
});
