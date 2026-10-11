import { Settings, Wifi, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { kioskEnv } from "@/data/env";
import { useRoomState } from "@/data/hooks";
import { formatDate, formatTime } from "@/lib/format";
import { useServerNow } from "@/lib/server-time";
import { usePressed } from "@/lib/use-pressed";
import { Skeleton } from "@/ui/skeleton";
import { StatusIndicator } from "./StatusIndicator";

function HeaderLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const pressed = usePressed();
  return (
    <Link
      to={to}
      aria-label={label}
      {...pressed}
      className="flex h-12 min-w-12 items-center justify-center gap-2 rounded-btn border border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 sm:px-4"
    >
      <Icon aria-hidden="true" className="size-5" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/** S1.E1–E7 (Lock S1.E8 arrives in M03). Phone (<600): one 56px row (SPEC §2.2). */
export function Header() {
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const now = useServerNow();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
      <p className="min-w-0 flex-1 truncate text-caption font-bold text-text-1 sm:text-wordmark">
        eduscope <span className="tracking-wordmark text-brand">CENTRAL</span>
      </p>

      <div className="hidden items-baseline gap-3 lg:flex" aria-label="Controller time">
        {now === null ? (
          <Skeleton className="h-8 w-36" />
        ) : (
          <>
            <time className="font-mono text-clock font-semibold text-text-1">{formatTime(now)}</time>
            <span className="font-mono text-date text-text-2">{formatDate(now)}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-3 lg:flex-1">
        <StatusIndicator />
        <span className="flex h-10 items-center rounded-chip border border-border-strong bg-control px-2 font-mono text-card-title font-semibold text-text-1 sm:h-12 sm:px-3">
          {roomId}
        </span>
        <HeaderLink to="/devices" icon={Wifi} label="Devices" />
        <HeaderLink to="/settings" icon={Settings} label="Settings" />
      </div>
    </header>
  );
}
