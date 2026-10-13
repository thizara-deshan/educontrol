import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { deriveReporting, deriveRoomStatus, withDerived } from "./mock-rules";

describe("mock derived fields", () => {
  it("reporting counts sensor devices, not tiles; stale or offline drops the count (S1.E41)", () => {
    const base = roomState();
    expect(deriveReporting(base)).toEqual({ count: 3, of: 3 });
    const { sensors } = base.environment;
    const stale = { ...base, environment: { ...base.environment, sensors: { ...sensors, humidity: { ...sensors.humidity, stale: true } } } };
    expect(deriveReporting(stale)).toEqual({ count: 2, of: 3 });
    const devices = base.devices.map((d) => (d.id === "door" ? { ...d, online: { ...d.online, value: false } } : d));
    expect(deriveReporting({ ...base, devices })).toEqual({ count: 2, of: 3 });
  });

  it("room status: coordinator offline is a fault, offline device or missing sensor degrades (S1.E4)", () => {
    const base = roomState();
    expect(deriveRoomStatus(base)).toEqual({ level: "normal", text: "All systems normal" });
    const coordinator = { ...base.zigbee.coordinator, status: "offline" as const };
    expect(deriveRoomStatus({ ...base, zigbee: { ...base.zigbee, coordinator } })).toEqual({ level: "fault", text: "Coordinator offline" });
    const devices = base.devices.map((d) => (d.id === "lights" ? { ...d, online: { ...d.online, value: false } } : d));
    expect(deriveRoomStatus({ ...base, devices })).toEqual({ level: "degraded", text: "Lighting switch offline" });
    const { sensors } = base.environment;
    const stale = { ...base, environment: { ...base.environment, sensors: { ...sensors, contact: { ...sensors.contact, stale: true } } } };
    expect(withDerived(stale).room.status).toEqual({ level: "degraded", text: "Sensor not reporting" });
  });
});
