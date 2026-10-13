import type { AcState } from "@eduscope/contracts";
import type { ActiveVariant, StateTone } from "@/components/state-styles";
import { formatCelsius } from "@/lib/format";

// S1.E34–E40: AC is never confirmed (R3); −/+ step through captured setpoints (R4, H19, Q5).

export interface AcView {
  tone: StateTone;
  stateLine: "On · assumed" | "Off · assumed" | "Unknown";
  powerOnActive: ActiveVariant | null;
  powerOffActive: ActiveVariant | null;
  /** `24°` or `—`. */
  setpoint: string;
  /** S1.E39: dimmed unless the AC is assumed On. */
  setpointDimmed: boolean;
  canStepDown: boolean;
  canStepUp: boolean;
  /** H25 line, or null. */
  blasterLine: string | null;
}

export function acView(ac: AcState, blasterOnline: boolean | null | undefined): AcView {
  const unknown = ac.power.value === null || ac.power.confidence === "unknown";
  const on = !unknown && ac.power.value === "on";
  const current = ac.setpoint_c.value;
  const canStep = (direction: "down" | "up"): boolean =>
    on && current !== null && ac.available_setpoints.some((t) => (direction === "down" ? t < current : t > current));
  return {
    tone: unknown ? "unknown" : "assumed",
    stateLine: unknown ? "Unknown" : on ? "On · assumed" : "Off · assumed",
    powerOnActive: on ? "assumed" : null,
    powerOffActive: !unknown && !on ? "neutral" : null,
    setpoint: formatCelsius(current, 0),
    setpointDimmed: !on,
    canStepDown: canStep("down"),
    canStepUp: canStep("up"),
    blasterLine: blasterOnline === false ? "IR blaster offline" : null,
  };
}
