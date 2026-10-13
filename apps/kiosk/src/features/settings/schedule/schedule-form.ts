import { ClassBlockInput, TimedActionInput, type CommandBody, type Weekday } from "@eduscope/contracts";
import type { FormResult } from "../shared/form-result";
import { WEEKDAYS } from "./schedule.view";

// S3c "+ Add block" / "+ Add action" sheets: validation and the timed-action presets.

export interface BlockForm {
  days: Weekday[];
  start: string;
  end: string;
}
export const EMPTY_BLOCK_FORM: BlockForm = { days: [...WEEKDAYS], start: "08:00", end: "09:00" };

const FORMAT_MESSAGE = "Use HH:MM (24 h)";

/** S3c "+ Add block": at least one day, HH:MM times, end after start. */
export function validateBlock(form: BlockForm): FormResult<ClassBlockInput, "days" | "start" | "end"> {
  const parsed = ClassBlockInput.safeParse(form);
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<"days" | "start" | "end", string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "days") errors.days ??= "Pick at least one day";
    if (field === "start") errors.start ??= FORMAT_MESSAGE;
    if (field === "end") errors.end ??= issue.code === "custom" ? "End must be after start" : FORMAT_MESSAGE;
  }
  return { ok: false, errors };
}

export type PresetId = "all_off" | "lights_off" | "projector_off" | "ac_off";
const LIGHTS_OFF: CommandBody[] = [
  { kind: "lights.set", gang: "front", on: false },
  { kind: "lights.set", gang: "rear", on: false },
];
/** What a timed action can do in v1 `[INFERRED]` (SPEC S3c example: "All off"). */
export const ACTION_PRESETS: readonly { value: PresetId; label: string; steps: CommandBody[] }[] = [
  { value: "all_off", label: "All off", steps: [{ kind: "projector.power", on: false }, { kind: "ac.power", on: false }, ...LIGHTS_OFF] },
  { value: "lights_off", label: "Lights off", steps: LIGHTS_OFF },
  { value: "projector_off", label: "Projector off", steps: [{ kind: "projector.power", on: false }] },
  { value: "ac_off", label: "AC off", steps: [{ kind: "ac.power", on: false }] },
];

export interface ActionForm {
  preset: PresetId;
  time: string;
  days: Weekday[];
}
export const EMPTY_ACTION_FORM: ActionForm = { preset: "all_off", time: "18:00", days: [...WEEKDAYS] };

/** S3c "+ Add action": a preset at a time on some days, enabled. */
export function validateAction(form: ActionForm): FormResult<TimedActionInput, "days" | "time"> {
  const preset = ACTION_PRESETS.find((candidate) => candidate.value === form.preset) ?? ACTION_PRESETS[0];
  const parsed = TimedActionInput.safeParse({
    name: preset?.label ?? "", time: form.time, days: form.days, enabled: true, steps: preset?.steps ?? [],
  });
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<"days" | "time", string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "days") errors.days ??= "Pick at least one day";
    if (field === "time") errors.time ??= FORMAT_MESSAGE;
  }
  return { ok: false, errors };
}
