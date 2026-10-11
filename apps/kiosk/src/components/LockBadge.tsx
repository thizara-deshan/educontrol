import { Lock } from "lucide-react";

/** H12 padlock on card headers (view-only). Decorative size; the control itself is the target. */
export function LockBadge() {
  return <Lock role="img" aria-label="Locked" className="size-4 shrink-0 text-text-3" />;
}
