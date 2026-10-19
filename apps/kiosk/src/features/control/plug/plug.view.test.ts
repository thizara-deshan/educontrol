import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { nextPlugOn, plugView } from "./plug.view";

const NOW = new Date("2026-10-05T10:42:00Z");
const plug = roomState().plug;

describe("plugView (D-34)", () => {
  it("online with a report: confirmed, the four readings", () => {
    expect(plugView(plug, NOW)).toEqual({
      tone: "confirmed", line: "Confirmed by the plug", online: true, staleAgo: null,
      metrics: [
        { label: "Power", value: "42.5", unit: "W" },
        { label: "Voltage", value: "231", unit: "V" },
        { label: "Current", value: "0.21", unit: "A" },
        { label: "Today", value: "0.34", unit: "kWh" },
      ],
    });
  });

  it("offline keeps the last values", () => {
    const view = plugView({ ...plug, online: false }, NOW);
    expect(view).toMatchObject({ tone: "offline", line: "Plug offline · last known state", online: false });
    expect(view.metrics[0]?.value).toBe("42.5");
  });

  it("never reported: unknown, no readings (H11)", () => {
    const fresh = {
      on: { ...plug.on, value: null, confidence: "unknown" as const, updated_at: null },
      reading: { ...plug.reading, value: null, confidence: "unknown" as const, updated_at: null },
      online: true,
    };
    const view = plugView(fresh, NOW);
    expect(view).toMatchObject({ tone: "unknown", line: "Waiting for the plug" });
    expect(view.metrics.map((m) => m.value)).toEqual([null, null, null, null]);
  });

  it("a stale meter shows how old it is (H10)", () => {
    const stale = { ...plug, reading: { ...plug.reading, stale: true, updated_at: "2026-10-05T10:28:00Z" } };
    expect(plugView(stale, NOW).staleAgo).toBe("14 min ago");
  });

  it("a tap flips the server value; unknown turns it on", () => {
    expect([nextPlugOn(true), nextPlugOn(false), nextPlugOn(null)]).toEqual([false, true, true]);
  });
});
