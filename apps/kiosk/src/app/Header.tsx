import { Settings, Wifi, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { kioskEnv } from "@/data/env";
import { useRequireAccess, useRoomState } from "@/data/hooks";
import { HeaderLockButton } from "@/features/session/HeaderLockButton";
import { formatDate, formatTime } from "@/lib/format";
import { useServerNow } from "@/lib/server-time";
import { usePressed } from "@/lib/use-pressed";
import { Skeleton } from "@/ui/skeleton";
import { StatusIndicator } from "./StatusIndicator";

const HEADER_BUTTON_CLASS =
  "flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-btn border border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125 data-[pressed=true]:brightness-125 lg:px-4";

function HeaderLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const pressed = usePressed();
  return (
    <Link to={to} aria-label={label} {...pressed} className={HEADER_BUTTON_CLASS}>
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="hidden whitespace-nowrap lg:inline">{label}</span>
    </Link>
  );
}

/** S1.E7: technician → S3; otherwise S4 (technician PIN) first. Cancel stays where you are. */
function SettingsButton() {
  const pressed = usePressed();
  const { ensure } = useRequireAccess("technician");
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label="Settings"
      {...pressed}
      onClick={() => {
        void ensure().then((granted) => {
          if (granted) void navigate("/settings/remote");
        });
      }}
      className={HEADER_BUTTON_CLASS}
    >
      <Settings aria-hidden="true" className="size-5 shrink-0" />
      <span className="hidden whitespace-nowrap lg:inline">Settings</span>
    </button>
  );
}

/** S1.E1–E8. Phone (<600): one 56px row (SPEC §2.2). */
export function Header() {
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const now = useServerNow();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-header px-4 sm:h-16 lg:px-6">
      {/* Phone: two short lines so the row fits status, R-101, Devices, Settings and Lock (SPEC §2.2). */}
      <p className="flex min-w-0 flex-1 flex-col text-caption font-bold text-text-1 sm:block sm:truncate sm:text-wordmark">
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
        <span className="flex h-10 shrink-0 items-center whitespace-nowrap rounded-chip border border-border-strong bg-control px-2 font-mono text-card-title font-semibold text-text-1 sm:h-12 sm:px-3">
          {roomId}
        </span>
        <HeaderLink to="/devices" icon={Wifi} label="Devices" />
        <SettingsButton />
        <HeaderLockButton />
      </div>
    </header>
  );
}
