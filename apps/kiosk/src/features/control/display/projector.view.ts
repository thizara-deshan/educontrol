import type { Interlock, RoomState } from "@eduscope/contracts";
import type { ActiveVariant, StateTone, ValueTone } from "@/components/state-styles";
import { formatWatts } from "@/lib/format";

// S1.E13–E15: projector state line, wattage and Power on/off (R1, R2, H7b, H14, H15, H25).

export interface ProjectorInput {
  projector: RoomState["display"]["projector"];
  interlock: Interlock;
  /** `online.value` of the S60 power meter device (`projector_socket`). */
  meterOnline: boolean | null | undefined;
  /** `online.value` of the IR blaster device (`ir_blaster`). */
  blasterOnline: boolean | null | undefined;
}

export interface ProjectorView {
  tone: StateTone;
  stateLine: string;
  watts: string;
  wattsTone: ValueTone;
  powerOnActive: ActiveVariant | null;
  powerOffActive: ActiveVariant | null;
  /** S1.E14 `[INFERRED]`: Power on is disabled while the interlock holds (lamp cooling). */
  powerOnBlocked: boolean;
  /** H15 line, or null. */
  holdLine: string | null;
  /** H25 line, or null. */
  blasterLine: string | null;
}

const IR_LABEL = { power_on: "Power on", power_off: "Power off" } as const;

interface Base {
  tone: StateTone;
  stateLine: string;
  wattsTone: ValueTone;
  on: boolean | null;
}

function base(projector: ProjectorInput["projector"]): Base {
  const { value, confidence } = projector.state;
  const how = confidence === "confirmed" ? "confirmed by draw" : "assumed";
  const tone = (confirmed: StateTone): StateTone => (confidence === "confirmed" ? confirmed : "assumed");
  switch (value) {
    case "running":
      return { tone: tone("confirmed"), stateLine: `On · ${how}`, wattsTone: "accent", on: true };
    case "standby":
      return { tone: tone("off"), stateLine: `Standby · ${how}`, wattsTone: "muted", on: false };
    case "warming_up":
      return { tone: "warning", stateLine: "Warming up", wattsTone: "warn", on: true };
    case "cooling_down":
      return { tone: "warning", stateLine: "Cooling down", wattsTone: "warn", on: false };
    case "unknown":
    case null:
      return { tone: "unknown", stateLine: "Unknown", wattsTone: "faint", on: null };
  }
}

export function projectorView({ projector, interlock, meterOnline, blasterOnline }: ProjectorInput): ProjectorView {
  const holding = interlock.status === "holding";
  const common = {
    powerOnBlocked: holding,
    holdLine: holding ? "Mains held on until projector cools" : null,
    blasterLine: blasterOnline === false ? "IR blaster offline" : null,
  };
  if (meterOnline === false) {
    return {
      ...common, tone: "unknown", stateLine: "Power meter offline · state unknown", watts: formatWatts(null),
      wattsTone: "faint", powerOnActive: null, powerOffActive: null,
    };
  }
  const b = base(projector);
  const { last_ir: lastIr, phase } = projector.feedback;
  let { tone, stateLine } = b;
  if (lastIr !== null && phase === "waiting_for_draw") stateLine = `${IR_LABEL[lastIr]} sent · waiting for draw`;
  if (lastIr !== null && phase === "no_change") {
    stateLine = `${IR_LABEL[lastIr]} sent · no change in draw`;
    tone = "warning";
  }
  return {
    ...common, tone, stateLine,
    watts: formatWatts(projector.power.value?.watts ?? null),
    wattsTone: projector.power.value === null ? "faint" : b.wattsTone,
    powerOnActive: b.on === true ? "confirmed" : null,
    powerOffActive: b.on === false ? "neutral" : null,
  };
}
