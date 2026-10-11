import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import {
  ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS, PENDING_CONTROL_CLASS,
  type ActiveVariant,
} from "./state-styles";

export interface CommandButtonProps {
  label: string;
  onPress: () => void;
  /** Which SPEC §3.4 fill shows the current server state; `null` = not the current state. */
  active?: ActiveVariant | null;
  /** H5: border pulses, label unchanged, taps ignored. */
  pending?: boolean;
  disabled?: boolean;
  /** `primary` = 56px (Power on/off, Raise); `default` = 48px. */
  size?: "primary" | "default";
  className?: string;
}

export function CommandButton({
  label, onPress, active = null, pending = false, disabled = false, size = "default", className,
}: CommandButtonProps) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      {...pressed}
      disabled={disabled}
      aria-busy={pending}
      aria-pressed={active !== null}
      onClick={() => {
        if (!pending) onPress();
      }}
      className={cn(
        "flex min-w-12 items-center justify-center rounded-btn border-2 px-4 text-button font-semibold",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        size === "primary" ? "h-14" : "h-12",
        active === null ? INACTIVE_CONTROL_CLASS : ACTIVE_CONTROL_CLASS[active],
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      {label}
    </button>
  );
}
