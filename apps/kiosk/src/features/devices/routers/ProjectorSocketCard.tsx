import { Card } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { GREYED_CLASS } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { cn } from "@/lib/utils";
import { GangTile } from "./GangTile";
import { RouterCardHeader } from "./RouterCardHeader";
import { routerHeaderView, socketMetricsView } from "./routers.view";

const DEVICE_ID = "projector_socket";
const METRIC_LABELS = ["Power", "Voltage", "Today", "Rating"] as const;

/** S2.E10–E13. Metrics: one row of four from 600px, 2×2 on the phone (SPEC §2.2). */
export function ProjectorSocketCard() {
  const now = useServerNow();
  const data = useRoomState((s) => ({
    device: s.devices.find((d) => d.id === DEVICE_ID),
    nodes: s.zigbee.nodes,
    mains: s.display.projector.mains,
    power: s.display.projector.power,
    serverTime: s.server_time,
  }));
  const device = data?.device;
  const at = data === undefined ? null : (now ?? new Date(data.serverTime));
  const header =
    data === undefined || device === undefined || at === null
      ? null
      : routerHeaderView(device, data.nodes.find((n) => n.friendly_name === device.hw_ref), at);
  const metrics = data === undefined || at === null ? null : socketMetricsView(data.power, at);
  const offline = header !== null && !header.online;

  return (
    <Card variant={offline ? "danger" : "solid"} className="flex flex-col gap-3">
      <RouterCardHeader view={header} />
      <GangTile label="Mains to projector" state={data?.mains} greyed={offline} />
      <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", offline && GREYED_CLASS)}>
        {metrics === null
          ? METRIC_LABELS.map((label) => <MetricTile key={label} label={label} value={null} loading />)
          : metrics.map((m) => <MetricTile key={m.label} label={m.label} value={m.value} tone={m.tone} staleAgo={m.staleAgo} />)}
      </div>
      <p className="text-caption text-text-2">
        The power reading is what turns the projector from a guess into a fact. Above about 50 W it is running; below 5 W
        it is in standby.
      </p>
    </Card>
  );
}
