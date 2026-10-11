import { describe, expect, it } from "vitest";
import {
  formatActivity, formatAgo, formatAttribution, formatCelsius, formatDate, formatPercent,
  formatTime, formatWatts,
} from "./format";

describe("formatTime", () => {
  it("pads to HH:mm in 24 h", () => {
    expect(formatTime(new Date(2026, 9, 5, 10, 42, 59))).toBe("10:42");
    expect(formatTime(new Date(2026, 9, 5, 7, 5))).toBe("07:05");
    expect(formatTime(new Date(2026, 9, 5, 23, 0))).toBe("23:00");
  });
});

describe("formatDate", () => {
  it("renders ddd d MMM", () => {
    expect(formatDate(new Date(2026, 9, 5))).toBe("Mon 5 Oct");
    expect(formatDate(new Date(2026, 0, 31))).toBe("Sat 31 Jan");
  });
});

describe("formatWatts", () => {
  it("rounds to whole watts", () => {
    expect(formatWatts(287.4)).toBe("287 W");
    expect(formatWatts(3)).toBe("3 W");
  });
  it("shows a dash when unknown", () => {
    expect(formatWatts(null)).toBe("— W");
  });
});

describe("formatCelsius", () => {
  it("uses one decimal by default", () => {
    expect(formatCelsius(26.4)).toBe("26.4°");
    expect(formatCelsius(26)).toBe("26.0°");
  });
  it("supports whole degrees for the setpoint", () => {
    expect(formatCelsius(24, 0)).toBe("24°");
  });
  it("shows a dash when unknown", () => {
    expect(formatCelsius(null)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("renders an integer percentage", () => {
    expect(formatPercent(61)).toBe("61%");
    expect(formatPercent(60.6)).toBe("61%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatAgo", () => {
  const now = new Date("2026-10-05T10:42:00Z");
  it.each([
    ["2026-10-05T10:41:48Z", "12s ago"],
    ["2026-10-05T10:28:00Z", "14 min ago"],
    ["2026-10-05T07:42:00Z", "3 h ago"],
    ["2026-10-03T10:42:00Z", "2 d ago"],
    ["2026-10-05T10:43:00Z", "0s ago"],
  ])("%s → %s", (from, expected) => {
    expect(formatAgo(from, now)).toBe(expected);
  });
});

describe("attribution", () => {
  it.each([
    ["phone", "from phone"],
    ["room screen", "from room screen"],
    ["podium PC", "from podium PC"],
    ["by hand", "by hand"],
    ["schedule", "by schedule"],
  ] as const)("%s → %s", (by, expected) => {
    expect(formatAttribution(by)).toBe(expected);
  });
  it("builds the H13 toast text", () => {
    expect(formatActivity("Rear of room turned on", "phone")).toBe("Rear of room turned on · from phone");
  });
});
