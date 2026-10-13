import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { CARD_VARIANT_FOR_TONE } from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { CardHeader } from "../CardHeader";
import { screenView } from "./screen.view";

const DEVICE_ID = "projection_screen";

/** S1.E17 / S1.E18: header left, the one action button right (also at 390px). */
export function ScreenCard() {
  const view = useRoomState((state) => {
    const device = state.devices.find((d) => d.id === DEVICE_ID);
    return screenView(state.display.screen, device?.online.value, device?.name ?? "Projection screen");
  });
  const locked = useViewOnly();
  const move = useCommand("screen", DEVICE_ID);

  return (
    <Card variant={view === undefined ? "solid" : CARD_VARIANT_FOR_TONE[view.tone]} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CardHeader title="Projection screen" tone={view?.tone ?? null} line={view?.stateLine ?? null} locked={locked} className="flex-1" />
        <CommandButton
          label={view?.action.label ?? "Raise"}
          size="primary"
          className="w-28 shrink-0"
          pending={move.pending}
          disabled={view === undefined || gateDisablesControl(move.gate) || view.actionBlocked}
          onPress={() => {
            if (view !== undefined) move.send({ kind: "screen.move", to: view.action.to });
          }}
        />
      </div>
      <InlineError message={move.error} />
    </Card>
  );
}
