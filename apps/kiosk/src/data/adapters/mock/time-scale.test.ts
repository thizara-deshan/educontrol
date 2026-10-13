import { describe, expect, it } from "vitest";
import { readTimeScale } from "./time-scale";

describe("readTimeScale", () => {
  it("reads ?time-scale in dev builds", () => {
    expect(readTimeScale("?mock-panel&time-scale=0.1", true)).toBe(0.1);
  });
  it("is 1 without the parameter, in production, or when invalid", () => {
    expect(readTimeScale("?mock-panel", true)).toBe(1);
    expect(readTimeScale("?time-scale=0.1", false)).toBe(1);
    expect(readTimeScale("?time-scale=0", true)).toBe(1);
    expect(readTimeScale("?time-scale=2", true)).toBe(1);
    expect(readTimeScale("?time-scale=fast", true)).toBe(1);
  });
});
