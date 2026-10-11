import { describe, expect, it } from "vitest";
import { hwFixtureTarget } from "./hw-fixture-name.ts";

describe("hwFixtureTarget", () => {
  it("maps events to HwEvent with the dotted type", () => {
    expect(hwFixtureTarget("event.lights.state.json")).toEqual({ kind: "event", schema: "HwEvent", eventType: "lights.state" });
    expect(hwFixtureTarget("event.heartbeat.json")).toEqual({ kind: "event", schema: "HwEvent", eventType: "heartbeat" });
  });
  it("maps requests to Hw<Module><Action>Request", () => {
    expect(hwFixtureTarget("request.zigbee_status.permit_join.json").schema).toBe("HwZigbeeStatusPermitJoinRequest");
    expect(hwFixtureTarget("request.ir.send.json").schema).toBe("HwIrSendRequest");
  });
  it("maps responses to Hw<Name>, ignoring the variant", () => {
    expect(hwFixtureTarget("response.ack.error.json").schema).toBe("HwAck");
    expect(hwFixtureTarget("response.ir_learn_result.captured.json").schema).toBe("HwIrLearnResult");
    expect(hwFixtureTarget("response.health.json").schema).toBe("HwHealth");
  });
  it("throws on names outside the rule", () => {
    expect(() => hwFixtureTarget("request.lights.json")).toThrow();
    expect(() => hwFixtureTarget("foo.bar.json")).toThrow();
    expect(() => hwFixtureTarget("event.lights.state.txt")).toThrow();
  });
});
