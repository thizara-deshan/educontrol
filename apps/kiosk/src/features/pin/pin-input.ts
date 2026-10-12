import { formatCountdown } from "@/lib/format";

// S4 PIN entry as a pure reducer (S4.E3/E4, H17). The overlay dispatches key presses and server
// answers; `submitting` tells it to call login with `digits`.

export type PinLength = 4 | 6;
export type PinPhase = "entering" | "submitting" | "wrong" | "error" | "locked";

export interface PinInputState {
  length: PinLength;
  digits: string;
  phase: PinPhase;
  /** Epoch ms when the lockout ends (phase `locked`). */
  lockedUntil: number | null;
  /** Whole seconds left in the lockout, for the countdown. */
  remainingS: number;
  /** Bumped on every wrong answer, so the shake animation replays. */
  wrongCount: number;
}

export type PinInputAction =
  | { type: "digit"; digit: string }
  | { type: "backspace" }
  | { type: "wrong" }
  | { type: "error" }
  | { type: "locked"; retryAfterS: number; now: number }
  | { type: "tick"; now: number };

export function initialPinInput(length: PinLength): PinInputState {
  return { length, digits: "", phase: "entering", lockedUntil: null, remainingS: 0, wrongCount: 0 };
}

/** Keys work while entering, or right after a wrong/failed answer (which starts a new PIN). */
const acceptsKeys = (phase: PinPhase): boolean => phase === "entering" || phase === "wrong" || phase === "error";

export function pinInputReducer(state: PinInputState, action: PinInputAction): PinInputState {
  switch (action.type) {
    case "digit": {
      if (!acceptsKeys(state.phase) || !/^\d$/.test(action.digit)) return state;
      const digits = (state.phase === "entering" ? state.digits : "") + action.digit;
      // Auto-submit when the last digit lands (S4.E4).
      return { ...state, digits, phase: digits.length === state.length ? "submitting" : "entering" };
    }
    case "backspace":
      if (!acceptsKeys(state.phase)) return state;
      return { ...state, digits: state.phase === "entering" ? state.digits.slice(0, -1) : "", phase: "entering" };
    case "wrong":
      if (state.phase !== "submitting") return state;
      return { ...state, digits: "", phase: "wrong", wrongCount: state.wrongCount + 1 };
    case "error":
      if (state.phase !== "submitting") return state;
      return { ...state, digits: "", phase: "error" };
    case "locked":
      return {
        ...state,
        digits: "",
        phase: "locked",
        lockedUntil: action.now + action.retryAfterS * 1000,
        remainingS: Math.max(0, Math.ceil(action.retryAfterS)),
      };
    case "tick": {
      if (state.phase !== "locked" || state.lockedUntil === null) return state;
      const remainingS = Math.max(0, Math.ceil((state.lockedUntil - action.now) / 1000));
      if (remainingS === 0) return { ...state, phase: "entering", lockedUntil: null, remainingS: 0 };
      return remainingS === state.remainingS ? state : { ...state, remainingS };
    }
  }
}

/** The line under the dots (S4.E3, H17); `null` = nothing to say. */
export function pinMessage(state: PinInputState): string | null {
  switch (state.phase) {
    case "wrong":
      return "Wrong PIN";
    case "error":
      return "Couldn't check the PIN · try again";
    case "locked":
      return `Too many tries · wait ${formatCountdown(state.remainingS)}`;
    case "entering":
    case "submitting":
      return null;
  }
}
