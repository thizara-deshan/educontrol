import { useState } from "react";
import { Link } from "react-router";
import { STATUS_DOT_CLASS, type StatusLevel } from "@/components/state-styles";
import { useRoomState } from "@/data/hooks";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";

/**
 * S1.E4. ≥600: dot + text, a link to S2 (`[INFERRED]` on tap). <600: a 48×48 dot button that opens
 * a bottom sheet with the text (SPEC §2.2).
 */
export function StatusIndicator() {
  const status = useRoomState((state) => state.room.status);
  const [open, setOpen] = useState(false);
  const pressed = usePressed();
  const level: StatusLevel = status?.level ?? "connecting";
  const text = status?.text ?? "Connecting…";
  const dot = <span aria-hidden="true" className={cn("size-2.5 rounded-full", STATUS_DOT_CLASS[level])} />;

  return (
    <>
      <Link
        to="/devices"
        {...pressed}
        className="hidden min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-btn px-2 text-caption text-text-2 active:bg-control data-[pressed=true]:bg-control sm:flex"
      >
        {dot}
        {text}
      </Link>
      <button
        type="button"
        aria-label={`System status: ${text}`}
        onClick={() => setOpen(true)}
        className="flex size-12 shrink-0 items-center justify-center rounded-btn active:bg-control sm:hidden"
      >
        {dot}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-3 rounded-t-card p-4">
          <SheetTitle className="text-section font-bold uppercase text-text-2">System status</SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-card-title text-text-1">
            {dot}
            {text}
          </SheetDescription>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 rounded-btn border-2 border-border-strong bg-control text-button font-semibold text-text-1 active:brightness-125"
          >
            Close
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
