import { PairDevicesCard } from "./PairDevicesCard";
import { PermitJoinCard } from "./PermitJoinCard";
import { PinsCard } from "./PinsCard";
import { RegistryCard } from "./RegistryCard";

/**
 * S3d: registry (left, ~2/3 at lg), Zigbee permit joining, pair devices (PLAN-H05) and PINs (right).
 * Phone: one column in that order.
 */
export function DevicesTab() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
      <RegistryCard />
      <div className="flex flex-col gap-4 lg:gap-6">
        <PermitJoinCard />
        <PairDevicesCard />
        <PinsCard />
      </div>
    </div>
  );
}
