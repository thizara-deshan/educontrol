import { describe, expect, it } from "vitest";
import { ClassBlock, ClockTime, Schedule, TimedAction } from "../src/domain/schedule.ts";
import { AboutInfo, NetworkInfo } from "../src/domain/system.ts";

describe("schedule", () => {
  const block = { id: "b1", days: ["mon", "wed"], start: "08:00", end: "09:30" };
  it("accepts a class block", () => {
    expect(ClassBlock.safeParse(block).success).toBe(true);
  });
  it("rejects a block that ends before it starts, on the end field", () => {
    const result = ClassBlock.safeParse({ ...block, start: "10:00", end: "09:00" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["end"]);
  });
  it("rejects malformed clock times", () => {
    expect(ClockTime.safeParse("24:00").success).toBe(false);
    expect(ClockTime.safeParse("8:00").success).toBe(false);
    expect(ClockTime.safeParse("18:00").success).toBe(true);
  });
  it("timed action needs at least one valid step", () => {
    const action = { id: "a1", name: "All off", time: "18:00", days: ["mon", "tue", "wed", "thu", "fri"],
      enabled: true, steps: [{ kind: "lights.set", gang: "front", on: false }] };
    expect(TimedAction.safeParse(action).success).toBe(true);
    expect(TimedAction.safeParse({ ...action, steps: [] }).success).toBe(false);
    expect(TimedAction.safeParse({ ...action, steps: [{ kind: "lights.dim" }] }).success).toBe(false);
  });
  it("accepts an empty schedule", () => {
    expect(Schedule.safeParse({ class_blocks: [], actions: [] }).success).toBe(true);
  });
});

describe("system", () => {
  it("accepts Wi-Fi network info with clients", () => {
    const info = { hostname: "r-101.local", address: "10.20.1.101",
      connection: { kind: "wifi", ssid: "CAMPUS", signal_pct: 72 }, controller: { hw: "up" },
      clients: [{ public_id: null, label: "room screen", client_type: "kiosk", access: "control" }] };
    expect(NetworkInfo.safeParse(info).success).toBe(true);
    expect(NetworkInfo.safeParse({ ...info, connection: { kind: "lte" } }).success).toBe(false);
  });
  it("about url must be a full URL", () => {
    const about = { room: "R-101", version: "0.1.0", uptime_s: 3600, pi_model: "Raspberry Pi 5", url: "http://r-101.local" };
    expect(AboutInfo.safeParse(about).success).toBe(true);
    expect(AboutInfo.safeParse({ ...about, url: "r-101.local" }).success).toBe(false);
  });
});
