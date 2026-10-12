import { describe, expect, it } from "vitest";
import { occupancyWakes, readIdleScale } from "./kiosk-params";

describe("readIdleScale", () => {
  it.each([
    ["?idle-scale=0.01", true, 0.01],
    ["?idle-scale=1", true, 1],
    ["", true, 1],
    ["?idle-scale=0", true, 1],
    ["?idle-scale=-1", true, 1],
    ["?idle-scale=5", true, 1],
    ["?idle-scale=abc", true, 1],
    ["?idle-scale=0.01", false, 1],
  ])("%s (dev %s) → %s", (search, dev, expected) => {
    expect(readIdleScale(search, dev)).toBe(expected);
  });
});

describe("occupancyWakes", () => {
  it.each([
    ["clear", "detected", true],
    [null, "detected", true],
    ["detected", "detected", false],
    ["detected", "clear", false],
    [undefined, "detected", false],
    ["clear", undefined, false],
  ] as const)("%s → %s: %s", (prev, next, expected) => {
    expect(occupancyWakes(prev, next)).toBe(expected);
  });
});
