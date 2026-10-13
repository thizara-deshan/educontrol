import { describe, expect, it } from "vitest";
import { initialPinChange, pinChangeMessage, pinChangeReducer, pinChangeTitle, type PinChangeState } from "./pin-change";

const type = (state: PinChangeState, digits: string): PinChangeState =>
  [...digits].reduce((next, digit) => pinChangeReducer(next, { type: "digit", digit }), state);

describe("PIN change confirm logic (S3d)", () => {
  it("room PIN: 4 digits, then the same 4 again → saving", () => {
    const first = type(initialPinChange("room"), "4321");
    expect(first).toMatchObject({ step: "confirm", first: "4321", digits: "" });
    expect(pinChangeTitle("room", first)).toBe("Enter the new room PIN again");
    expect(type(first, "4321")).toMatchObject({ step: "saving", first: "4321" });
  });

  it("technician PIN needs 6 digits", () => {
    expect(type(initialPinChange("technician"), "1234")).toMatchObject({ step: "new", digits: "1234" });
    expect(type(initialPinChange("technician"), "123456")).toMatchObject({ step: "confirm", first: "123456" });
    expect(pinChangeTitle("technician", initialPinChange("technician"))).toBe("New technician PIN");
  });

  it("a different second entry is a mismatch; the next digit starts over", () => {
    const mismatch = type(type(initialPinChange("room"), "4321"), "4320");
    expect(mismatch).toMatchObject({ step: "mismatch", first: "", digits: "", mismatches: 1 });
    expect(pinChangeMessage(mismatch)).toBe("The PINs don't match · start again");
    expect(type(mismatch, "9")).toMatchObject({ step: "new", digits: "9", first: "" });
  });

  it("backspace edits the current entry; ignored while saving", () => {
    const state = type(initialPinChange("room"), "12");
    expect(pinChangeReducer(state, { type: "backspace" })).toMatchObject({ digits: "1" });
    const saving = type(type(initialPinChange("room"), "1111"), "1111");
    expect(pinChangeReducer(saving, { type: "backspace" })).toBe(saving);
    expect(pinChangeReducer(saving, { type: "digit", digit: "2" })).toBe(saving);
  });

  it("a failed save starts over with a message", () => {
    const saving = type(type(initialPinChange("room"), "1111"), "1111");
    const failed = pinChangeReducer(saving, { type: "failed" });
    expect(failed).toMatchObject({ step: "error", first: "", digits: "" });
    expect(pinChangeMessage(failed)).toBe("Couldn't save the PIN · try again");
    expect(type(failed, "5")).toMatchObject({ step: "new", digits: "5" });
  });

  it("ignores non-digits", () => {
    const state = initialPinChange("room");
    expect(pinChangeReducer(state, { type: "digit", digit: "a" })).toBe(state);
  });
});
