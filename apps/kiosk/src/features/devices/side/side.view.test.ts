import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { coordinatorView, joiningText, meshView } from "./side.view";

describe("coordinatorView (S2.E20)", () => {
  it("screenshot 02 values", () => {
    expect(coordinatorView(roomState().zigbee.coordinator)).toEqual({
      model: "ZG-808Z",
      greyed: false,
      rows: [
        { label: "Chipset", value: "CC2652P1", tone: "default" },
        { label: "Firmware", value: "Z-Stack 3.x.0", tone: "default" },
        { label: "Channel", value: "25", tone: "default" },
        { label: "Transmit", value: "+20 dBm", tone: "default" },
        { label: "Port", value: "zigbee-coord", tone: "default" },
        { label: "Antenna", value: "SMA, external", tone: "default" },
      ],
    });
  });
  it("offline greys every value (H9)", () => {
    const view = coordinatorView({ ...roomState().zigbee.coordinator, status: "offline" });
    expect(view.greyed).toBe(true);
    expect(view.rows.every((row) => row.tone === "faint")).toBe(true);
  });
});

const NOW = new Date("2026-10-05T10:42:00Z");

describe("joiningText (S2.E21)", () => {
  it("closed", () => {
    expect(joiningText({ state: "closed" }, NOW)).toEqual({ text: "Closed", tone: "default" });
  });
  it("open: `Open · 4:12 left` in amber, counting down", () => {
    const joining = { state: "open" as const, until: "2026-10-05T10:46:12Z" };
    expect(joiningText(joining, NOW)).toEqual({ text: "Open · 4:12 left", tone: "warn" });
    expect(joiningText(joining, new Date("2026-10-05T10:42:01Z")).text).toBe("Open · 4:11 left");
    expect(joiningText(joining, new Date("2026-10-05T10:47:00Z")).text).toBe("Open · 0:00 left");
  });
});

describe("meshView (S2.E21)", () => {
  it("5 paired; routers accent; greyed when the coordinator is offline", () => {
    const { mesh } = roomState().zigbee;
    expect(meshView(mesh, "online", NOW)).toEqual({
      paired: "5",
      greyed: false,
      rows: [
        { label: "Routers", value: "2", tone: "accent" },
        { label: "End devices", value: "3", tone: "default" },
        { label: "Joining", value: "Closed", tone: "default" },
      ],
    });
    expect(meshView(mesh, "offline", NOW).rows.map((r) => r.tone)).toEqual(["faint", "faint", "faint"]);
  });
});
