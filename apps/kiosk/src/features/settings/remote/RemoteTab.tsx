import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { DashedAddButton } from "@/components/DashedAddButton";
import { SectionLabel } from "@/components/SectionLabel";
import { useIrDevices } from "@/data/settings/hooks";
import { LG_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { QueryStatus } from "../shared/QueryStatus";
import { useWritable } from "../shared/use-writable";
import { AddDeviceSheet } from "./AddDeviceSheet";
import { BlasterCard } from "./BlasterCard";
import { DeviceDetail } from "./DeviceDetail";
import { DeviceList } from "./DeviceList";
import { FallbackCard } from "./FallbackCard";
import { selectedDevice } from "./remote.view";

/**
 * S3 Remote configuration. lg: left column (~22%) + right column, either route. Below lg:
 * master → detail through the route (`/settings/remote` = list, `/settings/remote/:deviceId` = commands).
 */
export function RemoteTab() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const query = useIrDevices();
  const writable = useWritable();
  const [adding, setAdding] = useState(false);
  const wide = useMediaQuery(LG_QUERY);
  const devices = query.data;
  const selected = devices === undefined ? undefined : selectedDevice(devices, deviceId);

  // A device that no longer exists (removed in S3d, or a typed URL) → back to the list.
  useEffect(() => {
    if (devices !== undefined && deviceId !== undefined && selected === undefined) {
      void navigate("/settings/remote", { replace: true });
    }
  }, [devices, deviceId, selected, navigate]);

  const showDetail = deviceId !== undefined; // below lg only one view shows
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22%)_minmax(0,1fr)]">
      <div className={cn("flex-col gap-3", showDetail ? "hidden lg:flex" : "flex")}>
        <SectionLabel>Device</SectionLabel>
        {devices === undefined ? (
          <QueryStatus status={query.isError ? "error" : "pending"} what="devices" onRetry={() => void query.refetch()} rows={2} />
        ) : (
          <DeviceList
            devices={devices}
            selectedId={wide || deviceId !== undefined ? (selected?.device_id ?? null) : null}
            onSelect={(id) => void navigate(`/settings/remote/${encodeURIComponent(id)}`)}
          />
        )}
        <DashedAddButton label="Add device" disabled={!writable} onPress={() => setAdding(true)} className="h-14" />
        <BlasterCard />
        <FallbackCard />
      </div>
      <div className={cn("min-w-0", showDetail ? "block" : "hidden lg:block")}>
        {selected !== undefined && <DeviceDetail device={selected} />}
      </div>
      <AddDeviceSheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}
