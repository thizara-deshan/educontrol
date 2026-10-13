import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { PinDots } from "@/components/PinDots";
import { PinPad } from "@/components/PinPad";
import { useApiClient } from "@/data/api-context";
import { cn } from "@/lib/utils";
import { SettingsSheet } from "../shared/SettingsSheet";
import { initialPinChange, pinChangeMessage, pinChangeReducer, pinChangeTitle, type PinLevel } from "./pin-change";

const SAVED: Record<PinLevel, string> = { room: "Room PIN changed", technician: "Technician PIN changed" };

/** S3d "Change": new PIN twice on the S4 keypad, then save. Mount with a `key` per opening. */
export function PinChangeSheet({ level, onClose }: { level: PinLevel; onClose: () => void }) {
  const [state, dispatch] = useReducer(pinChangeReducer, level, initialPinChange);
  const api = useApiClient();
  const { step, first } = state;

  useEffect(() => {
    if (step !== "saving") return;
    const save = level === "room" ? api.settings.setRoomPin(first) : api.settings.setTechnicianPin(first);
    save.then(
      () => {
        toast(SAVED[level]);
        onClose();
      },
      () => dispatch({ type: "failed" }),
    );
  }, [step, first, level, api, onClose]);

  const message = pinChangeMessage(state);
  return (
    <SettingsSheet open onOpenChange={(open) => (open ? undefined : onClose())} title={pinChangeTitle(level, state)}>
      <div className="flex flex-col items-center gap-4 pb-2">
        <PinDots length={state.length} filled={state.digits.length} error={step === "mismatch" || step === "error"} shakeKey={state.mismatches} />
        <p aria-live="polite" className={cn("min-h-4 text-caption", step === "saving" ? "text-text-2" : "text-danger")}>
          {message ?? ""}
        </p>
        <PinPad
          disabled={step === "saving"}
          onDigit={(digit) => dispatch({ type: "digit", digit })}
          onBackspace={() => dispatch({ type: "backspace" })}
          onCancel={onClose}
        />
      </div>
    </SettingsSheet>
  );
}
