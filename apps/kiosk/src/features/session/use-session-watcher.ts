import type { AccessLevel } from "@eduscope/contracts";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { consumeLocalLock } from "@/data/access/session-actions";
import { useSession } from "@/data/hooks";
import { SESSION_EXPIRED_TOAST, sessionChangeEffects } from "./session-change";

/**
 * Reacts to `session.access` changes from any source (login, Lock, a pushed `session` event):
 * H24 toast on expiry, and `/settings/*` → `/` when technician is lost. Mount once (AppShell).
 */
export function useSessionWatcher(): void {
  const session = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prev = useRef<AccessLevel | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) return;
    const before = prev.current;
    prev.current = session.access;
    const changed = before !== undefined && before !== session.access;
    const effects = sessionChangeEffects({
      prev: before,
      next: session.access,
      clientType: session.client_type,
      ownLock: changed && consumeLocalLock(),
    });
    if (effects.toast) toast(SESSION_EXPIRED_TOAST);
    if (effects.leaveSettings && pathname.startsWith("/settings")) void navigate("/", { replace: true });
  }, [session, pathname, navigate]);
}
