import { InlineError } from "@/components/InlineError";
import { ObservedLine } from "@/components/ObservedLine";
import { gateDisablesControl } from "@/data/gate";
import { useCommand, useRoomState, useViewOnly } from "@/data/hooks";
import { SourceTile } from "./SourceTile";
import { SOURCE_TILES, sourceTileView } from "./source-tiles.view";

const DEVICE_ID = "hdmi_switch";

/** S1.E11 + S1.E12 side by side at every width (SPEC §2.2). */
export function SourceTiles() {
  const source = useRoomState((state) => state.display.source);
  const device = useRoomState((state) => state.devices.find((d) => d.id === DEVICE_ID));
  const locked = useViewOnly();
  const podium = useCommand("display.source:podium_pc", DEVICE_ID);
  const board = useCommand("display.source:smart_board", DEVICE_ID);
  const commands = { podium_pc: podium, smart_board: board };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        {SOURCE_TILES.map(({ input, label }) => {
          const command = commands[input];
          const view = source === undefined ? null : sourceTileView(source, input, command.pending);
          return (
            <SourceTile
              key={input}
              label={label}
              view={view}
              pending={command.pending}
              disabled={gateDisablesControl(command.gate)}
              locked={locked}
              onPress={() => {
                if (view?.selected === true) return; // S1.E11: tapping the selected tile does nothing
                command.send({ kind: "source.select", input });
              }}
            />
          );
        })}
      </div>
      {device?.online.value === false && <ObservedLine tone="offline" text={`${device.name} offline · last known state`} />}
      <InlineError message={podium.error ?? board.error} />
    </div>
  );
}
