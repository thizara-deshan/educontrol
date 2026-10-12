import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { LevelSlider } from "@/components/LevelSlider";
import { LockBadge } from "@/components/LockBadge";
import { MetricTile } from "@/components/MetricTile";
import { ObservedLine } from "@/components/ObservedLine";
import { SectionLabel } from "@/components/SectionLabel";
import { SensorTile } from "@/components/SensorTile";
import { ToggleRow } from "@/components/ToggleRow";
import { stateTone } from "@/components/state-styles";
import { gateDisablesControl, type ControlGate } from "@/data/gate";
import { useCommand, useRoomState } from "@/data/hooks";
import { formatCelsius, formatWatts } from "@/lib/format";

/** Section header with the H12 padlock while the session is `view`. */
function DemoHeader({ title, gate }: { title: string; gate: ControlGate }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <SectionLabel>{title}</SectionLabel>
      {gate.reason === "locked" && <LockBadge />}
    </div>
  );
}

/** Controls wired to the mock through the real command flow and access gate (M02 AC4–7, M03 AC1). */
export function LiveDemo() {
  const projector = useRoomState((state) => state.display.projector);
  const lights = useRoomState((state) => state.environment.lights);
  const mic = useRoomState((state) => state.audio.channels.mic);
  const temperature = useRoomState((state) => state.environment.sensors.temperature);
  const lightsOnline = useRoomState((state) => state.devices.find((d) => d.id === "lights")?.online.value);

  const powerOn = useCommand("projector.ir:on", "projector");
  const powerOff = useCommand("projector.ir:off", "projector");
  const front = useCommand("lights.front", "lights");
  const rear = useCommand("lights.rear", "lights");
  const micLevel = useCommand("audio.mic", "audio");

  const loading = projector === undefined;
  const running = projector?.state.value === "running" || projector?.state.value === "warming_up";
  const lightsTone = stateTone({ confidence: "confirmed", active: true, offline: lightsOnline === false });

  return (
    <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-3">
        <DemoHeader title="Live · projector" gate={powerOn.gate} />
        <ObservedLine
          loading={loading}
          tone={stateTone({ confidence: projector?.state.confidence ?? "unknown", active: running })}
          text={projector?.state.value ?? ""}
        />
        <div className="grid grid-cols-2 gap-3">
          <CommandButton
            label="Power on"
            size="primary"
            active={running ? "confirmed" : null}
            pending={powerOn.pending}
            disabled={gateDisablesControl(powerOn.gate)}
            onPress={() => powerOn.send({ kind: "projector.power", on: true })}
          />
          <CommandButton
            label="Power off"
            size="primary"
            active={!loading && !running ? "neutral" : null}
            pending={powerOff.pending}
            disabled={gateDisablesControl(powerOff.gate)}
            onPress={() => powerOff.send({ kind: "projector.power", on: false })}
          />
        </div>
        <InlineError message={powerOn.error ?? powerOff.error} />
      </div>

      <div className="flex flex-col gap-3">
        <DemoHeader title="Live · lights" gate={front.gate} />
        <ObservedLine
          loading={lights === undefined}
          tone={lightsTone}
          text={lightsOnline === false ? "Switch offline · last known state" : "Confirmed by the switch"}
        />
        <ToggleRow
          label="Front of room"
          on={lights?.front.value ?? null}
          pending={front.pending}
          disabled={gateDisablesControl(front.gate)}
          onToggle={() => front.send({ kind: "lights.set", gang: "front", on: lights?.front.value !== true })}
        />
        <ToggleRow
          label="Rear of room"
          on={lights?.rear.value ?? null}
          pending={rear.pending}
          disabled={gateDisablesControl(rear.gate)}
          onToggle={() => rear.send({ kind: "lights.set", gang: "rear", on: lights?.rear.value !== true })}
        />
        <InlineError message={front.error ?? rear.error} />
      </div>

      <div className="flex flex-col gap-3">
        <DemoHeader title={`Live · microphone ${mic?.value ?? ""}`} gate={micLevel.gate} />
        <LevelSlider
          label="Lecturer microphone"
          value={mic?.value ?? null}
          pending={micLevel.pending}
          disabled={gateDisablesControl(micLevel.gate)}
          onPressLocked={micLevel.gate.reason === "locked" ? micLevel.unlock : undefined}
          onChange={(level, final) => micLevel.send({ kind: "audio.level", channel: "mic", level, final })}
        />
        <InlineError message={micLevel.error} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SensorTile
          label="Temperature"
          loading={temperature === undefined}
          value={temperature?.kind === "temperature" && temperature.value !== null ? formatCelsius(temperature.value) : null}
          caption="SNZB-02P"
        />
        <MetricTile
          label="Power"
          loading={projector === undefined}
          tone="accent"
          value={projector?.power.value ? formatWatts(projector.power.value.watts) : null}
        />
      </div>
    </Card>
  );
}
