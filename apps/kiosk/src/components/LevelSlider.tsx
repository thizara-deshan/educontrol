import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  clampLevel, createLevelThrottle, levelFromPointer, SETTLE_TIMEOUT_MS, SLIDER_IDLE,
  sliderDisplayLevel, sliderReducer,
} from "@/lib/level-slider";
import { cn } from "@/lib/utils";
import { DISABLED_CONTROL_CLASS, PENDING_CONTROL_CLASS } from "./state-styles";

export interface LevelSliderProps {
  /** Accessible name, e.g. "Lecturer microphone". */
  label: string;
  /** Server level 0–100; `null` = unknown (thumb hidden). */
  value: number | null;
  /** Throttled while dragging (`final:false`), once on release (`final:true`). */
  onChange: (level: number, final: boolean) => void;
  disabled?: boolean;
  pending?: boolean;
  /** H18: track dimmed; the thumb stays at the saved level. */
  muted?: boolean;
  className?: string;
}

/** SPEC §2.4 / §3.3: track 8px, thumb 30px visual inside a 48px hit area, full width. */
export function LevelSlider({ label, value, onChange, disabled = false, pending = false, muted = false, className }: LevelSliderProps) {
  const [state, dispatch] = useReducer(sliderReducer, SLIDER_IDLE);
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [throttle] = useState(() => createLevelThrottle((level, final) => onChangeRef.current(level, final)));

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => () => throttle.cancel(), [throttle]);
  // Server pushes: ignored while dragging, end the settle phase otherwise (reducer decides).
  useEffect(() => {
    dispatch({ type: "server", value });
  }, [value]);
  useEffect(() => {
    if (state.mode !== "settling") return;
    const id = window.setTimeout(() => dispatch({ type: "settle-timeout" }), SETTLE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [state]);

  const levelAt = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    return rect === undefined ? 0 : levelFromPointer(event.clientX, rect.left, rect.width);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const level = levelAt(event);
    dispatch({ type: "down", level });
    throttle.move(level);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (state.mode !== "dragging") return;
    const level = levelAt(event);
    dispatch({ type: "move", level });
    throttle.move(level);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (state.mode !== "dragging") return;
    const level = levelAt(event);
    dispatch({ type: "up", level, server: value });
    throttle.release(level);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled || value === null) return;
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    onChange(clampLevel(value + step), true);
  };

  const shown = sliderDisplayLevel(state, value);
  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown ?? undefined}
      aria-disabled={disabled}
      aria-busy={pending}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex h-12 w-full touch-none select-none items-center rounded-btn border-2 border-transparent px-4",
        pending && PENDING_CONTROL_CLASS,
        disabled && DISABLED_CONTROL_CLASS,
        className,
      )}
    >
      <div ref={trackRef} className={cn("relative h-2 w-full rounded-full bg-border", muted && "opacity-40")}>
        {shown !== null && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-7.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-knob shadow"
            style={{ left: `${shown}%` }}
          />
        )}
      </div>
    </div>
  );
}
