import type { IrDevice } from "@eduscope/contracts";
import { VALUE_TONE_CLASS } from "@/components/state-styles";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { deviceCount, deviceSubtitle } from "./remote.view";

function DeviceItem({ device, selected, onSelect }: { device: IrDevice; selected: boolean; onSelect: () => void }) {
  const pressed = usePressed();
  const count = deviceCount(device);
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      {...pressed}
      onClick={onSelect}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-card border-2 px-4 py-3 text-left",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        selected ? "border-accent-border bg-selected-fill" : "border-border bg-surface",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-card-title font-semibold text-text-1">{device.name}</span>
        <span className="truncate text-caption text-text-2">{deviceSubtitle(device)}</span>
      </span>
      <span className={cn("font-mono text-button font-semibold", VALUE_TONE_CLASS[count.tone])} aria-label={`${count.text} captured`}>
        {count.text}
      </span>
    </button>
  );
}

/** S3.E7/E8: one item per IR device; the selected one in `selected-fill` + green border (lg only). */
export function DeviceList({ devices, selectedId, onSelect }: {
  devices: readonly IrDevice[];
  /** `null` on the phone list view (nothing is open). */
  selectedId: string | null;
  onSelect: (deviceId: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {devices.map((device) => (
        <li key={device.device_id}>
          <DeviceItem device={device} selected={device.device_id === selectedId} onSelect={() => onSelect(device.device_id)} />
        </li>
      ))}
    </ul>
  );
}
