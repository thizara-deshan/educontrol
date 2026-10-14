import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { hostname, networkInterfaces } from "node:os";
import type { AboutInfo, ConnectedClient, NetworkInfo } from "@eduscope/contracts";
import { z } from "zod";
import { connectionOf, mdnsHostname, parseNmcliWifi, primaryInterface, type InterfaceAddress, type WifiInfo } from "../domain/network.ts";
import { PACKAGE_JSON } from "../paths.ts";

// S3b / S3e facts from the OS. Every probe is fixed (no user input reaches a command line) and
// fails soft: a missing nmcli or device-tree file gives "unknown", never an error.

export const PI_MODEL_PATH = "/proc/device-tree/model";
const NMCLI_TIMEOUT_MS = 2000;

export interface SystemProbe {
  hostname(): string;
  interfaces(): Record<string, readonly InterfaceAddress[] | undefined>;
  /** Active Wi-Fi from nmcli, or null (no nmcli, not on Wi-Fi). */
  wifi(): Promise<WifiInfo | null>;
  /** "Raspberry Pi 5 Model B Rev 1.0", or "unknown" off a Pi. */
  piModel(): string;
  version(): string;
}

/** The device-tree model string without its trailing NUL, or "unknown". */
export function readPiModel(path: string = PI_MODEL_PATH): string {
  try {
    const model = readFileSync(path, "utf8").replace(/\0/g, "").trim();
    return model === "" ? "unknown" : model;
  } catch {
    return "unknown";
  }
}

/** `version` from a package.json, or "unknown". */
export function readVersion(path: string = PACKAGE_JSON): string {
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    return z.object({ version: z.string() }).parse(raw).version;
  } catch {
    return "unknown";
  }
}

function nmcliWifi(): Promise<WifiInfo | null> {
  return new Promise((resolve) => {
    execFile("nmcli", ["-t", "-f", "ACTIVE,SSID,SIGNAL", "dev", "wifi"], { timeout: NMCLI_TIMEOUT_MS }, (error, stdout) => {
      resolve(error === null ? parseNmcliWifi(stdout) : null);
    });
  });
}

export const systemProbe: SystemProbe = {
  hostname: () => hostname(),
  interfaces: () => networkInterfaces(),
  wifi: nmcliWifi,
  piModel: () => readPiModel(),
  version: () => readVersion(),
};

/** S3b. nmcli is asked only when the primary interface is wireless. */
export async function networkInfo(probe: SystemProbe, hw: "up" | "down", clients: ConnectedClient[]): Promise<NetworkInfo> {
  const primary = primaryInterface(probe.interfaces());
  const wireless = primary !== null && connectionOf(primary, null).kind === "wifi";
  return {
    hostname: mdnsHostname(probe.hostname()),
    address: primary?.address ?? null,
    connection: connectionOf(primary, wireless ? await probe.wifi() : null),
    controller: { hw },
    clients,
  };
}

/** S3e. The URL (and QR) always come from ROOM_HOSTNAME, never from the request (ARCHITECTURE §9). */
export function aboutInfo(probe: SystemProbe, room: { id: string; hostname: string; uptimeS: number }): AboutInfo {
  return { room: room.id, version: probe.version(), uptime_s: Math.max(0, Math.floor(room.uptimeS)), pi_model: probe.piModel(), url: `http://${room.hostname}` };
}
