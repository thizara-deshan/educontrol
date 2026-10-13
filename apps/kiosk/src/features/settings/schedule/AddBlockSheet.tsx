import type { ClassBlockInput } from "@eduscope/contracts";
import { useState } from "react";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { DayPicker } from "./DayPicker";
import { EMPTY_BLOCK_FORM, validateBlock, type BlockForm } from "./schedule-form";

/** S3c "+ Add block": days, start, end. */
export function AddBlockSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<BlockForm>(EMPTY_BLOCK_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const writable = useWritable();
  const create = useServerMutation((api, input: ClassBlockInput) => api.schedule.createBlock(input), [queryKeys.schedule()]);
  const result = validateBlock(form);
  const errors = showErrors && !result.ok ? result.errors : {};
  const close = (): void => {
    onOpenChange(false);
    setForm(EMPTY_BLOCK_FORM);
    setShowErrors(false);
    create.reset();
  };
  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    create.mutate(result.value, { onSuccess: close });
  };
  return (
    <SettingsSheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Add class block" description="Control sessions end when a block ends.">
      <DayPicker value={form.days} onChange={(days) => setForm({ ...form, days })} error={errors.days ?? null} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Start" type="time" value={form.start} error={errors.start ?? null} onChange={(start) => setForm({ ...form, start })} />
        <TextField label="End" type="time" value={form.end} error={errors.end ?? null} onChange={(end) => setForm({ ...form, end })} />
      </div>
      <SheetActions onCancel={close} onSave={save} pending={create.isPending} disabled={!writable} error={create.isError ? "Couldn't save · try again" : null} />
    </SettingsSheet>
  );
}
