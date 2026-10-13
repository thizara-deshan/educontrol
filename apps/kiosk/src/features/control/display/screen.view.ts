import type { Observed, ScreenPosition } from "@eduscope/contracts";
import type { StateTone } from "@/components/state-styles";

// S1.E17 / S1.E18: the button names the opposite action (Q2: two-state, no Stop).

export interface ScreenView {
  tone: StateTone;
  stateLine: string;
  action: { label: "Raise" | "Lower"; to: "raise" | "lower" };
  /** Disabled while the screen is moving (there is no Stop, Q2). */
  actionBlocked: boolean;
}

const RAISE = { label: "Raise", to: "raise" } as const;
const LOWER = { label: "Lower", to: "lower" } as const;

export function screenView(screen: Observed<ScreenPosition>, online: boolean | null | undefined, deviceName: string): ScreenView {
  const action = screen.value === "raised" || screen.value === "unknown" || screen.value === null ? LOWER : RAISE;
  if (online === false) {
    return { tone: "offline", stateLine: `${deviceName} offline · last known state`, action, actionBlocked: false };
  }
  const assumed = screen.confidence === "assumed";
  switch (screen.value) {
    case "lowered":
      return { tone: assumed ? "assumed" : "confirmed", stateLine: assumed ? "Lowered · assumed" : "Lowered", action, actionBlocked: false };
    case "raised":
      return { tone: assumed ? "assumed" : "off", stateLine: assumed ? "Raised · assumed" : "Raised", action, actionBlocked: false };
    case "moving":
      return { tone: "warning", stateLine: "Moving…", action, actionBlocked: true };
    case "unknown":
    case null:
      return { tone: "unknown", stateLine: "Unknown", action, actionBlocked: false };
  }
}
