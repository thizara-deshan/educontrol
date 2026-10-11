import { kioskEnv } from "@/data/env";
import { useRealtime } from "@/data/api-context";
import { useConnectionStatus, useRoomState } from "@/data/hooks";
import { cn } from "@/lib/utils";

/** S1.E9 / S5 / H2–H4. Hidden while connecting or live. */
export function ConnectionBanner() {
  const status = useConnectionStatus();
  const { connection } = useRealtime();
  const roomId = useRoomState((state) => state.room.id) ?? kioskEnv.VITE_ROOM_ID;
  if (status === "connecting" || status === "live") return null;

  const tone = {
    reconnecting: "border-warn/40 bg-warn-fill text-warn",
    unreachable: "border-danger/40 bg-danger-fill text-danger",
    back_online: "border-accent/40 bg-accent-fill text-accent",
  }[status];
  const text = {
    reconnecting: "Reconnecting…",
    unreachable: `Can't reach ${roomId} controller`,
    back_online: "Back online",
  }[status];

  return (
    <div role="status" aria-live="polite" className={cn("flex min-h-12 items-center gap-3 border-b px-4 py-1 text-button font-semibold lg:px-6", tone)}>
      <span className="flex-1">{text}</span>
      {status === "unreachable" && (
        <button
          type="button"
          onClick={() => connection.retry()}
          className="h-12 min-w-24 rounded-btn border-2 border-danger bg-control px-4 text-button font-semibold text-text-1 active:brightness-125"
        >
          Retry
        </button>
      )}
    </div>
  );
}
