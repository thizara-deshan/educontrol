import { Card } from "@/components/Card";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { GangTile } from "./GangTile";
import { RouterCardHeader } from "./RouterCardHeader";
import { routerHeaderView } from "./routers.view";

const DEVICE_ID = "lights";

/** S2.E6–E9. Gang tiles side by side from 600px, stacked on the phone. Offline → danger border (SPEC §3.4). */
export function LightingSwitchCard() {
  const now = useServerNow();
  const data = useRoomState((s) => ({
    device: s.devices.find((d) => d.id === DEVICE_ID),
    nodes: s.zigbee.nodes,
    lights: s.environment.lights,
    serverTime: s.server_time,
  }));
  const device = data?.device;
  const header =
    data === undefined || device === undefined
      ? null
      : routerHeaderView(device, data.nodes.find((n) => n.friendly_name === device.hw_ref), now ?? new Date(data.serverTime));
  const offline = header !== null && !header.online;

  return (
    <Card variant={offline ? "danger" : "solid"} className="flex flex-col gap-3">
      <RouterCardHeader view={header} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GangTile label="Front of room" state={data?.lights.front} greyed={offline} />
        <GangTile label="Rear of room" state={data?.lights.rear} greyed={offline} />
      </div>
      <p className="text-caption text-text-2">
        Wired with neutral, so it carries the mesh for every battery sensor in the room. The wall plate still works by
        hand if the network stops.
      </p>
    </Card>
  );
}
