import { cn } from "@/lib/utils";

export interface PinDotsProps {
  /** 4 (room PIN) or 6 (technician PIN). */
  length: number;
  /** Digits entered so far. */
  filled: number;
  /** Wrong PIN: red rings + one shake. */
  error?: boolean;
  /** Change it to replay the shake (e.g. the wrong-answer counter). */
  shakeKey?: number;
}

/** S4.E3 PIN dots: empty ring / filled / error. Digits are never shown. */
export function PinDots({ length, filled, error = false, shakeKey = 0 }: PinDotsProps) {
  return (
    <div
      key={shakeKey}
      role="img"
      aria-label={`${filled} of ${length} digits entered`}
      className={cn("flex h-6 items-center gap-4", error && "animate-shake")}
    >
      {Array.from({ length }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-4 rounded-full border-2",
            index < filled ? "border-text-1 bg-text-1" : error ? "border-danger" : "border-text-3",
          )}
        />
      ))}
    </div>
  );
}
