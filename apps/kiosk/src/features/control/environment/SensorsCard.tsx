import { Link } from "react-router";
import { Card } from "@/components/Card";
import { SensorTile } from "@/components/SensorTile";
import { StateDot } from "@/components/StateDot";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { usePressed } from "@/lib/use-pressed";
import { Skeleton } from "@/ui/skeleton";
import { sensorsView } from "./sensors.view";

const TILE_KINDS = ["temperature", "humidity", "occupancy", "contact"] as const;

/** S1.E41–E45: header opens S2 (S1.E41); tiles 2×2 below `lg`, one row of four at `lg`. */
export function SensorsCard() {
  const now = useServerNow();
  const state = useRoomState((s) => ({ sensors: s.environment.sensors, devices: s.devices, serverTime: s.server_time }));
  const view = state === undefined ? null : sensorsView(state.sensors, state.devices, now ?? new Date(state.serverTime));
  const pressed = usePressed();

  return (
    <Card className="@container flex flex-col gap-2">
      <Link
        to="/devices"
        {...pressed}
        className="-mx-2 -mt-2 flex min-h-12 items-center justify-between gap-2 rounded-btn px-2 active:bg-surface-2 data-[pressed=true]:bg-surface-2"
      >
        <h3 className="text-section font-bold uppercase text-text-2">Room sensors</h3>
        {view === null ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <span className="flex items-center gap-2 text-caption text-text-2">
            <StateDot tone={view.reportingTone} />
            {view.reportingText}
          </span>
        )}
      </Link>
      <div className="grid grid-cols-2 gap-x-2 gap-y-4 @min-[22rem]:grid-cols-4">
        {view === null
          ? TILE_KINDS.map((kind) => <SensorTile key={kind} label={kind} value={null} caption="" loading />)
          : view.tiles.map((tile) => (
              <SensorTile
                key={tile.kind}
                label={tile.label}
                value={tile.value}
                caption={tile.caption}
                tone={tile.tone}
                numeric={tile.numeric}
                staleAgo={tile.suffix}
              />
            ))}
      </div>
    </Card>
  );
}
