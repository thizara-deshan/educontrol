import type { ReactNode } from "react";
import { VALUE_TONE_CLASS, type ValueTone } from "@/components/state-styles";
import { cn } from "@/lib/utils";

/** S3b/S3d/S3e label/value row: 56px, label text-2 left, value right (mono for ids), optional action. */
export function SettingsRow({ label, value, mono = false, tone = "default", children }: {
  label: string;
  value?: string | null;
  mono?: boolean;
  tone?: ValueTone;
  /** A trailing control ("Change"). */
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-t border-border py-2 first:border-t-0">
      <span className="text-button text-text-2">{label}</span>
      <span className="flex min-w-0 items-center gap-3">
        {value !== undefined && (
          <span className={cn("truncate text-right text-button", mono && "font-mono", value === null ? "text-text-3" : VALUE_TONE_CLASS[tone])}>
            {value ?? "—"}
          </span>
        )}
        {children}
      </span>
    </div>
  );
}
