import { toast } from "sonner";
import { LockButton } from "@/components/LockButton";
import { LOCK_FAILED_MESSAGE } from "@/data/access/session-actions";
import { useLock } from "@/data/hooks";

/** S3.E3 "Technician access" with Lock beside it (every client, kiosk included). */
export function TechnicianAccess() {
  const lock = useLock();
  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-caption text-text-2">Technician access</span>
      <LockButton
        pending={lock.pending}
        onPress={() => {
          void lock.run().then((ok) => {
            if (!ok) toast(LOCK_FAILED_MESSAGE);
          });
        }}
      />
    </div>
  );
}
