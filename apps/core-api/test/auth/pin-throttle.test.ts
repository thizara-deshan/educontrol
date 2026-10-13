import { describe, expect, it } from "vitest";
import { createPinThrottle } from "../../src/auth/pin-throttle.ts";
import { fixedClock } from "../../src/clock.ts";
import { T0 } from "../helpers.ts";

describe("PIN throttle (H17)", () => {
  it("5 wrong in a row ⇒ locked 60 s; the countdown runs; then entry opens again", () => {
    const clock = fixedClock(T0);
    const throttle = createPinThrottle(clock);
    expect([1, 2, 3, 4].map(() => throttle.fail("10.0.0.5", "control"))).toEqual([4, 3, 2, 1].map((left) => ({ reason: "wrong", retry_after_s: null, attempts_left: left })));
    expect(throttle.fail("10.0.0.5", "control")).toEqual({ reason: "locked", retry_after_s: 60, attempts_left: 0 });
    clock.advance(2_000);
    expect(throttle.check("10.0.0.5", "control")).toEqual({ reason: "locked", retry_after_s: 58, attempts_left: 0 });
    expect(throttle.check("10.0.0.6", "control")).toBeNull(); // per IP
    expect(throttle.check("10.0.0.5", "technician")).toBeNull(); // per level
    clock.advance(58_000);
    expect(throttle.check("10.0.0.5", "control")).toBeNull();
  });
  it("a success resets the count", () => {
    const throttle = createPinThrottle(fixedClock(T0));
    for (let i = 0; i < 4; i += 1) throttle.fail("10.0.0.5", "control");
    throttle.succeed("10.0.0.5", "control");
    expect(throttle.fail("10.0.0.5", "control").attempts_left).toBe(4);
  });
  it("more than 20 failures a minute across IPs locks everyone for 60 s", () => {
    const clock = fixedClock(T0);
    const throttle = createPinThrottle(clock);
    for (let i = 0; i < 20; i += 1) throttle.fail(`10.0.1.${i}`, "control");
    expect(throttle.check("10.0.9.9", "control")).toBeNull();
    expect(throttle.fail("10.0.1.99", "control")).toMatchObject({ reason: "locked", retry_after_s: 60 });
    expect(throttle.check("10.0.9.9", "technician")).toMatchObject({ reason: "locked" });
    clock.advance(60_000);
    expect(throttle.check("10.0.9.9", "technician")).toBeNull();
  });
});
