import { Card } from "@/components/Card";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { batteryRows, type BatteryRowView } from "./battery.view";

/** READING cell: the value, or H11 "—" + "No reading yet". */
function Reading({ row }: { row: BatteryRowView }) {
  if (row.reading === null) {
    return (
      <span className="flex flex-col font-mono text-card-title font-semibold text-text-3">
        —<span className="font-sans text-caption font-normal">No reading yet</span>
      </span>
    );
  }
  return <span className={cn("font-mono text-card-title font-semibold", VALUE_TONE_CLASS[row.readingTone])}>{row.reading}</span>;
}

/**
 * S2.E14–E19. ≥600: a table (DEVICE · READING · BATTERY · LINK · LAST SEEN). <600: one card per device
 * (line 1 name + reading, line 2 model · friendly name, line 3 battery · link · last seen). Two markups
 * of the same rows in one component: allowed for tables only (ARCHITECTURE §4.1).
 */
export function BatteryList() {
  const now = useServerNow();
  const data = useRoomState((s) => ({ nodes: s.zigbee.nodes, devices: s.devices, sensors: s.environment.sensors, serverTime: s.server_time }));
  const rows = data === undefined ? null : batteryRows(data.nodes, data.devices, data.sensors, now ?? new Date(data.serverTime));

  if (rows === null) {
    return (
      <Card className="flex flex-col gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-caption text-text-2">No battery devices paired</p>
      </Card>
    );
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-border bg-surface sm:block">
        <table className="w-full text-left">
          <thead>
            <tr className="text-section uppercase text-text-2">
              <th scope="col" className="px-4 py-3 font-bold">Device</th>
              <th scope="col" className="px-4 py-3 font-bold">Reading</th>
              <th scope="col" className="w-24 px-4 py-3 font-bold">Battery</th>
              <th scope="col" className="w-20 px-4 py-3 font-bold">Link</th>
              <th scope="col" className="w-40 px-4 py-3 font-bold">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border bg-surface-2">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="block text-card-title font-semibold text-text-1">{row.name}</span>
                  <span className="block font-mono text-caption text-text-3">{row.ids}</span>
                </th>
                <td className="px-4 py-3">
                  <Reading row={row} />
                </td>
                <td className={cn("px-4 py-3 font-mono text-caption", VALUE_TONE_CLASS[row.batteryTone])}>{row.battery}</td>
                <td className={cn("px-4 py-3 font-mono text-caption", row.link === "—" ? "text-text-3" : "text-text-2")}>{row.link}</td>
                <td className={cn("px-4 py-3 text-caption", VALUE_TONE_CLASS[row.lastSeenTone])}>{row.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-card-title font-semibold text-text-1">{row.name}</span>
              <Reading row={row} />
            </div>
            <p className="break-all font-mono text-caption text-text-3">{row.ids}</p>
            <p className="flex flex-wrap gap-x-2 text-caption text-text-3">
              <span>
                Battery <span className={cn("font-mono", VALUE_TONE_CLASS[row.batteryTone])}>{row.battery}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Link <span className="font-mono text-text-2">{row.link}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className={VALUE_TONE_CLASS[row.lastSeenTone]}>{row.lastSeen}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
