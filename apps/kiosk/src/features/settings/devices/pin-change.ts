// S3d "Change" PIN sheet (SPEC §2.3): enter the new PIN, enter it again, save. Pure reducer.

export type PinLevel = "room" | "technician";
export type PinChangeStep = "new" | "confirm" | "saving" | "mismatch" | "error";

export interface PinChangeState {
  length: 4 | 6;
  step: PinChangeStep;
  /** The first entry, kept while confirming and saving. */
  first: string;
  digits: string;
  /** Bumped on every mismatch so the dots shake again. */
  mismatches: number;
}

export type PinChangeAction = { type: "digit"; digit: string } | { type: "backspace" } | { type: "failed" };

export const PIN_LENGTH: Record<PinLevel, 4 | 6> = { room: 4, technician: 6 };

export function initialPinChange(level: PinLevel): PinChangeState {
  return { length: PIN_LENGTH[level], step: "new", first: "", digits: "", mismatches: 0 };
}

export function pinChangeReducer(state: PinChangeState, action: PinChangeAction): PinChangeState {
  switch (action.type) {
    case "digit": {
      if (state.step === "saving" || !/^\d$/.test(action.digit)) return state;
      // After a mismatch or a failed save, the next digit starts a new PIN.
      const restart = state.step === "mismatch" || state.step === "error";
      const step = restart ? "new" : state.step;
      const digits = (restart ? "" : state.digits) + action.digit;
      if (digits.length < state.length) return { ...state, step, first: restart ? "" : state.first, digits };
      if (step === "new") return { ...state, step: "confirm", first: digits, digits: "" };
      return digits === state.first
        ? { ...state, step: "saving", digits }
        : { ...state, step: "mismatch", first: "", digits: "", mismatches: state.mismatches + 1 };
    }
    case "backspace":
      if (state.step === "saving") return state;
      if (state.step === "mismatch" || state.step === "error") return { ...state, step: "new", first: "", digits: "" };
      return { ...state, digits: state.digits.slice(0, -1) };
    case "failed":
      return state.step === "saving" ? { ...state, step: "error", first: "", digits: "" } : state;
  }
}

const NAME: Record<PinLevel, string> = { room: "room PIN", technician: "technician PIN" };

/** Sheet heading for the step. */
export function pinChangeTitle(level: PinLevel, state: PinChangeState): string {
  return state.step === "confirm" || state.step === "saving" ? `Enter the new ${NAME[level]} again` : `New ${NAME[level]}`;
}

/** The line under the dots; `null` = nothing to say. */
export function pinChangeMessage(state: PinChangeState): string | null {
  switch (state.step) {
    case "mismatch":
      return "The PINs don't match · start again";
    case "error":
      return "Couldn't save the PIN · try again";
    case "saving":
      return "Saving…";
    case "new":
    case "confirm":
      return null;
  }
}
