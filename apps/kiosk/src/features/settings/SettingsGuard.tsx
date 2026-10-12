import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router";
import { useRequireAccess, useSession } from "@/data/hooks";

/**
 * Technician gate on every `/settings/*` route (S1.E7, ARCHITECTURE §4.3), including a URL typed
 * by hand. Asks once per visit, as soon as the session is known; Cancel → `/`. Losing technician
 * later is handled by the session watcher (navigates to `/`), not here.
 */
export function SettingsGuard() {
  const access = useSession()?.access;
  const { ensure } = useRequireAccess("technician");
  const navigate = useNavigate();
  const decided = useRef(false);

  useEffect(() => {
    if (access === undefined || decided.current) return;
    decided.current = true;
    if (access === "technician") return;
    void ensure().then((granted) => {
      if (!granted) void navigate("/", { replace: true });
    });
  }, [access, ensure, navigate]);

  return access === "technician" ? <Outlet /> : null;
}
