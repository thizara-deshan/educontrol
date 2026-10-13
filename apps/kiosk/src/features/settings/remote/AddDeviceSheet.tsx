import type { IrDeviceCreate } from "@eduscope/contracts";
import { useState } from "react";
import { useNavigate } from "react-router";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { EMPTY_DEVICE_FORM, KIND_CHOICES, TRANSPORT_CHOICES, validateDeviceForm, type DeviceForm } from "./forms";

/** S3.E9 sheet: name, brand, transport (ZS06 / MCU), kind → Save; the new device opens. */
export function AddDeviceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<DeviceForm>(EMPTY_DEVICE_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const navigate = useNavigate();
  const writable = useWritable();
  const create = useServerMutation((api, input: IrDeviceCreate) => api.ir.createDevice(input), [queryKeys.irDevices(), queryKeys.devices()]);
  const result = validateDeviceForm(form);
  const errors = showErrors && !result.ok ? result.errors : {};

  const close = (): void => {
    onOpenChange(false);
    setForm(EMPTY_DEVICE_FORM);
    setShowErrors(false);
    create.reset();
  };
  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    create.mutate(result.value, {
      onSuccess: (device) => {
        close();
        void navigate(`/settings/remote/${encodeURIComponent(device.device_id)}`);
      },
    });
  };

  return (
    <SettingsSheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Add device">
      <TextField label="Name" value={form.name} error={errors.name ?? null} onChange={(name) => setForm({ ...form, name })} />
      <TextField label="Brand" value={form.brand} error={errors.brand ?? null} onChange={(brand) => setForm({ ...form, brand })} />
      <ChoiceGroup label="Transport" columns={2} options={TRANSPORT_CHOICES} value={form.transport} onChange={(transport) => setForm({ ...form, transport })} />
      <ChoiceGroup label="Kind" options={KIND_CHOICES} value={form.kind} onChange={(kind) => setForm({ ...form, kind })} />
      <SheetActions
        onCancel={close}
        onSave={save}
        pending={create.isPending}
        disabled={!writable}
        error={create.isError ? "Couldn't save · try again" : null}
      />
    </SettingsSheet>
  );
}
