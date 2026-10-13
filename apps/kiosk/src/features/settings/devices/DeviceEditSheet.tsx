import type { Device, DevicePatch } from "@eduscope/contracts";
import { useState } from "react";
import { CommandButton } from "@/components/CommandButton";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { SettingsRow } from "../shared/SettingsRow";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import { devicePatch, TRANSPORT_NAME, transportChoices, type EditForm } from "./devices.view";

const KEYS = [queryKeys.devices(), queryKeys.irDevices()];

/** S3d row tap: rename, change transport (IR devices), remove (confirmed). Mount with `key={device.id}`. */
export function DeviceEditSheet({ device, onClose }: { device: Device; onClose: () => void }) {
  const [form, setForm] = useState<EditForm>({ name: device.name, transport: device.transport });
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const writable = useWritable();
  const update = useServerMutation((api, patch: DevicePatch) => api.devices.update(device.id, patch), KEYS);
  const remove = useServerMutation((api, id: string) => api.devices.remove(id), KEYS);
  const result = devicePatch(device, form);
  const choices = transportChoices(device.transport);

  const save = (): void => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    if (result.patch === null) {
      onClose();
      return;
    }
    update.mutate(result.patch, { onSuccess: onClose });
  };

  return (
    <SettingsSheet open onOpenChange={(open) => (open ? undefined : onClose())} title={`Edit ${device.name}`}>
      <TextField
        label="Name"
        value={form.name}
        error={showErrors && !result.ok ? result.error : null}
        onChange={(name) => setForm({ ...form, name })}
      />
      {choices === null ? (
        <SettingsRow label="Transport" value={TRANSPORT_NAME[device.transport]} />
      ) : (
        <ChoiceGroup label="Transport" columns={2} options={choices} value={form.transport} onChange={(transport) => setForm({ ...form, transport })} />
      )}
      <SheetActions onCancel={onClose} onSave={save} pending={update.isPending} disabled={!writable} error={update.isError ? "Couldn't save · try again" : null} />
      <CommandButton label="Remove device" disabled={!writable} onPress={() => setConfirming(true)} className="border-danger text-danger" />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Remove ${device.name}?`}
        description="It disappears from every screen in the room. Captured IR codes for it are deleted too."
        confirmLabel="Remove"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't remove · try again" : null}
        onConfirm={() => remove.mutate(device.id, { onSuccess: onClose })}
      />
    </SettingsSheet>
  );
}
