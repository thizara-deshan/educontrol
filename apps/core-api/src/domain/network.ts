import type { NetworkConnection } from "@eduscope/contracts";

// S3b Network, the parts that are pure: which interface is "the" address, the mDNS name, and
// what `nmcli` says about Wi-Fi. Probing the OS lives in system/info.ts.

/** The shape of one entry of `os.networkInterfaces()` that matters here. */
export interface InterfaceAddress {
  address: string;
  family: string;
  internal: boolean;
}

export interface WifiInfo {
  ssid: string;
  signal_pct: number | null;
}

const WIRED = /^(eth|en)/;
const WIRELESS = /^(wl|wlan)/;
const VIRTUAL = /^(docker|br-|veth|virbr|tun|tap|lo)/;

/** S3b "Address": the first external IPv4, wired before Wi-Fi before anything else (virtual bridges skipped). */
export function primaryInterface(interfaces: Readonly<Record<string, readonly InterfaceAddress[] | undefined>>): { name: string; address: string } | null {
  const candidates = Object.entries(interfaces).flatMap(([name, addresses]) =>
    VIRTUAL.test(name) ? [] : (addresses ?? []).filter((a) => a.family === "IPv4" && !a.internal).map((a) => ({ name, address: a.address })),
  );
  const rank = (name: string): number => (WIRED.test(name) ? 0 : WIRELESS.test(name) ? 1 : 2);
  return [...candidates].sort((a, b) => rank(a.name) - rank(b.name))[0] ?? null;
}

/** avahi publishes `<hostname>.local` (ARCHITECTURE §9) [ASSUMED]; a dotted name is kept as it is. */
export function mdnsHostname(hostname: string): string {
  return hostname.includes(".") ? hostname : `${hostname}.local`;
}

/**
 * The active network from `nmcli -t -f ACTIVE,SSID,SIGNAL dev wifi` ("yes:R101-Staff:72"; nmcli escapes
 * ":" in an SSID as "\:"). Null when no line is active.
 */
export function parseNmcliWifi(stdout: string): WifiInfo | null {
  for (const line of stdout.split("\n")) {
    const match = /^yes:(.*):(\d*)$/.exec(line.trim());
    if (match === null) continue;
    const ssid = (match[1] ?? "").replace(/\\(.)/g, "$1");
    const signal = match[2] === undefined || match[2] === "" ? null : Math.min(100, Number(match[2]));
    return { ssid, signal_pct: signal };
  }
  return null;
}

/** Shown as the SSID when nmcli is missing or the network hides its name ("Wi-Fi · unknown network"). */
export const UNKNOWN_SSID = "unknown network";

/** S3b "Connection": Ethernet, Wi-Fi with SSID/signal when nmcli knows them, or none. */
export function connectionOf(primary: { name: string } | null, wifi: WifiInfo | null): NetworkConnection {
  if (primary === null) return { kind: "none" };
  if (!WIRELESS.test(primary.name)) return { kind: "ethernet" };
  return { kind: "wifi", ssid: wifi === null || wifi.ssid === "" ? UNKNOWN_SSID : wifi.ssid, signal_pct: wifi?.signal_pct ?? null };
}
