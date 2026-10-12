import { useEffect, useReducer } from "react";
import { PinDots } from "@/components/PinDots";
import { PinPad } from "@/components/PinPad";
import { pinRequests } from "@/data/access/pin-requests";
import type { RequiredAccess } from "@/data/access/decide-access";
import { kioskEnv } from "@/data/env";
import { useRoomState, useSession, useSessionActions } from "@/data/hooks";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { initialPinInput, pinInputReducer, pinMessage } from "./pin-input";

const TICK_MS = 250;
const TITLE: Record<RequiredAccess, string> = { control: "Enter room PIN", technician: "Technician PIN" };

function PinDialog({ id, level }: { id: number; level: RequiredAccess }) {
  const [state, dispatch] = useReducer(pinInputReducer, level === "control" ? 4 : 6, initialPinInput);
  const label = useSession()?.label;
  const { login } = useSessionActions();
  const roomId = useRoomState((room) => room.room.id) ?? kioskEnv.VITE_ROOM_ID;
  const { phase, digits } = state;

  // Auto-submit (S4.E4): the reducer moves to `submitting` when the last digit lands.
  useEffect(() => {
    if (phase !== "submitting") return;
    if (label === undefined) {
      dispatch({ type: "error" });
      return;
    }
    void login(level, digits, label).then((outcome) => {
      switch (outcome.kind) {
        case "ok":
          // Only close the request this dialog belongs to (Cancel may have opened another).
          if (pinRequests.current.get()?.id === id) pinRequests.finish(true);
          return;
        case "wrong":
          dispatch({ type: "wrong" });
          return;
        case "locked":
          dispatch({ type: "locked", retryAfterS: outcome.retryAfterS, now: Date.now() });
          return;
        case "error":
          dispatch({ type: "error" });
      }
    });
  }, [phase, digits, label, level, login, id]);

  // H17 countdown.
  useEffect(() => {
    if (phase !== "locked") return;
    const timer = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Laptop keyboards: digits, Backspace, Escape = Cancel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (/^\d$/.test(event.key)) dispatch({ type: "digit", digit: event.key });
      else if (event.key === "Backspace") dispatch({ type: "backspace" });
      else if (event.key === "Escape") pinRequests.finish(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const message = pinMessage(state);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-title"
      className="fixed inset-0 z-[100] flex flex-col bg-bg sm:items-center sm:justify-center sm:bg-bg/80"
    >
      <div className="flex flex-1 flex-col px-4 sm:flex-none sm:rounded-card sm:border sm:border-border-strong sm:bg-surface sm:px-8 sm:py-6">
        {/* Phone: the top half holds the title and dots; the keypad sits in the lower half (SPEC §2.2 S4). */}
        <div className="flex flex-1 flex-col items-center justify-end gap-4 pb-8 sm:flex-none sm:pb-6">
          <span className="flex h-10 items-center rounded-chip border border-border-strong bg-control px-3 font-mono text-card-title font-semibold text-text-1">
            {roomId}
          </span>
          <h2 id="pin-title" className="text-title font-bold text-text-1">
            {TITLE[level]}
          </h2>
          <PinDots length={state.length} filled={digits.length} error={phase === "wrong"} shakeKey={state.wrongCount} />
          <p aria-live="polite" className={cn("min-h-4 text-caption", phase === "locked" ? "text-warn" : "text-danger")}>
            {message ?? ""}
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-start pb-8 sm:flex-none sm:pb-0">
          <PinPad
            disabled={phase === "locked" || phase === "submitting"}
            onDigit={(digit) => dispatch({ type: "digit", digit })}
            onBackspace={() => dispatch({ type: "backspace" })}
            onCancel={() => pinRequests.finish(false)}
          />
        </div>
      </div>
    </div>
  );
}

/** S4 (overlay on the current screen), shown while a PIN request is open. */
export function PinOverlay() {
  const request = useStore(pinRequests.current, (current) => current);
  if (request === null) return null;
  return <PinDialog key={request.id} id={request.id} level={request.level} />;
}
