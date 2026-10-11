import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { DISABLED_CONTROL_CLASS, PENDING_CONTROL_CLASS } from "./state-styles";

export interface ToggleRowProps {
  label: string;
  /** Server value; `null` = never reported. */
  on: boolean | null;
  onToggle: () => void;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
}

/** S1.E32/E33: the whole ≥56px row is the target (SPEC §3.3); the switch is decorative. */
export function ToggleRow({ label, on, onToggle, pending = false, disabled = false, className }: ToggleRowProps) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on === true}
      aria-busy={pending}
      disabled={disabled}
      {...pressed}
      onClick={() => {
        if (!pending) onToggle();
      }}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-btn border-2 border-transparent bg-surface-2 px-4 text-left",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      <span className="flex-1 text-card-title font-semibold text-text-1">{label}</span>
      <span className={cn("text-caption", on === true ? "text-accent" : "text-text-3")}>
        {on === null ? "—" : on ? "On" : "Off"}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors",
          on === true ? "justify-end bg-toggle-on" : "justify-start bg-toggle-off",
        )}
      >
        <span className="size-6 rounded-full bg-knob" />
      </span>
    </button>
  );
}
