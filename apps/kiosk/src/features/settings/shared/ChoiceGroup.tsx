import { ACTIVE_CONTROL_CLASS, DISABLED_CONTROL_CLASS, INACTIVE_CONTROL_CLASS } from "@/components/state-styles";
import { usePressed } from "@/lib/use-pressed";
import { cn } from "@/lib/utils";

export interface Choice<T extends string> {
  value: T;
  label: string;
}

function ChoiceButton({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  const pressed = usePressed();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      {...pressed}
      onClick={onPress}
      className={cn(
        "flex h-12 min-w-12 items-center justify-center rounded-btn border-2 px-3 text-button font-semibold",
        "transition-[filter] active:brightness-125 data-[pressed=true]:brightness-125",
        selected ? ACTIVE_CONTROL_CLASS.selected : INACTIVE_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
      )}
    >
      {label}
    </button>
  );
}

/** One-of choice in a sheet (transport, kind, AC mode/fan, preset). Selected = SPEC §3.4 "Selected". */
export function ChoiceGroup<T extends string>({ label, options, value, onChange, disabled = false, columns = 3 }: {
  label: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Grid columns at every width (labels are short). */
  columns?: 2 | 3 | 4;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-text-2">{label}</span>
      <div className={cn("grid gap-2", { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns])}>
        {options.map((option) => (
          <ChoiceButton
            key={option.value}
            label={option.label}
            selected={option.value === value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
