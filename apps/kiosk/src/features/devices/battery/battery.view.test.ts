import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { batteryRows, batterySeverity, lastSeenText } from "./battery.view";

const NOW = new Date("2026-10-05T10:42:00Z");

describe("batterySeverity (H16)", () => {
  it.each([
    [98, "ok"],
    [21, "ok"],
    [20, "low"],
    [18, "low"],
    [11, "low"],
    [10, "critical"],
    [8, "critical"],
    [0, "critical"],
    [null, "unknown"],
  ] as const)("%s%% → %s", (pct, expected) => {
    expect(batterySeverity(pct)).toBe(expected);
  });
});

describe("lastSeenText (S2.E6, S2.E16)", () => {
  it("online: relative to server time", () => {
    expect(lastSeenText("2026-10-05T10:41:48Z", true, NOW)).toBe("12s ago");
    expect(lastSeenText("2026-10-05T10:28:00Z", true, NOW)).toBe("14 min ago");
    expect(lastSeenText(null, true, NOW)).toBe("—");
  });
  it("offline: `Offline · 5 min ago`, or `Offline` if never seen", () => {
    expect(lastSeenText("2026-10-05T10:37:00Z", false, NOW)).toBe("Offline · 5 min ago");
    expect(lastSeenText(null, false, NOW)).toBe("Offline");
  });
});

describe("batteryRows (S2.E16–E19)", () => {
  it("screenshot 02: Room climate, Motion, Door", () => {
    const { zigbee, devices, environment } = roomState();
    expect(batteryRows(zigbee.nodes, devices, environment.sensors, NOW)).toEqual([
      {
        key: "0x00124b0029b70003", name: "Room climate", ids: "SNZB-02P · r101_temp", reading: "26.4° · 61%", readingTone: "default",
        battery: "98%", batteryTone: "muted", link: "168", lastSeen: "12s ago", lastSeenTone: "muted",
      },
      {
        key: "0x00124b0029b70004", name: "Motion", ids: "SNZB-03P · r101_motion", reading: "Detected", readingTone: "accent",
        battery: "91%", batteryTone: "muted", link: "142", lastSeen: "3 min ago", lastSeenTone: "muted",
      },
      {
        key: "0x00124b0029b70005", name: "Door", ids: "SNZB-04PR2 · r101_door", reading: "Closed", readingTone: "default",
        battery: "87%", batteryTone: "muted", link: "155", lastSeen: "8 min ago", lastSeenTone: "muted",
      },
    ]);
  });

  it("battery 18% amber, 8% red (H16)", () => {
    const { zigbee, devices, environment } = roomState();
    const nodes = zigbee.nodes.map((n) =>
      n.friendly_name === "r101_temp" ? { ...n, battery_pct: 18 } : n.friendly_name === "r101_door" ? { ...n, battery_pct: 8 } : n,
    );
    const rows = batteryRows(nodes, devices, environment.sensors, NOW);
    expect(rows[0]).toMatchObject({ battery: "18%", batteryTone: "warn" });
    expect(rows[2]).toMatchObject({ battery: "8%", batteryTone: "danger" });
  });

  it("stale: last seen amber, reading text-3 (H10)", () => {
    const { zigbee, devices, environment } = roomState();
    const { sensors } = environment;
    const stale = { ...sensors, temperature: { ...sensors.temperature, stale: true }, humidity: { ...sensors.humidity, stale: true } };
    expect(batteryRows(zigbee.nodes, devices, stale, NOW)[0]).toMatchObject({ readingTone: "faint", lastSeenTone: "warn" });
  });

  it("offline: last seen red `Offline · …`, link —, reading text-3 (H8)", () => {
    const { zigbee, devices, environment } = roomState();
    const nodes = zigbee.nodes.map((n) => (n.friendly_name === "r101_motion" ? { ...n, online: false, last_seen: "2026-10-05T10:37:00Z" } : n));
    expect(batteryRows(nodes, devices, environment.sensors, NOW)[1]).toMatchObject({
      reading: "Detected", readingTone: "faint", link: "—", lastSeen: "Offline · 5 min ago", lastSeenTone: "danger",
    });
  });

  it("no reading ever: reading null (H11)", () => {
    const { zigbee, devices, environment } = roomState();
    const sensors = { ...environment.sensors, contact: { kind: "contact" as const, value: null, node: "r101_door", at: null, stale: false } };
    expect(batteryRows(zigbee.nodes, devices, sensors, NOW)[2]?.reading).toBeNull();
  });

  it("no battery nodes: empty list (S2.E19)", () => {
    const { zigbee, devices, environment } = roomState();
    const routersOnly = zigbee.nodes.filter((n) => n.power_source === "mains");
    expect(batteryRows(routersOnly, devices, environment.sensors, NOW)).toEqual([]);
  });
});
