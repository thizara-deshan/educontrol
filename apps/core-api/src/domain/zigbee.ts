import type { Coordinator, Mesh, ZigbeeNode } from "@eduscope/contracts";

// S2 side column: mesh counts derived from the node list (hw sends no counts, ARCHITECTURE §3.4).
// Decision (M05-L2): `routers` / `end_devices` count PAIRED nodes, online or not, like `paired`.

export function deriveMesh(nodes: readonly ZigbeeNode[], joiningUntil: string | null, now: Date): Mesh {
  const open = joiningUntil !== null && Date.parse(joiningUntil) > now.getTime();
  return {
    paired: nodes.length,
    routers: nodes.filter((node) => node.role === "router").length,
    end_devices: nodes.filter((node) => node.role === "end_device").length,
    joining: open && joiningUntil !== null ? { state: "open", until: joiningUntil } : { state: "closed" },
  };
}

/** A `zigbee.node` report replaces the node with the same IEEE address, or adds it. */
export function upsertNode(nodes: readonly ZigbeeNode[], node: ZigbeeNode): ZigbeeNode[] {
  const index = nodes.findIndex((existing) => existing.ieee === node.ieee);
  if (index === -1) return [...nodes, node];
  return nodes.map((existing, i) => (i === index ? node : existing));
}

/** Before hw reports a coordinator: the registry's model, everything else blank, status offline. */
export function placeholderCoordinator(model: string | null, port: string | null): Coordinator {
  return { model: model ?? "", chipset: "", firmware: "", channel: 0, tx_power_dbm: 0, port: port ?? "", antenna: "", status: "offline" };
}
