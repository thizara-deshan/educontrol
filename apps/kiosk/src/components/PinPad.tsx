import { Delete } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePressed } from "@/lib/use-pressed";
import { DISABLED_CONTROL_CLASS } from "./state-styles";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function Key({ label, onPress, disabled = false, variant = "key", children }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "key" | "text";
  children: ReactNode;
}) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      {...pressed}
      onClick={onPress}
      className={cn(
        "flex size-16 items-center justify-center rounded-btn transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        variant === "key"
          ? "border border-border-strong bg-control font-mono text-value font-semibold text-text-1"
          : "text-button font-semibold text-text-2",
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      {children}
    </button>
  );
}

export interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** S4.E5; omitted → the bottom-left cell stays empty. Never disabled. */
  onCancel?: () => void;
  /** H17 lockout / while checking: digits and ⌫ are disabled. */
  disabled?: boolean;
}

/** S4.E4 keypad: 1–9, then Cancel · 0 · ⌫. 64×64 keys (SPEC §3.3), 16px gaps. */
export function PinPad({ onDigit, onBackspace, onCancel, disabled = false }: PinPadProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {DIGITS.map((digit) => (
        <Key key={digit} label={digit} disabled={disabled} onPress={() => onDigit(digit)}>
          {digit}
        </Key>
      ))}
      {onCancel === undefined ? (
        <span aria-hidden="true" />
      ) : (
        <Key label="Cancel" variant="text" onPress={onCancel}>
          Cancel
        </Key>
      )}
      <Key label="0" disabled={disabled} onPress={() => onDigit("0")}>
        0
      </Key>
      <Key label="Delete digit" variant="text" disabled={disabled} onPress={onBackspace}>
        <Delete aria-hidden="true" className="size-6" />
      </Key>
    </div>
  );
}
