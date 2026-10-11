import { describe, expect, it } from "vitest";
import { AudioState } from "../src/domain/audio.ts";
import { PowerReading, ProjectorFeedback, ProjectorState } from "../src/domain/display.ts";
import { AT, obs } from "./helpers.ts";

const audio = {
  channels: { mic: obs(62, { source: "mixer" }), pc: obs(38, { source: "mixer" }) },
  muted_all: obs(false, { source: "mixer" }),
  saved_levels: { mic: null, pc: null },
};

describe("display", () => {
  it("accepts the screenshot power reading", () => {
    const reading = { watts: 287, volts: 231, kwh_today: 1.84, rating_a: 13, at: AT };
    expect(PowerReading.safeParse(reading).success).toBe(true);
  });
  it("rejects a power reading without a timestamp", () => {
    expect(PowerReading.safeParse({ watts: 287, volts: 231, kwh_today: 1.84, rating_a: 13 }).success).toBe(false);
  });
  it("rejects a projector state outside R1", () => {
    expect(ProjectorState.safeParse("on").success).toBe(false);
  });
  it("accepts idle feedback and rejects an unknown phase", () => {
    expect(ProjectorFeedback.safeParse({ last_ir: null, sent_at: null, phase: "idle" }).success).toBe(true);
    expect(ProjectorFeedback.safeParse({ last_ir: null, sent_at: null, phase: "warming" }).success).toBe(false);
  });
});

describe("AudioState", () => {
  it("accepts mic 62 / pc 38", () => {
    expect(AudioState.safeParse(audio).success).toBe(true);
  });
  it("rejects a level above 100", () => {
    const loud = { ...audio, channels: { ...audio.channels, mic: obs(101, { source: "mixer" }) } };
    expect(AudioState.safeParse(loud).success).toBe(false);
  });
});
