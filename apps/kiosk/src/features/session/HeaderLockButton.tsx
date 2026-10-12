import { toast } from "sonner";
import { LockButton } from "@/components/LockButton";
import { LOCK_FAILED_MESSAGE } from "@/data/access/session-actions";
import { useLock, useSession } from "@/data/hooks";

/** S1.E8: only for remote `control`/`technician` sessions. Drops to `view` in place. */
export function HeaderLockButton() {
  const session = useSession();
  const lock = useLock();
  if (session === undefined || session.client_type !== "remote" || session.access === "view") return null;
  return (
    <LockButton
      pending={lock.pending}
      onPress={() => {
        void lock.run().then((ok) => {
          if (!ok) toast(LOCK_FAILED_MESSAGE);
        });
      }}
    />
  );
}
