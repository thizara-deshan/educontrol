import { describe, expect, it } from "vitest";
import { applyAudioReport, mutedAll, saveLevels } from "../../src/domain/audio.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { bootModel, snapshotEvent, T0 } from "../helpers.ts";

describe("R9 audio", () => {
  it.each([
    [{ mic: true, pc: true }, true],
    [{ mic: true, pc: false }, false],
    [{ mic: null, pc: true }, null],
  ])("muted_all of %j is %s", (muted, expected) => {
    expect(mutedAll(muted)).toBe(expected);
  });

  it("mute saves the levels; both channels muted ⇒ muted_all; unmute clears the saved levels", () => {
    let model = applyHwEvent(bootModel(), snapshotEvent()); // mic 62, pc 38, unmuted
    model = { ...model, state: { ...model.state, audio: saveLevels(model.state.audio) } };
    expect(model.state.audio.saved_levels).toEqual({ mic: 62, pc: 38 });
    model = applyAudioReport(model, { channel: "mic", level: 62, muted: true }, T0);
    expect(model.state.audio.muted_all.value).toBe(false);
    model = applyAudioReport(model, { channel: "pc", level: 38, muted: true }, T0);
    expect(model.state.audio.muted_all.value).toBe(true);
    expect(saveLevels(model.state.audio).saved_levels).toEqual({ mic: 62, pc: 38 }); // muting twice keeps them
    model = applyAudioReport(model, { channel: "mic", level: 62, muted: false }, T0);
    expect(model.state.audio.muted_all.value).toBe(false);
    expect(model.state.audio.saved_levels).toEqual({ mic: null, pc: null });
  });
});
