import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/Card";
import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { SectionLabel } from "@/components/SectionLabel";
import { useApiClient } from "@/data/api-context";
import { useRoomState } from "@/data/hooks";
import { useServerNow } from "@/lib/server-time";
import { useWritable } from "../shared/use-writable";
import { permitJoinView } from "./devices.view";

/** S3d "Permit joining": opens the mesh for 4 min; the label counts down from the pushed `mesh.joining`. */
export function PermitJoinCard() {
  const joining = useRoomState((state) => state.zigbee.mesh.joining);
  const coordinatorOnline = useRoomState((state) => state.zigbee.coordinator.status === "online") ?? false;
  const now = useServerNow();
  const writable = useWritable();
  const api = useApiClient();
  // No query to refetch: the open window arrives in the next pushed `state` (zigbee.mesh.joining).
  const permit = useMutation({ mutationFn: () => api.devices.permitJoin() });
  const view = joining === undefined || now === null ? null : permitJoinView(joining, now);
  return (
    <Card className="flex flex-col gap-3">
      <SectionLabel>Zigbee</SectionLabel>
      <p className="text-caption text-text-2">Open the mesh for 4 minutes so a new device can pair.</p>
      <CommandButton
        label={view?.label ?? "Permit joining"}
        size="primary"
        active={view?.open === true ? "assumed" : null}
        pending={permit.isPending}
        disabled={!writable || view === null || view.open || !coordinatorOnline}
        onPress={() => permit.mutate()}
      />
      <InlineError message={permit.isError ? "Couldn't open joining · try again" : null} />
    </Card>
  );
}
