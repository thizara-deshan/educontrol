import type { ReactNode } from "react";
import { LG_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/ui/sheet";

/**
 * Every S3 sheet (milestone note): from the bottom below `lg` (thumb reach), from the right at
 * `lg`. Scrolls inside itself; the shadcn close icon is off (<48px), each sheet has Cancel.
 */
export function SettingsSheet({ open, onOpenChange, title, description, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const wide = useMediaQuery(LG_QUERY);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        showCloseButton={false}
        aria-describedby={description === undefined ? undefined : "settings-sheet-description"}
        className={cn("gap-0 overflow-y-auto p-4 lg:p-6", wide ? "w-full sm:max-w-md" : "max-h-[90dvh] rounded-t-card")}
      >
        <SheetTitle className="text-title font-bold text-text-1">{title}</SheetTitle>
        {description !== undefined && (
          <SheetDescription id="settings-sheet-description" className="mt-1 text-caption text-text-2">
            {description}
          </SheetDescription>
        )}
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
