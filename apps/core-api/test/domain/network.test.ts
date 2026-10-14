import { describe, expect, it } from "vitest";
import { connectionOf, mdnsHostname, parseNmcliWifi, primaryInterface } from "../../src/domain/network.ts";

const v4 = (address: string, internal = false) => ({ address, family: "IPv4", internal });
const v6 = (address: string) => ({ address, family: "IPv6", internal: false });

describe("S3b network", () => {
  it("picks the first external IPv4, wired before Wi-Fi, skipping loopback and bridges", () => {
    expect(primaryInterface({ lo: [v4("127.0.0.1", true)], wlan0: [v6("fe80::1"), v4("192.168.1.40")], eth0: [v4("10.0.0.5")] })).toEqual({
      name: "eth0", address: "10.0.0.5",
    });
    expect(primaryInterface({ docker0: [v4("172.17.0.1")], wlp3s0: [v4("192.168.1.41")] })).toEqual({ name: "wlp3s0", address: "192.168.1.41" });
    expect(primaryInterface({ lo: [v4("127.0.0.1", true)], eth0: undefined })).toBeNull();
  });

  it("names the host for mDNS", () => {
    expect(mdnsHostname("r-101")).toBe("r-101.local");
    expect(mdnsHostname("r-101.local")).toBe("r-101.local");
  });

  it("reads the active Wi-Fi from nmcli terse output", () => {
    expect(parseNmcliWifi("no:Guest:40\nyes:R101\\:Staff:72\n")).toEqual({ ssid: "R101:Staff", signal_pct: 72 });
    expect(parseNmcliWifi("yes::\n")).toEqual({ ssid: "", signal_pct: null });
    expect(parseNmcliWifi("no:Guest:40\n")).toBeNull();
    expect(parseNmcliWifi("")).toBeNull();
  });

  it("describes the connection", () => {
    expect(connectionOf({ name: "eth0" }, null)).toEqual({ kind: "ethernet" });
    expect(connectionOf({ name: "wlan0" }, { ssid: "R101-Staff", signal_pct: 72 })).toEqual({ kind: "wifi", ssid: "R101-Staff", signal_pct: 72 });
    expect(connectionOf({ name: "wlan0" }, null)).toEqual({ kind: "wifi", ssid: "unknown network", signal_pct: null });
    expect(connectionOf({ name: "wlan0" }, { ssid: "", signal_pct: 50 })).toEqual({ kind: "wifi", ssid: "unknown network", signal_pct: 50 });
    expect(connectionOf(null, null)).toEqual({ kind: "none" });
  });
});
