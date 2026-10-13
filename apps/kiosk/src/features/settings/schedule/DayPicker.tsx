import { Weekday } from "@eduscope/contracts";
import { ACTIVE_CONTROL_CLASS, INACTIVE_CONTROL_CLASS } from "@/components/state-styles";
import { cn } from "@/lib/utils";

const LETTER: Record<Weekday, string> = { mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S" };
const NAME: Record<Weekday, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

/** Seven 48px day toggles (multi-select), Monday first. */
export function DayPicker({ value, onChange, error }: { value: readonly Weekday[]; onChange: (days: Weekday[]) => void; error: string | null }) {
  const toggle = (day: Weekday): void =>
    onChange(Weekday.options.filter((candidate) => (candidate === day ? !value.includes(day) : value.includes(candidate))));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-text-2">Days</span>
      <div className="grid grid-cols-7 gap-1">
        {Weekday.options.map((day) => (
          <button
            key={day}
            type="button"
            aria-label={NAME[day]}
            aria-pressed={value.includes(day)}
            onClick={() => toggle(day)}
            className={cn(
              "flex h-12 min-w-0 items-center justify-center rounded-btn border-2 text-button font-semibold active:brightness-125",
              value.includes(day) ? ACTIVE_CONTROL_CLASS.selected : INACTIVE_CONTROL_CLASS,
            )}
          >
            {LETTER[day]}
          </button>
        ))}
      </div>
      {error !== null && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
