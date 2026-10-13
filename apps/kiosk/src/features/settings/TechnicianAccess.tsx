import { toast } from "sonner";
import { LockButton } from "@/components/LockButton";
import { LOCK_FAILED_MESSAGE } from "@/data/access/session-actions";
import { useLock } from "@/data/hooks";

/** S3.E3 "Technician access" with Lock beside it (every client, kiosk included), in the S3 header. */
export function TechnicianAccess() {
  const lock = useLock();
  return (
    <div className="flex items-center justify-end gap-1 sm:gap-3">
      {/* Phone: two short lines ("Technician / access") so the 390px header row fits. */}
      <span className="w-16 text-caption leading-tight text-text-2 sm:w-auto">Technician access</span>
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
