import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import { CardHeader } from "../CardHeader";
import { acView } from "./ac.view";

const BLASTER = "ir_blaster";

/** S1.E34–E40. The border is always dashed (R3: AC is assumed at best). */
export function AcCard() {
  const view = useRoomState((state) =>
    acView(state.environment.ac, state.devices.find((d) => d.id === BLASTER)?.online.value),
  );
  const locked = useViewOnly();
  const on = useCommand("ac:on", BLASTER);
  const off = useCommand("ac:off", BLASTER);
  const down = useCommand("ac:down", BLASTER);
  const up = useCommand("ac:up", BLASTER);

  return (
    <Card variant="dashed" className="flex flex-col gap-3">
      <CardHeader
        title="Air conditioning"
        tone={view?.tone ?? null}
        line={view?.stateLine ?? null}
        locked={locked}
        aside={<span className="mt-1 text-sensor-label font-bold uppercase text-text-2">IR remote</span>}
      />
      <div className="grid grid-cols-2 gap-3">
        <CommandButton
          label="Power on"
          size="primary"
          active={view?.powerOnActive ?? null}
          pending={on.pending}
          disabled={view === undefined || gateDisablesControl(on.gate)}
          onPress={() => on.send({ kind: "ac.power", on: true })}
        />
        <CommandButton
          label="Power off"
          size="primary"
          active={view?.powerOffActive ?? null}
          pending={off.pending}
          disabled={view === undefined || gateDisablesControl(off.gate)}
          onPress={() => off.send({ kind: "ac.power", on: false })}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-caption text-text-2">Setpoint</span>
        <CommandButton
          label="−"
          className="size-16 px-0 text-title"
          pending={down.pending}
          disabled={view?.canStepDown !== true || gateDisablesControl(down.gate)}
          onPress={() => down.send({ kind: "ac.step", direction: "down" })}
        />
        {view === undefined ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <span className={cn("w-20 text-center font-mono text-value font-semibold", view.setpointDimmed ? "text-text-3" : "text-text-1")}>
            {view.setpoint}
          </span>
        )}
        <CommandButton
          label="+"
          className="size-16 px-0 text-title"
          pending={up.pending}
          disabled={view?.canStepUp !== true || gateDisablesControl(up.gate)}
          onPress={() => up.send({ kind: "ac.step", direction: "up" })}
        />
      </div>
      {view?.blasterLine != null && <p className="text-caption text-danger">{view.blasterLine}</p>}
      <InlineError message={on.error ?? off.error ?? down.error ?? up.error} />
    </Card>
  );
}
