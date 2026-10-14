import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { aboutInfo, networkInfo, readPiModel, readVersion, type SystemProbe } from "../../src/system/info.ts";

function probe(overrides: Partial<SystemProbe> = {}): SystemProbe {
  return {
    hostname: () => "r-101",
    interfaces: () => ({ lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }], eth0: [{ address: "192.168.1.20", family: "IPv4", internal: false }] }),
    wifi: vi.fn(async () => ({ ssid: "R101-Staff", signal_pct: 72 })),
    piModel: () => "Raspberry Pi 5 Model B Rev 1.0",
    version: () => "0.0.0",
    ...overrides,
  };
}

describe("system info", () => {
  it("S3b on Ethernet: hostname.local, address, controller, clients; nmcli not asked", async () => {
    const p = probe();
    const clients = [{ public_id: null, label: "room screen", client_type: "kiosk", access: "control" }] as const;
    expect(await networkInfo(p, "up", [...clients])).toEqual({
      hostname: "r-101.local", address: "192.168.1.20", connection: { kind: "ethernet" }, controller: { hw: "up" }, clients: [...clients],
    });
    expect(p.wifi).not.toHaveBeenCalled();
  });

  it("S3b on Wi-Fi asks nmcli", async () => {
    const p = probe({ interfaces: () => ({ wlan0: [{ address: "192.168.1.21", family: "IPv4", internal: false }] }) });
    expect((await networkInfo(p, "down", [])).connection).toEqual({ kind: "wifi", ssid: "R101-Staff", signal_pct: 72 });
  });

  it("S3e about: URL from the room hostname, whole seconds of uptime", () => {
    expect(aboutInfo(probe(), { id: "R-101", hostname: "r-101.local", uptimeS: 3725.9 })).toEqual({
      room: "R-101", version: "0.0.0", uptime_s: 3725, pi_model: "Raspberry Pi 5 Model B Rev 1.0", url: "http://r-101.local",
    });
  });

  it("reads the Pi model (NUL stripped) or 'unknown', and the package version", () => {
    const dir = mkdtempSync(join(tmpdir(), "eduscope-model-"));
    const model = join(dir, "model");
    writeFileSync(model, "Raspberry Pi 5 Model B Rev 1.0\0");
    expect(readPiModel(model)).toBe("Raspberry Pi 5 Model B Rev 1.0");
    expect(readPiModel(join(dir, "missing"))).toBe("unknown");
    expect(readVersion()).toBe("0.0.0");
    expect(readVersion(join(dir, "missing.json"))).toBe("unknown");
  });
});
