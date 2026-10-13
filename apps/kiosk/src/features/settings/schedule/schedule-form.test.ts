import { describe, expect, it } from "vitest";
import { EMPTY_ACTION_FORM, EMPTY_BLOCK_FORM, validateAction, validateBlock } from "./schedule-form";

describe("validateBlock (time/day validation)", () => {
  it("accepts the default form", () => {
    expect(validateBlock(EMPTY_BLOCK_FORM)).toEqual({ ok: true, value: EMPTY_BLOCK_FORM });
  });
  it("needs a day", () => {
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, days: [] })).toEqual({ ok: false, errors: { days: "Pick at least one day" } });
  });
  it("needs HH:MM times", () => {
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, start: "8:00", end: "" })).toEqual({
      ok: false, errors: { start: "Use HH:MM (24 h)", end: "Use HH:MM (24 h)" },
    });
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, end: "24:00" }).ok).toBe(false);
  });
  it("end must be after start", () => {
    expect(validateBlock({ ...EMPTY_BLOCK_FORM, start: "10:00", end: "10:00" })).toEqual({
      ok: false, errors: { end: "End must be after start" },
    });
  });
});

describe("validateAction", () => {
  it("builds an enabled 'All off' action from the preset", () => {
    expect(validateAction(EMPTY_ACTION_FORM)).toMatchObject({
      ok: true, value: { name: "All off", time: "18:00", enabled: true, days: ["mon", "tue", "wed", "thu", "fri"] },
    });
    expect(validateAction({ ...EMPTY_ACTION_FORM, preset: "lights_off" })).toMatchObject({ ok: true, value: { name: "Lights off" } });
  });
  it("needs a day and a time", () => {
    expect(validateAction({ ...EMPTY_ACTION_FORM, days: [], time: "6pm" })).toEqual({
      ok: false, errors: { days: "Pick at least one day", time: "Use HH:MM (24 h)" },
    });
  });
});
