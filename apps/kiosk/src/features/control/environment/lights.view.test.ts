import { describe, expect, it } from "vitest";
import { lightsView, nextLightOn } from "./lights.view";

describe("lightsView (S1.E31)", () => {
  it("online: green dot, Confirmed by the switch", () => {
    expect(lightsView(true)).toEqual({ tone: "confirmed", line: "Confirmed by the switch" });
    expect(lightsView(undefined)).toEqual({ tone: "confirmed", line: "Confirmed by the switch" });
  });
  it("offline: red dot, last known state (H8)", () => {
    expect(lightsView(false)).toEqual({ tone: "offline", line: "Switch offline · last known state" });
  });
  it("a tap sends the opposite of the server value", () => {
    expect(nextLightOn(true)).toBe(false);
    expect(nextLightOn(false)).toBe(true);
    expect(nextLightOn(null)).toBe(true);
  });
});
