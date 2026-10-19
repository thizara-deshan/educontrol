import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CommandButton } from "@/components/CommandButton";
import { useApiClient } from "@/data/api-context";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useWritable } from "../shared/use-writable";

/** S3e "Restart controller" → confirm → the connection banner shows Reconnecting…, then Back online (H3/H4). */
export function RestartButton() {
  const [confirming, setConfirming] = useState(false);
  const api = useApiClient();
  const writable = useWritable();
  const restart = useMutation({ mutationFn: () => api.system.restart() });
  return (
    <>
      <CommandButton label="Restart controller" disabled={!writable} onPress={() => setConfirming(true)} className="border-danger text-danger" />
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) restart.reset();
        }}
        title="Restart the controller?"
        description="Every screen in the room disconnects for about half a minute, then reconnects by itself."
        confirmLabel="Restart"
        pending={restart.isPending}
        error={restart.isError ? "Couldn't restart · try again" : null}
        onConfirm={() => restart.mutate(undefined, { onSuccess: () => setConfirming(false) })}
      />
    </>
  );
}
