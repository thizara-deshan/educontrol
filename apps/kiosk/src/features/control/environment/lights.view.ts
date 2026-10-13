import type { StateTone } from "@/components/state-styles";

// S1.E31: the lights header line (R6: always confirmed by the switch; H8 when offline).

export interface LightsView {
  tone: StateTone;
  line: "Confirmed by the switch" | "Switch offline · last known state";
}

export function lightsView(online: boolean | null | undefined): LightsView {
  return online === false
    ? { tone: "offline", line: "Switch offline · last known state" }
    : { tone: "confirmed", line: "Confirmed by the switch" };
}

/** A row tap sends the opposite of the server value; unknown (null) turns it on. */
export function nextLightOn(value: boolean | null): boolean {
  return value !== true;
}
