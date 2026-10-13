import type { TimedActionInput } from "@eduscope/contracts";
import { useState } from "react";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { DayPicker } from "./DayPicker";
import { ACTION_PRESETS, EMPTY_ACTION_FORM, validateAction, type ActionForm } from "./schedule-form";

/** S3c "+ Add action": what (preset), when, which days. New actions start enabled. */
export function AddActionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<ActionForm>(EMPTY_ACTION_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const writable = useWritable();
  const create = useServerMutation((api, input: TimedActionInput) => api.schedule.createAction(input), [queryKeys.schedule()]);
  const result = validateAction(form);
  const errors = showErrors && !result.ok ? result.errors : {};
  const close = (): void => {
    onOpenChange(false);
    setForm(EMPTY_ACTION_FORM);
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
    <SettingsSheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Add timed action" description="Runs by itself and shows as “· by schedule”.">
      <ChoiceGroup label="Action" columns={2} options={ACTION_PRESETS} value={form.preset} onChange={(preset) => setForm({ ...form, preset })} />
      <TextField label="Time" type="time" value={form.time} error={errors.time ?? null} onChange={(time) => setForm({ ...form, time })} />
      <DayPicker value={form.days} onChange={(days) => setForm({ ...form, days })} error={errors.days ?? null} />
      <SheetActions onCancel={close} onSave={save} pending={create.isPending} disabled={!writable} error={create.isError ? "Couldn't save · try again" : null} />
    </SettingsSheet>
  );
}
