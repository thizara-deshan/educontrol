import type { Device } from "@eduscope/contracts";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { useDeviceRegistry } from "@/data/settings/hooks";
import { usePressed } from "@/lib/use-pressed";
import { QueryStatus } from "../shared/QueryStatus";
import { DeviceEditSheet } from "./DeviceEditSheet";
import { registryRow } from "./devices.view";

function RegistryItem({ device, onOpen }: { device: Device; onOpen: () => void }) {
  const pressed = usePressed();
  const row = registryRow(device);
  return (
    <li>
      <button
        type="button"
        {...pressed}
        onClick={onOpen}
        className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-btn bg-surface-2 px-4 py-2 text-left active:brightness-125 data-[pressed=true]:brightness-125 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5rem_minmax(0,1.5fr)_auto]"
      >
        <span className="truncate text-card-title font-semibold text-text-1">{row.name}</span>
        <ChevronRight aria-hidden="true" className="col-start-2 row-span-2 size-5 text-text-3 sm:col-start-5 sm:row-span-1" />
        {/* Phone: line 2 = kind · transport · id. ≥600: columns. */}
        <span className="truncate text-caption text-text-2 sm:hidden">
          {row.kind} · {row.transport} · <span className="font-mono">{row.hardwareId}</span>
        </span>
        <span className="hidden truncate text-caption text-text-2 sm:col-start-2 sm:row-start-1 sm:block">{row.kind}</span>
        <span className="hidden text-caption text-text-2 sm:col-start-3 sm:row-start-1 sm:block">{row.transport}</span>
        <span className="hidden truncate font-mono text-caption text-text-2 sm:col-start-4 sm:row-start-1 sm:block">{row.hardwareId}</span>
      </button>
    </li>
  );
}

/** S3d registry of every room device; a row opens the edit sheet. */
export function RegistryCard() {
  const query = useDeviceRegistry();
  const [editing, setEditing] = useState<string | null>(null);
  const devices = query.data;
  const editingDevice = devices?.find((device) => device.id === editing);
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>Room devices</SectionLabel>
      {devices === undefined ? (
        <QueryStatus status={query.isError ? "error" : "pending"} what="devices" onRetry={() => void query.refetch()} rows={6} />
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((device) => (
            <RegistryItem key={device.id} device={device} onOpen={() => setEditing(device.id)} />
          ))}
        </ul>
      )}
      {editingDevice !== undefined && <DeviceEditSheet key={editingDevice.id} device={editingDevice} onClose={() => setEditing(null)} />}
    </Card>
  );
}
