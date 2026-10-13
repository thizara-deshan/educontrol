import type { ConnectedClient, NetworkConnection, NetworkInfo } from "@eduscope/contracts";
import type { ValueTone } from "@/components/state-styles";

// S3b rows (read-only in v1).

export interface NetworkRow {
  label: string;
  value: string | null;
  mono: boolean;
  tone: ValueTone;
}

/** "Ethernet" / "Wi-Fi · {SSID} · {signal}" / "Not connected" (red) `[INFERRED]`. */
export function connectionText(connection: NetworkConnection): { text: string; tone: ValueTone } {
  switch (connection.kind) {
    case "ethernet":
      return { text: "Ethernet", tone: "default" };
    case "wifi":
      return { text: ["Wi-Fi", connection.ssid, connection.signal_pct === null ? null : `${connection.signal_pct}%`].filter((p) => p !== null).join(" · "), tone: "default" };
    case "none":
      return { text: "Not connected", tone: "danger" };
  }
}

/** "room screen · phone ×2 · laptop": one entry per label, in first-seen order. */
export function clientsSummary(clients: readonly ConnectedClient[]): string {
  const counts = new Map<string, number>();
  for (const client of clients) counts.set(client.label, (counts.get(client.label) ?? 0) + 1);
  return [...counts].map(([label, count]) => (count === 1 ? label : `${label} ×${count}`)).join(" · ");
}

export function networkRows(info: NetworkInfo): NetworkRow[] {
  const connection = connectionText(info.connection);
  const hwUp = info.controller.hw === "up";
  return [
    { label: "Hostname", value: info.hostname, mono: true, tone: "default" },
    { label: "Address", value: info.address, mono: true, tone: "default" },
    { label: "Connection", value: connection.text, mono: false, tone: connection.tone },
    // "Hardware service down" when core-api runs but hw-service does not `[INFERRED]`.
    { label: "Controller", value: hwUp ? "Online" : "Hardware service down", mono: false, tone: hwUp ? "accent" : "danger" },
    { label: "Connected clients", value: String(info.clients.length), mono: true, tone: "default" },
  ];
}
