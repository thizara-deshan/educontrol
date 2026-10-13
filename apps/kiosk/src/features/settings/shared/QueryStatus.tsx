import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";
import { Skeleton } from "@/ui/skeleton";

/** Loading (H1-style skeleton rows) or failed ("Couldn't load …" + Retry) for a settings query. */
export function QueryStatus({ status, what, onRetry, rows = 3 }: {
  status: "pending" | "error";
  what: string;
  onRetry: () => void;
  rows?: number;
}) {
  if (status === "pending") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <InlineError message={`Couldn't load ${what}`} />
      <CommandButton label="Retry" onPress={onRetry} />
    </div>
  );
}
