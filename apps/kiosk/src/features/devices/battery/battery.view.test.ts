import { describe, expect, it } from "vitest";
import { batterySeverity, lastSeenText } from "./battery.view";

const NOW = new Date("2026-10-05T10:42:00Z");

describe("batterySeverity (H16)", () => {
  it.each([
    [98, "ok"],
    [21, "ok"],
    [20, "low"],
    [18, "low"],
    [11, "low"],
    [10, "critical"],
    [8, "critical"],
    [0, "critical"],
    [null, "unknown"],
  ] as const)("%s%% → %s", (pct, expected) => {
    expect(batterySeverity(pct)).toBe(expected);
  });
});

describe("lastSeenText (S2.E6, S2.E16)", () => {
  it("online: relative to server time", () => {
    expect(lastSeenText("2026-10-05T10:41:48Z", true, NOW)).toBe("12s ago");
    expect(lastSeenText("2026-10-05T10:28:00Z", true, NOW)).toBe("14 min ago");
    expect(lastSeenText(null, true, NOW)).toBe("—");
  });
  it("offline: `Offline · 5 min ago`, or `Offline` if never seen", () => {
    expect(lastSeenText("2026-10-05T10:37:00Z", false, NOW)).toBe("Offline · 5 min ago");
    expect(lastSeenText(null, false, NOW)).toBe("Offline");
  });
});
