import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** H6a/H6b red line; the 6 s lifetime lives in the inline-error store. Renders nothing when null. */
export function InlineError({ message, className }: { message: string | null; className?: string }) {
  if (message === null) return null;
  return (
    <p role="alert" className={cn("flex items-center gap-2 text-caption text-danger", className)}>
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      {message}
    </p>
  );
}
