import { describe, expect, it } from "vitest";
import { BLASTER_COVERAGE } from "../../src/domain/initial.ts";
import { bootModel, T0 } from "../helpers.ts";

describe("boot model (D-15: nothing live is persisted)", () => {
  it("starts with the hw link down since boot, rev 0, every value unknown", () => {
    const { state, facts } = bootModel();
    expect(state.rev).toBe(0);
    expect(state.connection.hw).toBe("down");
    expect(facts.hw_down_since).toBe(T0);
    expect(state.display.source).toEqual({ value: null, confidence: "unknown", source: "hdmi_switch", updated_at: null, stale: false, changed_by: null });
    expect(state.environment.lights.front.value).toBeNull();
  });
  it("R3: the AC is Unknown after start; R4: only captured setpoints are offered", () => {
    const { state } = bootModel({ acSetpoints: [18, 24] });
    expect(state.environment.ac.power.confidence).toBe("unknown");
    expect(state.environment.ac.available_setpoints).toEqual([18, 24]);
  });
  it("sensor tiles point at the registry nodes; the blaster and coordinator come from the registry", () => {
    const { state } = bootModel();
    expect(state.environment.sensors.temperature).toEqual({ kind: "temperature", value: null, node: "r101_temp", at: null, stale: false });
    expect(state.environment.sensors.contact.node).toBe("r101_door");
    expect(state.ir_blaster).toMatchObject({ id: "ZS06", topic: "r101_ir", coverage: BLASTER_COVERAGE, power: "mains" });
    expect(state.zigbee.coordinator).toMatchObject({ model: "ZG-808Z", port: "zigbee-coord", status: "offline" });
    expect(state.interlock.status).toBe("armed");
  });
});
