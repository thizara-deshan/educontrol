import { describe, expect, it } from "vitest";
import { hwEvent, snapshotEvent } from "../helpers.ts";
import { room } from "../commands/setup.ts";

describe("ingest", () => {
  it("R6: a light change nobody commanded is 'by hand' on every client", () => {
    const r = room();
    r.report(hwEvent("lights.state", { gang: "rear", on: true }));
    expect(r.store.get().environment.lights.rear).toMatchObject({ value: true, confidence: "confirmed", changed_by: "by hand" });
    expect(r.events.filter((e) => e.type === "activity")).toEqual([{ type: "activity", text: "Rear of room turned on", by: "by hand", public_id: null }]);
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "state", actor: "by hand", subject: "lights.rear" }));
  });

  it("a report that repeats the current value changes nothing and says nothing", () => {
    const r = room();
    const rev = r.store.get().rev;
    r.report(hwEvent("lights.state", { gang: "front", on: true })); // already on in the snapshot
    expect(r.store.get().rev).toBe(rev);
    expect(r.events.filter((e) => e.type === "activity")).toEqual([]);
  });

  it("a resync snapshot that differs is not a wall-plate press", () => {
    const r = room();
    const snap = snapshotEvent();
    if (snap.type !== "snapshot") throw new Error("fixture");
    r.report({ ...snap, data: { ...snap.data, lights: { front: false, rear: true } } });
    expect(r.store.get().environment.lights.rear.value).toBe(true);
    expect(r.store.get().environment.lights.rear.changed_by).toBeNull();
    expect(r.events.filter((e) => e.type === "activity")).toEqual([]);
  });

  it("persists a new kWh baseline once, not on every reading", () => {
    const r = room(); // the snapshot already set today's baseline
    expect(r.baselines).toEqual([]);
    r.report(hwEvent("projector_power.reading", { watts: 287, volts: 231, energy_kwh_total: 413 }, "2026-10-06T00:00:05Z"));
    r.report(hwEvent("projector_power.reading", { watts: 287, volts: 231, energy_kwh_total: 413.1 }, "2026-10-06T00:01:05Z"));
    expect(r.baselines).toEqual([{ date: "2026-10-06", kwh_total: 413 }]);
  });

  it("down(): link down, logged, and a tick scheduled at the grace; up again on the next snapshot", () => {
    const r = room();
    r.ingest.down();
    expect(r.store.get().connection.hw).toBe("down");
    expect(r.ticks).toEqual([10_000]);
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "hw", subject: "link", result: "down" }));
    r.report(snapshotEvent());
    expect(r.store.get().connection.hw).toBe("up");
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "hw", subject: "link", result: "up" }));
  });

  it("hw.error is logged; heartbeat and ir.learn change nothing", () => {
    const r = room();
    const rev = r.store.get().rev;
    r.report(hwEvent("hw.error", { module: "ir", code: "transport", message: "serial port gone" }));
    r.report(hwEvent("heartbeat", {}));
    r.report(hwEvent("ir.learn", { status: "listening" }));
    expect(r.store.get().rev).toBe(rev);
    expect(r.logs).toContainEqual(expect.objectContaining({ type: "hw", subject: "ir", result: "transport" }));
  });
});
