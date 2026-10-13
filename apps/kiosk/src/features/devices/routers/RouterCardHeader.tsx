import { StateDot } from "@/components/StateDot";
import { TEXT_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/skeleton";
import type { RouterHeaderView } from "./routers.view";

/**
 * S2.E6/E10: dot · title over `model · friendly name` (mono) · "Router" badge · `LQI 214`.
 * Offline: red dot and "Offline · last seen 5 min ago" in place of the LQI. Phone: badge + LQI wrap
 * below the title, indented to the title (dot 10 + gap 12 = 22px = `pl-5.5`).
 */
export function RouterCardHeader({ view }: { view: RouterHeaderView | null }) {
  if (view === null) {
    return (
      <div className="flex items-start gap-3">
        <Skeleton className="mt-1.5 size-2.5 rounded-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-start gap-3">
        <StateDot tone={view.tone} className="mt-1.5" />
        <div className="flex min-w-0 flex-col">
          <h3 className="text-card-title font-semibold text-text-1">{view.title}</h3>
          <p className="break-all font-mono text-caption text-text-3">{view.ids}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 pl-5.5 sm:pl-0">
        <span className="rounded-chip bg-badge-router-fill px-2 py-1 text-caption font-semibold text-badge-router-text">Router</span>
        <span className={cn("font-mono text-caption", view.online ? "text-text-2" : TEXT_CLASS.offline)}>{view.link}</span>
      </div>
    </div>
  );
}
