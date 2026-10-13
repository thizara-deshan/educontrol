import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { CARD_VARIANT_FOR_TONE, VALUE_TONE_CLASS } from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { CardHeader } from "../CardHeader";
import { projectorView } from "./projector.view";

/** S1.E13–E16. Power on/off go over IR, so they follow the blaster (H25). */
export function ProjectorCard() {
  const view = useRoomState((state) =>
    projectorView({
      projector: state.display.projector,
      interlock: state.interlock,
      meterOnline: state.devices.find((d) => d.id === "projector_socket")?.online.value,
      blasterOnline: state.devices.find((d) => d.id === "ir_blaster")?.online.value,
    }),
  );
  const locked = useViewOnly();
  const on = useCommand("projector.ir:on", "ir_blaster");
  const off = useCommand("projector.ir:off", "ir_blaster");

  return (
    <Card variant={view === undefined ? "solid" : CARD_VARIANT_FOR_TONE[view.tone]} className="flex flex-col gap-3">
      <CardHeader
        title="Projector"
        tone={view?.tone ?? null}
        line={view?.stateLine ?? null}
        locked={locked}
        aside={
          view === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <span className={cn("shrink-0 font-mono text-value font-semibold", VALUE_TONE_CLASS[view.wattsTone])}>{view.watts}</span>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <CommandButton
          label="Power on"
          size="primary"
          active={view?.powerOnActive ?? null}
          pending={on.pending}
          disabled={gateDisablesControl(on.gate) || view?.powerOnBlocked === true}
          onPress={() => on.send({ kind: "projector.power", on: true })}
        />
        <CommandButton
          label="Power off"
          size="primary"
          active={view?.powerOffActive ?? null}
          pending={off.pending}
          disabled={gateDisablesControl(off.gate)}
          onPress={() => off.send({ kind: "projector.power", on: false })}
        />
      </div>
      <p className="text-caption text-text-2">Commanded over IR · state read back from the S60 power meter</p>
      {view?.holdLine != null && <p className="text-caption text-warn">{view.holdLine}</p>}
      {view?.blasterLine != null && <p className="text-caption text-danger">{view.blasterLine}</p>}
      <InlineError message={on.error ?? off.error} />
    </Card>
  );
}
