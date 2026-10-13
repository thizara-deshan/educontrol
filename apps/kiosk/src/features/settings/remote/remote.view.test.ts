import type { IrCommand, IrDevice } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import {
  blasterView, commandCountWords, commandStatus, detailSubtitle, deviceCount, deviceSubtitle, selectedDevice, testedAgo,
} from "./remote.view";

const NOW = new Date("2026-10-13T09:00:00Z");
const cmd = (patch: Partial<IrCommand> = {}): IrCommand => ({
  id: "c1", device_id: "projector", name: "Power on", role: "power_on", setpoint: null, code_format: "tuya",
  captured: true, captured_at: "2026-10-01T09:00:00Z", test: "reacted", tested_at: null, ...patch,
});
const device = (commands: IrCommand[], patch: Partial<IrDevice> = {}): IrDevice => ({
  device_id: "projector", name: "Projector", brand: "Epson", kind: "projector", transport: "ir_zs06", commands, ...patch,
});

describe("commandStatus (S3.E14)", () => {
  it.each<[string, Partial<IrCommand>, string, string]>([
    ["not captured", { captured: false, captured_at: null, test: "untested" }, "Not captured", "warn"],
    ["captured, untested (H20)", { test: "untested" }, "Tuya code · captured · untested", "warn"],
    ["no reaction", { test: "no_reaction", tested_at: "2026-10-13T08:59:00Z" }, "Tuya code · no reaction", "danger"],
    ["tested just now", { tested_at: "2026-10-13T08:59:30Z" }, "Tuya code · tested ✓ just now", "muted"],
    ["tested 2 min ago", { tested_at: "2026-10-13T08:58:00Z" }, "Tuya code · tested ✓ 2 min ago", "muted"],
    ["captured, tested before times were kept (screenshot 03)", {}, "Tuya code · captured", "muted"],
  ])("%s", (_name, patch, text, tone) => {
    expect(commandStatus(cmd(patch), NOW)).toEqual({ text, tone });
  });

  it("testedAgo switches from 'just now' at one minute", () => {
    expect(testedAgo("2026-10-13T08:59:01Z", NOW)).toBe("just now");
    expect(testedAgo("2026-10-13T08:59:00Z", NOW)).toBe("1 min ago");
  });
});

describe("device count colour (S3.E7, Q22, H20)", () => {
  it("green when every command is captured and reacted", () => {
    expect(deviceCount(device([cmd(), cmd({ id: "c2" })]))).toEqual({ text: "2", tone: "accent" });
  });
  it("amber when one is untested; counts captured commands only", () => {
    expect(deviceCount(device([cmd(), cmd({ id: "c2", test: "untested" })]))).toEqual({ text: "2", tone: "warn" });
    expect(deviceCount(device([cmd(), cmd({ id: "c2", captured: false, test: "untested" })]))).toEqual({ text: "1", tone: "warn" });
  });
  it("amber after a no reaction; grey 0 with no commands", () => {
    expect(deviceCount(device([cmd({ test: "no_reaction" })]))).toEqual({ text: "1", tone: "warn" });
    expect(deviceCount(device([]))).toEqual({ text: "0", tone: "faint" });
  });
});

describe("subtitles (S3.E7, S3.E12, R8)", () => {
  it("brand · via transport", () => {
    expect(deviceSubtitle(device([]))).toBe("Epson · via ZS06");
    expect(deviceSubtitle(device([], { brand: "", transport: "ir_mcu" }))).toBe("via MCU");
  });
  it("command count in words below ten", () => {
    expect(commandCountWords(0)).toBe("no commands");
    expect(commandCountWords(1)).toBe("one command");
    expect(commandCountWords(2)).toBe("two commands");
    expect(commandCountWords(14)).toBe("14 commands");
    expect(detailSubtitle(device([cmd(), cmd({ id: "c2" })]))).toBe("Epson · two commands · via ZS06");
  });
});

describe("selectedDevice", () => {
  const ac = device([], { device_id: "ac", name: "Air conditioning", kind: "ac" });
  const projector = device([]);
  it("route id wins; unknown id → none", () => {
    expect(selectedDevice([ac, projector], "ac")).toBe(ac);
    expect(selectedDevice([ac, projector], "gone")).toBeUndefined();
  });
  it("without an id: the projector (screenshot 03), else the first", () => {
    expect(selectedDevice([ac, projector], undefined)).toBe(projector);
    expect(selectedDevice([ac], undefined)).toBe(ac);
    expect(selectedDevice([], undefined)).toBeUndefined();
  });
});

describe("blasterView (S3.E10, H25)", () => {
  const blaster = {
    id: "ZS06", topic: "r101_ir", lqi: 196, coverage: "360°, 12 m", power: "mains" as const,
    online: { value: true, confidence: "confirmed" as const, source: "ir" as const, updated_at: "2026-10-13T08:55:00Z", stale: false, changed_by: null },
  };
  it("online: LQI", () => {
    expect(blasterView(blaster, NOW)).toEqual({ id: "ZS06", online: true, link: { text: "LQI 196", tone: "muted" }, topic: "r101_ir", coverage: "360°, 12 m" });
  });
  it("offline: red, last seen since the flag changed", () => {
    const offline = { ...blaster, online: { ...blaster.online, value: false } };
    expect(blasterView(offline, NOW).link).toEqual({ text: "Offline · last seen 5 min ago", tone: "danger" });
  });
});
