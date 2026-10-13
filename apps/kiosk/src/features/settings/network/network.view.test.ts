import type { NetworkInfo } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { clientsSummary, connectionText, networkRows } from "./network.view";

const info: NetworkInfo = {
  hostname: "r-101.local", address: "192.168.10.41", connection: { kind: "ethernet" }, controller: { hw: "up" },
  clients: [
    { public_id: null, label: "room screen", client_type: "kiosk", access: "control" },
    { public_id: "p", label: "phone", client_type: "remote", access: "control" },
    { public_id: null, label: "phone", client_type: "remote", access: "view" },
    { public_id: "me", label: "laptop", client_type: "remote", access: "technician" },
  ],
};

describe("network view (S3b)", () => {
  it("rows: hostname, address, connection, controller, client count", () => {
    expect(networkRows(info).map((row) => [row.label, row.value, row.tone])).toEqual([
      ["Hostname", "r-101.local", "default"],
      ["Address", "192.168.10.41", "default"],
      ["Connection", "Ethernet", "default"],
      ["Controller", "Online", "accent"],
      ["Connected clients", "4", "default"],
    ]);
  });
  it("hw-service down and no address", () => {
    const rows = networkRows({ ...info, address: null, controller: { hw: "down" } });
    expect(rows[1]?.value).toBeNull();
    expect(rows[3]).toMatchObject({ value: "Hardware service down", tone: "danger" });
  });
  it("connection variants", () => {
    expect(connectionText({ kind: "wifi", ssid: "Campus", signal_pct: 72 })).toEqual({ text: "Wi-Fi · Campus · 72%", tone: "default" });
    expect(connectionText({ kind: "wifi", ssid: "Campus", signal_pct: null }).text).toBe("Wi-Fi · Campus");
    expect(connectionText({ kind: "none" })).toEqual({ text: "Not connected", tone: "danger" });
  });
  it("clients summary groups labels: 'phone ×2'", () => {
    expect(clientsSummary(info.clients)).toBe("room screen · phone ×2 · laptop");
    expect(clientsSummary([])).toBe("");
  });
});
