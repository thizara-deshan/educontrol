import { describe, expect, it } from "vitest";
import { attributionFor, describeCommand } from "../../src/domain/attribution.ts";

describe("H13 attribution", () => {
  it.each([
    ["lights.rear", true, "phone", "phone"],
    ["lights.rear", false, "phone", "phone"], // echo of a command that changed nothing still names the issuer
    ["lights.rear", true, null, "by hand"], // R6
    ["display.source", true, null, null],
    ["lights.front", false, null, undefined], // unchanged: keep the old changed_by
  ] as const)("%s changed=%s claimed=%s → %s", (key, changed, claimed, expected) => {
    expect(attributionFor(key, changed, claimed)).toBe(expected);
  });

  it.each([
    [{ kind: "lights.set", gang: "rear", on: true }, "Rear of room turned on"],
    [{ kind: "source.select", input: "smart_board" }, "Smart board selected"],
    [{ kind: "audio.level", channel: "mic", level: 40, final: true }, "Lecturer microphone set to 40"],
    [{ kind: "ac.step", direction: "up" }, "Air conditioning setpoint raised"],
    [{ kind: "projector.power", on: true }, "Projector power on sent"],
  ] as const)("describes %j", (body, text) => {
    expect(describeCommand(body)).toBe(text);
  });
});
