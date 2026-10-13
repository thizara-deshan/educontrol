import { Card } from "@/components/Card";
import { InlineError } from "@/components/InlineError";
import { ToggleRow } from "@/components/ToggleRow";
import { CARD_VARIANT_FOR_TONE } from "@/components/state-styles";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { CardHeader } from "../CardHeader";
import { lightsView, nextLightOn } from "./lights.view";

const DEVICE_ID = "lights";

/** S1.E31–E33: the whole ≥56px row toggles (R6). */
export function LightsCard() {
  const lights = useRoomState((state) => state.environment.lights);
  const device = useRoomState((state) => state.devices.find((d) => d.id === DEVICE_ID));
  const locked = useViewOnly();
  const front = useCommand("lights.front", DEVICE_ID);
  const rear = useCommand("lights.rear", DEVICE_ID);
  const view = device === undefined ? null : lightsView(device.online.value);
  const tag = device?.model?.split("-")[0] ?? null; // "ZBM5-2C-86W" → "ZBM5"

  return (
    <Card variant={view === null ? "solid" : CARD_VARIANT_FOR_TONE[view.tone]} className="flex flex-col gap-3">
      <CardHeader
        title="Lights"
        tone={view?.tone ?? null}
        line={view?.line ?? null}
        locked={locked}
        aside={tag !== null && <span className="mt-1 font-mono text-caption font-semibold text-text-3">{tag}</span>}
      />
      <div className="flex flex-col gap-2">
        <ToggleRow
          label="Front of room"
          on={lights?.front.value ?? null}
          pending={front.pending}
          disabled={lights === undefined || gateDisablesControl(front.gate)}
          onToggle={() => front.send({ kind: "lights.set", gang: "front", on: nextLightOn(lights?.front.value ?? null) })}
        />
        <ToggleRow
          label="Rear of room"
          on={lights?.rear.value ?? null}
          pending={rear.pending}
          disabled={lights === undefined || gateDisablesControl(rear.gate)}
          onToggle={() => rear.send({ kind: "lights.set", gang: "rear", on: nextLightOn(lights?.rear.value ?? null) })}
        />
      </div>
      <InlineError message={front.error ?? rear.error} />
    </Card>
  );
}
