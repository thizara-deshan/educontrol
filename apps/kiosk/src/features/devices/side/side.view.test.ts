import { describe, expect, it } from "vitest";
import { roomState } from "@/data/test/room-state";
import { coordinatorView } from "./side.view";

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
