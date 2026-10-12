import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { pinRequests } from "@/data/access/pin-requests";
import { useRoomState, useSession, useSessionActions } from "@/data/hooks";
import { useStore } from "@/lib/store";
import { createIdleTimer, KIOSK_IDLE_TIMINGS, scaleTimings } from "./idle-timer";
import { occupancyWakes, readIdleScale } from "./kiosk-params";
import { SleepOverlay } from "./SleepOverlay";
import { createWakeGuard, GUARDED_EVENTS } from "./wake-guard";

const IDLE_SCALE = readIdleScale(window.location.search, import.meta.env.DEV);
/** Elements marked with this (the dev mock panel) are invisible to the idle timer and wake guard. */
const WAKE_EXEMPT_SELECTOR = "[data-wake-exempt]";

const isExempt = (event: Event): boolean =>
  event.target instanceof Element && event.target.closest(WAKE_EXEMPT_SELECTOR) !== null;

/**
 * Kiosk-only behaviour (`session.client_type === "kiosk"`, ARCHITECTURE §4.7): idle timers,
 * wake-tap guard (R15), occupancy wake (H23), CSS guards (`html.kiosk`) and no context menu.
 */
export function KioskBehaviour() {
  const navigate = useNavigate();
  const access = useSession()?.access;
  const { lock } = useSessionActions();
  const occupancy = useRoomState((state) => {
    const reading = state.environment.sensors.occupancy;
    return reading.kind === "occupancy" ? reading.value : null;
  });

  // The timer outlives renders; its callback reads the latest values through this ref.
  const latest = useRef({ access, navigate, lock });
  useEffect(() => {
    latest.current = { access, navigate, lock };
  });

  const [timer] = useState(() =>
    createIdleTimer({
      timings: scaleTimings(KIOSK_IDLE_TIMINGS, IDLE_SCALE),
      // SPEC §2.3: after 2 min idle the kiosk returns to S1 and drops technician.
      onReturnHome: () => {
        const current = latest.current;
        pinRequests.finish(false);
        void current.navigate("/");
        if (current.access === "technician") void current.lock();
      },
    }),
  );
  const level = useStore(timer.level, (value) => value);

  useEffect(() => {
    const guard = createWakeGuard({ isAsleep: () => timer.level.get() !== "awake", wake: () => timer.activity() });
    const listeners = GUARDED_EVENTS.map((type) => {
      const listener = (event: Event): void => {
        if (isExempt(event)) return;
        if (guard.handle(type)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (type === "pointerdown") timer.activity();
      };
      return { type, listener };
    });
    const onKeyDown = (): void => timer.activity();
    const onContextMenu = (event: Event): void => event.preventDefault();

    for (const { type, listener } of listeners) window.addEventListener(type, listener, { capture: true });
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("contextmenu", onContextMenu, { capture: true });
    document.documentElement.classList.add("kiosk");
    timer.start();
    return () => {
      for (const { type, listener } of listeners) window.removeEventListener(type, listener, { capture: true });
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("contextmenu", onContextMenu, { capture: true });
      document.documentElement.classList.remove("kiosk");
      timer.stop();
    };
  }, [timer]);

  // H23: the transition to "detected" wakes the screen.
  const previousOccupancy = useRef(occupancy);
  useEffect(() => {
    if (occupancyWakes(previousOccupancy.current, occupancy)) timer.activity();
    previousOccupancy.current = occupancy;
  }, [occupancy, timer]);

  return <SleepOverlay level={level} />;
}
