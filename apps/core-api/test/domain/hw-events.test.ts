import { describe, expect, it } from "vitest";
import { applyHwDown, applyHwEvent, reportedKeys, setChangedBy, valueChanged } from "../../src/domain/hw-events.ts";
import { bootModel, hwEvent, hwEventFixtures, snapshotEvent, T0 } from "../helpers.ts";

describe("HwEvent → model", () => {
  it("the snapshot brings the link up with screenshot 01's values, all confirmed", () => {
    const { state, facts } = applyHwEvent(bootModel(), snapshotEvent());
    expect(state.connection.hw).toBe("up");
    expect(facts.hw_down_since).toBeNull();
    expect(state.display.source).toMatchObject({ value: "podium_pc", confidence: "confirmed", source: "hdmi_switch" });
    expect(state.display.projector.mains.value).toBe(true);
    expect(state.display.screen.value).toBe("lowered");
    expect(state.audio.channels.mic.value).toBe(62);
    expect(state.audio.muted_all.value).toBe(false);
    expect(state.environment.lights.front.value).toBe(true);
    expect(state.environment.sensors.temperature).toMatchObject({ value: 26.4, node: "r101_temp", at: "2026-10-05T10:41:48Z" });
    expect(state.zigbee.nodes).toHaveLength(5);
    expect(state.ir_blaster.lqi).toBe(196);
    expect(state.environment.ac.power.value).toBeNull(); // R3: hw never reports the AC
  });

  it("every fixture event applies without throwing; state-less events change nothing", () => {
    const up = applyHwEvent(bootModel(), snapshotEvent());
    for (const { event } of hwEventFixtures()) {
      const next = applyHwEvent(up, event);
      if (event.type === "heartbeat" || event.type === "hw.error" || event.type === "ir.learn") expect(next).toBe(up);
    }
  });

  it("unknown screen position is value unknown, confidence unknown", () => {
    const next = applyHwEvent(bootModel(), hwEvent("projection_screen.state", { position: "unknown" }));
    expect(next.state.display.screen).toMatchObject({ value: "unknown", confidence: "unknown" });
  });

  it("zigbee.mesh only moves the joining deadline", () => {
    expect(applyHwEvent(bootModel(), hwEvent("zigbee.mesh", { joining_until: "2026-10-05T10:46:00Z" })).facts.joining_until).toBe("2026-10-05T10:46:00Z");
  });

  it("reportedKeys names the outputs an event proves", () => {
    expect(reportedKeys(hwEvent("lights.state", { gang: "rear", on: true }))).toEqual(["lights.rear"]);
    expect(reportedKeys(hwEvent("audio.state", { channel: "pc", level: 40, muted: false }))).toEqual(["audio.pc", "audio.mute"]);
    expect(reportedKeys(hwEvent("sensors.reading", { node: "r101_temp", kind: "temperature", value: 20 }))).toEqual([]);
  });

  it("valueChanged / setChangedBy work on the reported output", () => {
    const up = applyHwEvent(bootModel(), snapshotEvent());
    const next = applyHwEvent(up, hwEvent("lights.state", { gang: "rear", on: true }));
    expect(valueChanged(up.state, next.state, "lights.rear")).toBe(true);
    expect(valueChanged(up.state, next.state, "lights.front")).toBe(false);
    expect(setChangedBy(next.state, "lights.rear", "phone").environment.lights.rear.changed_by).toBe("phone");
  });

  it("applyHwDown marks the link down once", () => {
    const up = applyHwEvent(bootModel(), snapshotEvent());
    const down = applyHwDown(up, T0);
    expect(down.state.connection.hw).toBe("down");
    expect(applyHwDown(down, "2026-10-05T11:00:00Z").facts.hw_down_since).toBe(T0);
  });
});

describe("power readings (R1 + kWh today)", () => {
  it("a reading sets power, kWh today from the first reading of the day and the R1 state", () => {
    let model = applyHwEvent(bootModel(), snapshotEvent()); // 287 W, 412.67 kWh
    expect(model.state.display.projector.state.value).toBe("running");
    expect(model.state.display.projector.power.value?.kwh_today).toBe(0);
    model = applyHwEvent(model, hwEvent("projector_power.reading", { watts: 45, volts: 230, energy_kwh_total: 413.92 }, "2026-10-05T11:00:00Z"));
    const { power, state } = model.state.display.projector;
    expect(power.value).toEqual({ watts: 45, volts: 230, kwh_today: 1.25, rating_a: 13, at: "2026-10-05T11:00:00Z" });
    expect(power.confidence).toBe("confirmed");
    expect(state.value).toBe("cooling_down");
    expect(model.facts.kwh_baseline).toEqual({ date: "2026-10-05", kwh_total: 412.67 });
  });
});
