import type { ClientLabel } from "@eduscope/contracts";
import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/data/api-client";
import { inlineErrorStore, MESSAGE_TIMED_OUT } from "@/data/commands/inline-errors";
import { pendingStore } from "@/data/commands/pending-store";
import { serverClock } from "@/lib/server-time";
import { applyEvent } from "./apply-event";
import { createCachePort } from "./cache-port";
import { attachResumeTriggers, createConnectionManager, type ConnectionManager } from "./connection";
import { connectionStore } from "./connection-store";

const SWEEP_EVERY_MS = 1000;

export interface RealtimeRuntime {
  connection: ConnectionManager;
  start(): void;
  stop(): void;
}

/** Wires ApiClient.connect → ConnectionManager → applyEvent → query cache. One per page. */
export function createRealtimeRuntime(options: {
  api: ApiClient;
  queryClient: QueryClient;
  label: ClientLabel;
  toast: (text: string) => void;
}): RealtimeRuntime {
  const cache = createCachePort(options.queryClient, options.api);
  const connection = createConnectionManager({
    open: (handlers) => options.api.connect(options.label, handlers),
    onEvent: (event) =>
      applyEvent(event, {
        cache,
        pending: pendingStore,
        inlineErrors: inlineErrorStore,
        toast: options.toast,
        syncServerTime: (iso) => serverClock.sync(iso),
      }),
    store: connectionStore,
  });
  let detach: (() => void) | null = null;
  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  return {
    connection,
    start() {
      connection.start();
      detach = attachResumeTriggers(connection);
      // ARCHITECTURE §4.6 step 5: a pending overlay never outlives the safety window.
      sweepTimer = setInterval(() => {
        for (const expired of pendingStore.sweep(Date.now())) inlineErrorStore.show(expired.key, MESSAGE_TIMED_OUT);
      }, SWEEP_EVERY_MS);
    },
    stop() {
      connection.stop();
      detach?.();
      detach = null;
      if (sweepTimer !== null) clearInterval(sweepTimer);
      sweepTimer = null;
    },
  };
}
