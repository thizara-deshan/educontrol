import type { ServerEvent } from "@eduscope/contracts";
import type { RealtimeConnection, RealtimeHandlers } from "@/data/api-client";
import { createStore, type Store } from "@/lib/store";

// Connection state machine (ARCHITECTURE §4.5, SPEC §2.5, H1–H4).
//
//   connecting ─snapshot─▶ live ─close / 25 s silence─▶ reconnecting ─10 s─▶ unreachable
//        reconnecting|unreachable ─snapshot─▶ back_online ─2 s─▶ live
//   retry() / resume() (tab visible, `online`) reconnect immediately with a fresh backoff.

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "unreachable" | "back_online";

export const BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;
export const JITTER = 0.2;
export const UNREACHABLE_AFTER_MS = 10_000;
export const BACK_ONLINE_MS = 2_000;
export const DEAD_AFTER_MS = 25_000;
export const RESUME_STALE_MS = 15_000;

export interface ConnectionDeps {
  open(handlers: RealtimeHandlers): RealtimeConnection;
  onEvent(event: ServerEvent): void;
  store?: Store<ConnectionStatus>;
  now?: () => number;
  random?: () => number;
}

export interface ConnectionManager {
  status: Store<ConnectionStatus>;
  start(): void;
  stop(): void;
  /** Retry button (H2). */
  retry(): void;
  /** `visibilitychange` → visible or `online` (H4: never show pre-sleep values as current). */
  resume(): void;
}

/** Delay before reconnect attempt `attempt` (0-based): 0.5, 1, 2, 4, 8, 8… s ±20%. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 8000;
  return Math.round(base * (1 - JITTER + 2 * JITTER * random()));
}

export function createConnectionManager(deps: ConnectionDeps): ConnectionManager {
  const status = deps.store ?? createStore<ConnectionStatus>("connecting");
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;

  let socket: RealtimeConnection | null = null;
  let generation = 0;
  let attempt = 0;
  let lastFrameAt: number | null = null;
  let running = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let unreachableTimer: ReturnType<typeof setTimeout> | null = null;
  let backOnlineTimer: ReturnType<typeof setTimeout> | null = null;
  let deadTimer: ReturnType<typeof setTimeout> | null = null;

  const clear = (timer: ReturnType<typeof setTimeout> | null): null => {
    if (timer !== null) clearTimeout(timer);
    return null;
  };
  const clearAllTimers = (): void => {
    reconnectTimer = clear(reconnectTimer);
    unreachableTimer = clear(unreachableTimer);
    backOnlineTimer = clear(backOnlineTimer);
    deadTimer = clear(deadTimer);
  };

  const closeSocket = (): void => {
    generation += 1; // late callbacks from the old socket are ignored
    deadTimer = clear(deadTimer);
    const old = socket;
    socket = null;
    old?.close();
  };

  const armDeadTimer = (): void => {
    deadTimer = clear(deadTimer);
    deadTimer = setTimeout(() => dropped(), DEAD_AFTER_MS);
  };

  const onFrame = (event: ServerEvent): void => {
    lastFrameAt = now();
    armDeadTimer();
    deps.onEvent(event);
    if (event.type !== "snapshot") return;
    attempt = 0;
    reconnectTimer = clear(reconnectTimer);
    unreachableTimer = clear(unreachableTimer);
    const current = status.get();
    if (current === "reconnecting" || current === "unreachable") {
      status.set("back_online");
      backOnlineTimer = clear(backOnlineTimer);
      backOnlineTimer = setTimeout(() => {
        backOnlineTimer = null;
        if (status.get() === "back_online") status.set("live");
      }, BACK_ONLINE_MS);
    } else if (current === "connecting") {
      status.set("live");
    }
  };

  const openSocket = (): void => {
    closeSocket();
    const mine = generation;
    socket = deps.open({
      onOpen: () => {
        if (mine === generation) armDeadTimer();
      },
      onEvent: (event) => {
        if (mine === generation) onFrame(event);
      },
      onClose: () => {
        if (mine === generation) dropped();
      },
    });
  };

  const scheduleReconnect = (): void => {
    reconnectTimer = clear(reconnectTimer);
    const delay = backoffDelay(attempt, random);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (running) openSocket();
    }, delay);
  };

  const enterReconnecting = (): void => {
    backOnlineTimer = clear(backOnlineTimer);
    const current = status.get();
    if (current !== "reconnecting" && current !== "unreachable") {
      status.set("reconnecting");
      unreachableTimer = clear(unreachableTimer);
      unreachableTimer = setTimeout(() => {
        unreachableTimer = null;
        if (status.get() === "reconnecting") status.set("unreachable");
      }, UNREACHABLE_AFTER_MS);
    }
  };

  /** The socket closed, failed to open, or went silent for 25 s. */
  function dropped(): void {
    if (!running) return;
    closeSocket();
    enterReconnecting();
    scheduleReconnect();
  }

  /** Close and reconnect now with a fresh backoff. */
  const reconnectNow = (): void => {
    attempt = 0;
    reconnectTimer = clear(reconnectTimer);
    closeSocket();
    enterReconnecting();
    openSocket();
  };

  return {
    status,
    start() {
      if (running) return;
      running = true;
      status.set("connecting");
      openSocket();
    },
    stop() {
      running = false;
      clearAllTimers();
      closeSocket();
    },
    retry() {
      if (!running) return;
      if (status.get() === "unreachable") {
        // H2 → H3: back to amber; the 10 s window starts again.
        status.set("reconnecting");
        unreachableTimer = clear(unreachableTimer);
        unreachableTimer = setTimeout(() => {
          unreachableTimer = null;
          if (status.get() === "reconnecting") status.set("unreachable");
        }, UNREACHABLE_AFTER_MS);
      }
      reconnectNow();
    },
    resume() {
      if (!running) return;
      const current = status.get();
      const fresh = lastFrameAt !== null && now() - lastFrameAt <= RESUME_STALE_MS;
      if ((current === "live" || current === "back_online") && fresh) return;
      reconnectNow();
    },
  };
}

/** Wires browser triggers to `resume()`. Returns the cleanup. */
export function attachResumeTriggers(manager: ConnectionManager): () => void {
  const onVisibility = (): void => {
    if (document.visibilityState === "visible") manager.resume();
  };
  const onOnline = (): void => manager.resume();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
  };
}
