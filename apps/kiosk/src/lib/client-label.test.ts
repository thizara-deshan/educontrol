import { describe, expect, it } from "vitest";
import { detectClientLabel } from "./client-label";

describe("detectClientLabel", () => {
  it.each([
    [{ podium: true, coarsePointer: false, shortSide: 1080 }, "podium PC"],
    [{ podium: true, coarsePointer: true, shortSide: 390 }, "podium PC"],
    [{ podium: false, coarsePointer: false, shortSide: 1080 }, "laptop"],
    [{ podium: false, coarsePointer: false, shortSide: 390 }, "laptop"],
    [{ podium: false, coarsePointer: true, shortSide: 390 }, "phone"],
    [{ podium: false, coarsePointer: true, shortSide: 599 }, "phone"],
    [{ podium: false, coarsePointer: true, shortSide: 600 }, "tablet"],
    [{ podium: false, coarsePointer: true, shortSide: 800 }, "tablet"],
  ] as const)("%o → %s", (traits, expected) => {
    expect(detectClientLabel(traits)).toBe(expected);
  });
});
