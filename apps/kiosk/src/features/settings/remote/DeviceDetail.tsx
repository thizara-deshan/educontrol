import type { IrDevice } from "@eduscope/contracts";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { DashedAddButton } from "@/components/DashedAddButton";
import { useRoomState } from "@/data/hooks";
import { usePressed } from "@/lib/use-pressed";
import { useWritable } from "../shared/use-writable";
import { AddCommandSheet } from "./AddCommandSheet";
import { CommandRow } from "./CommandRow";
import { HowCaptureWorks } from "./HowCaptureWorks";
import { detailSubtitle } from "./remote.view";

function BackToList() {
  const pressed = usePressed();
  return (
    <Link
      to="/settings/remote"
      {...pressed}
      className="flex h-12 items-center gap-2 self-start rounded-btn border border-border-strong bg-control px-3 text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 lg:hidden"
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
      All devices
    </Link>
  );
}

/** S3.E12–E17: the right column (lg) or the phone detail view (with the back arrow). */
export function DeviceDetail({ device }: { device: IrDevice }) {
  const [adding, setAdding] = useState(false);
  const writable = useWritable();
  const blasterOnline = useRoomState((state) => state.ir_blaster.online.value === true) ?? false;
  const blasterBlocks = device.transport === "ir_zs06" && !blasterOnline; // H25
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BackToList />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 className="text-title font-bold text-text-1">{device.name}</h2>
        <p className="text-caption text-text-2">{detailSubtitle(device)}</p>
      </div>
      <section className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="hidden h-12 grid-cols-[minmax(0,2fr)_minmax(0,3fr)_12.5rem] items-center gap-4 px-4 sm:grid">
          <span className="text-section font-bold uppercase text-text-2">Command</span>
          <span className="text-section font-bold uppercase text-text-2">Capture</span>
          <span />
        </div>
        {device.commands.length === 0 ? (
          <p className="border-t border-border bg-surface-2 px-4 py-4 text-caption text-text-2">No commands yet</p>
        ) : (
          <ul>
            {device.commands.map((command) => (
              <CommandRow key={command.id} command={command} device={device} />
            ))}
          </ul>
        )}
      </section>
      <DashedAddButton label="Add a command" disabled={!writable || blasterBlocks} onPress={() => setAdding(true)} className="h-14" />
      <HowCaptureWorks />
      <AddCommandSheet key={device.device_id} device={device} open={adding} onOpenChange={setAdding} />
    </div>
  );
}
