import { describe, expect, it } from "vitest";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import { applyStaleness } from "../../src/domain/sensors.ts";
import { bootModel, hwEvent, must, RULES, snapshotEvent, T0 } from "../helpers.ts";

const MIN = 60_000;
const after = (ms: number): Date => new Date(Date.parse(T0) + ms);

/** Snapshot at T0, then every sensor reports at T0 (node last seen T0). */
function freshState() {
  let model = applyHwEvent(bootModel(), snapshotEvent());
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_temp", kind: "temperature", value: 26.4 }));
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_temp", kind: "humidity", value: 61 }));
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_motion", kind: "occupancy", value: "detected" }));
  model = applyHwEvent(model, hwEvent("sensors.reading", { node: "r101_door", kind: "contact", value: "closed" }));
  return model;
}

describe("R13 staleness", () => {
  it.each([
    ["temperature", 10 * MIN, false], // 2 × 5 min climate interval
    ["temperature", 10 * MIN + 1, true],
    ["humidity", 11 * MIN, true],
    ["occupancy", 60 * MIN, false], // event sensors: node last seen > 60 min
    ["occupancy", 60 * MIN + 1, true],
    ["contact", 61 * MIN, true],
  ] as const)("%s after %d ms → stale %s", (kind, ms, stale) => {
    expect(applyStaleness(freshState().state, after(ms), RULES).environment.sensors[kind].stale).toBe(stale);
  });

  it("a node seen recently keeps its event sensor fresh even if the reading is old", () => {
    const model = freshState();
    const seen = applyHwEvent(model, hwEvent("zigbee.node", { ...must(model.state.zigbee.nodes[4]), last_seen: after(59 * MIN).toISOString() }));
    expect(applyStaleness(seen.state, after(90 * MIN), RULES).environment.sensors.contact.stale).toBe(false);
  });

  it("never reported (H11) is not stale; power is stale after 2 × 60 s", () => {
    const boot = bootModel().state;
    expect(applyStaleness(boot, after(999 * MIN), RULES).environment.sensors.temperature.stale).toBe(false);
    const state = freshState().state;
    const powerAt = Date.parse(state.display.projector.power.updated_at ?? T0);
    expect(applyStaleness(state, new Date(powerAt + 120_000), RULES).display.projector.power.stale).toBe(false);
    expect(applyStaleness(state, new Date(powerAt + 120_001), RULES).display.projector.power.stale).toBe(true);
  });

});
