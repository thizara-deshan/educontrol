import { describe, expect, it } from "vitest";
import { initialPinInput, pinInputReducer, pinMessage, type PinInputAction, type PinInputState } from "./pin-input";

const run = (state: PinInputState, ...actions: PinInputAction[]): PinInputState => actions.reduce(pinInputReducer, state);
const digits = (pin: string): PinInputAction[] => [...pin].map((digit) => ({ type: "digit", digit }));

describe("PIN input reducer", () => {
  it("collects digits and auto-submits at 4 (room PIN)", () => {
    const three = run(initialPinInput(4), ...digits("123"));
    expect(three).toMatchObject({ digits: "123", phase: "entering" });
    expect(run(three, ...digits("4"))).toMatchObject({ digits: "1234", phase: "submitting" });
  });

  it("auto-submits at 6 (technician PIN), not at 4", () => {
    expect(run(initialPinInput(6), ...digits("1234")).phase).toBe("entering");
    expect(run(initialPinInput(6), ...digits("123456"))).toMatchObject({ digits: "123456", phase: "submitting" });
  });

  it("ignores keys while submitting and non-digit input", () => {
    const submitting = run(initialPinInput(4), ...digits("1234"));
    expect(run(submitting, ...digits("5"), { type: "backspace" })).toBe(submitting);
    const empty = initialPinInput(4);
    expect(run(empty, { type: "digit", digit: "x" })).toBe(empty);
  });

  it("backspace removes the last digit and is harmless when empty", () => {
    expect(run(initialPinInput(4), ...digits("12"), { type: "backspace" }).digits).toBe("1");
    expect(run(initialPinInput(4), { type: "backspace" }).digits).toBe("");
  });

  it("wrong clears the digits, shows Wrong PIN and bumps the shake counter", () => {
    const wrong = run(initialPinInput(4), ...digits("0000"), { type: "wrong" });
    expect(wrong).toMatchObject({ digits: "", phase: "wrong", wrongCount: 1 });
    expect(pinMessage(wrong)).toBe("Wrong PIN");
    // The next digit starts a new PIN and hides the message.
    const next = run(wrong, ...digits("1"));
    expect(next).toMatchObject({ digits: "1", phase: "entering" });
    expect(pinMessage(next)).toBeNull();
  });

  it("error (no answer) clears the digits with its own message", () => {
    const error = run(initialPinInput(4), ...digits("1234"), { type: "error" });
    expect(error).toMatchObject({ digits: "", phase: "error" });
    expect(pinMessage(error)).toBe("Couldn't check the PIN · try again");
  });

  it("locked disables keys and counts down from retry_after_s to 0, then re-enables (H17)", () => {
    const t0 = 1_000_000;
    const locked = run(initialPinInput(4), ...digits("0000"), { type: "locked", retryAfterS: 60, now: t0 });
    expect(locked).toMatchObject({ phase: "locked", digits: "", remainingS: 60, lockedUntil: t0 + 60_000 });
    expect(pinMessage(locked)).toBe("Too many tries · wait 1:00");
    expect(run(locked, ...digits("1"), { type: "backspace" })).toBe(locked);

    const later = run(locked, { type: "tick", now: t0 + 1_000 });
    expect(pinMessage(later)).toBe("Too many tries · wait 0:59");
    expect(pinMessage(run(later, { type: "tick", now: t0 + 2_100 }))).toBe("Too many tries · wait 0:58");
    // Same second → same state object (no re-render).
    expect(run(later, { type: "tick", now: t0 + 1_500 })).toBe(later);

    const almost = run(later, { type: "tick", now: t0 + 59_500 });
    expect(pinMessage(almost)).toBe("Too many tries · wait 0:01");
    const open = run(almost, { type: "tick", now: t0 + 60_000 });
    expect(open).toMatchObject({ phase: "entering", lockedUntil: null, remainingS: 0 });
    expect(run(open, ...digits("1")).digits).toBe("1");
  });

  it("ignores ticks and answers that don't apply", () => {
    const entering = run(initialPinInput(4), ...digits("12"));
    expect(run(entering, { type: "tick", now: 5 }, { type: "wrong" }, { type: "error" })).toBe(entering);
  });
});
