import type { IrCommandCreate, IrDevice, IrSetpoint } from "@eduscope/contracts";
import { useState } from "react";
import { CommandButton } from "@/components/CommandButton";
import { queryKeys } from "@/data/query-keys";
import { useServerMutation } from "@/data/settings/hooks";
import { ChoiceGroup } from "../shared/ChoiceGroup";
import { SettingsSheet } from "../shared/SettingsSheet";
import { SheetActions } from "../shared/SheetActions";
import { TextField } from "../shared/TextField";
import { useWritable } from "../shared/use-writable";
import {
  AC_FAN_CHOICES, AC_MODE_CHOICES, AC_TEMP_MAX, AC_TEMP_MIN, acCommandName, clampTemp, commandInput, DEFAULT_SETPOINT,
} from "./forms";

/** −  25°  + for the AC setpoint (same shape as S1's AC row, 48px keys). */
function TempStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption font-semibold text-text-2">Setpoint</span>
      <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
        <CommandButton label="−" disabled={value <= AC_TEMP_MIN} onPress={() => onChange(clampTemp(value - 1))} />
        <span className="text-center font-mono text-value font-semibold text-text-1" aria-live="polite">
          {value} °C
        </span>
        <CommandButton label="+" disabled={value >= AC_TEMP_MAX} onPress={() => onChange(clampTemp(value + 1))} />
      </div>
    </div>
  );
}

/**
 * S3.E16 sheet. AC: setpoint °C, mode, fan (the row is named "25°"); other devices: a name.
 * Save creates the row ("Not captured") and starts its capture (H21).
 */
export function AddCommandSheet({ device, open, onOpenChange }: { device: IrDevice; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [setpoint, setSetpoint] = useState<IrSetpoint>(DEFAULT_SETPOINT);
  const [showErrors, setShowErrors] = useState(false);
  const writable = useWritable();
  const create = useServerMutation(async (api, input: IrCommandCreate) => {
    const command = await api.ir.createCommand(device.device_id, input);
    await api.ir.learn(command.id).catch(() => undefined); // a refused capture leaves the row "Not captured" with Learn
    return command;
  }, [queryKeys.irDevices()]);
  const result = commandInput(device.kind, name, setpoint);
  const nameError = showErrors && !result.ok ? (result.errors.name ?? null) : null;
  const isAc = device.kind === "ac";

  const close = (): void => {
    onOpenChange(false);
    setName("");
    setSetpoint(DEFAULT_SETPOINT);
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
    <SettingsSheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={`Add a command · ${device.name}`}
      description={isAc ? `Saves as “${acCommandName(setpoint)}”, then listens for the remote.` : "Saves the command, then listens for the remote."}
    >
      {isAc ? (
        <>
          <TempStepper value={setpoint.temp_c} onChange={(temp_c) => setSetpoint({ ...setpoint, temp_c })} />
          <ChoiceGroup label="Mode" columns={3} options={AC_MODE_CHOICES} value={setpoint.mode} onChange={(mode) => setSetpoint({ ...setpoint, mode })} />
          <ChoiceGroup label="Fan" columns={4} options={AC_FAN_CHOICES} value={setpoint.fan} onChange={(fan) => setSetpoint({ ...setpoint, fan })} />
        </>
      ) : (
        <TextField label="Name" value={name} error={nameError} onChange={setName} />
      )}
      <SheetActions
        saveLabel="Save and learn"
        onCancel={close}
        onSave={save}
        pending={create.isPending}
        disabled={!writable}
        error={create.isError ? "Couldn't save · try again" : null}
      />
    </SettingsSheet>
  );
}
