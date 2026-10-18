import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { StateDot } from "@/components/StateDot";
import { useRoomState } from "@/data/hooks";
import { useDeviceRegistry } from "@/data/settings/hooks";
import { useServerNow } from "@/lib/server-time";
import { QueryStatus } from "../shared/QueryStatus";
import { pairingRows, type PairingRow } from "./pairing.view";

function PairingItem({ row }: { row: PairingRow }) {
  return (
    <li className="flex min-h-12 flex-col gap-1 rounded-btn bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <StateDot tone={row.tone} />
        <span className="min-w-0 flex-1 truncate text-card-title font-semibold text-text-1">{row.name}</span>
        <span className="shrink-0 text-caption text-text-2">{row.status}</span>
      </div>
      <span className="truncate text-caption text-text-3">
        {row.model} · <span className="font-mono">{row.hwRef}</span>
      </span>
      <span className="text-caption text-text-2">{row.resetSteps}</span>
    </li>
  );
}

/**
 * PLAN-H05 D3: moving the devices from another coordinator (the Unistream board) to this one.
 * Permit joining, reset each device, and watch it turn "Heard just now". Read-only: no controls.
 */
export function PairDevicesCard() {
  const query = useDeviceRegistry();
  const nodes = useRoomState((state) => state.zigbee.nodes);
  const now = useServerNow();
  const devices = query.data;
  const rows = devices === undefined || nodes === undefined || now === null ? null : pairingRows(devices, nodes, now);
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>Pair devices</SectionLabel>
      <p className="text-caption text-text-2">
        Press Permit joining, then reset each device. It is back when it shows “Heard just now”.
      </p>
      {rows === null ? (
        <QueryStatus status={query.isError ? "error" : "pending"} what="devices" onRetry={() => void query.refetch()} rows={4} />
      ) : rows.length === 0 ? (
        <p className="text-caption text-text-3">No Zigbee devices reported by the coordinator.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <PairingItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Card>
  );
}
