import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { DISABLED_CONTROL_CLASS } from "./state-styles";

/** "+ Add device" / "+ Add a command" placeholder (SPEC §3.1 border-dashed). */
export function DashedAddButton({ label, onPress, disabled = false, className }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      disabled={disabled}
      onClick={onPress}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-2 rounded-btn border border-dashed border-border-dashed text-button font-semibold text-text-2",
        "active:bg-surface-2 data-[pressed=true]:bg-surface-2",
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      <Plus aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
