import { CommandButton } from "@/components/CommandButton";
import { InlineError } from "@/components/InlineError";

/** Cancel · Save row at the bottom of a sheet, with the save failure above it. */
export function SheetActions({ saveLabel = "Save", onCancel, onSave, pending, disabled = false, error = null }: {
  saveLabel?: string;
  onCancel: () => void;
  onSave: () => void;
  pending: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <InlineError message={error} />
      <div className="grid grid-cols-2 gap-3">
        <CommandButton label="Cancel" onPress={onCancel} />
        <CommandButton label={saveLabel} active="confirmed" pending={pending} disabled={disabled} onPress={onSave} />
      </div>
    </div>
  );
}
