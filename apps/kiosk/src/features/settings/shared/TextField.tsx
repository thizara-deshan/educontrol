import { useId } from "react";
import { cn } from "@/lib/utils";

/** Labelled 48px input with an inline validation line (S3 sheets). */
export function TextField({ label, value, onChange, error = null, type = "text", disabled = false, maxLength = 40 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  type?: "text" | "time";
  disabled?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-caption font-semibold text-text-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : `${id}-error`}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-12 w-full rounded-btn border-2 bg-control px-3 text-button text-text-1 outline-none focus:border-text-2",
          error === null ? "border-border-strong" : "border-danger",
          disabled && "opacity-40",
        )}
      />
      {error !== null && (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
