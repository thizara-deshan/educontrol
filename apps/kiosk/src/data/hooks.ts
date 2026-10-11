import type { CommandBody, RoomState } from "@eduscope/contracts";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useApiClient } from "./api-context";
import { createCommandSender } from "./commands/command-sender";
import { inlineErrorStore } from "./commands/inline-errors";
import { pendingStore, type ControlKey } from "./commands/pending-store";
import { computeControlGate, type ControlGate } from "./gate";
import { sessionQuery, stateQuery } from "./queries";
import { connectionStore } from "./realtime/connection-store";
import type { ConnectionStatus } from "./realtime/connection";

/** A slice of the room state; `undefined` until the first snapshot (H1 → skeletons). */
export function useRoomState<T>(select: (state: RoomState) => T): T | undefined {
  return useQuery({ ...stateQuery, select }).data;
}

export function useSession() {
  return useQuery(sessionQuery(useApiClient())).data;
}

export function useConnectionStatus(): ConnectionStatus {
  return useStore(connectionStore, (status) => status);
}

/** Every control asks this hook (connection + access + device online). */
export function useControlGate(deviceId?: string): ControlGate {
  const connection = useConnectionStatus();
  const access = useSession()?.access;
  const deviceOnline = useRoomState((state) =>
    deviceId === undefined ? undefined : state.devices.find((device) => device.id === deviceId)?.online.value,
  );
  return computeControlGate({ connection, access, deviceOnline });
}

export function usePending(key: ControlKey): boolean {
  return useStore(pendingStore.entries, (entries) => entries.has(key));
}

export function useInlineError(key: ControlKey): string | null {
  return useStore(inlineErrorStore.errors, (errors) => errors.get(key) ?? null);
}

/**
 * `send(body)` for one control (ARCHITECTURE §4.6). Closed gate → ignored (M03 opens the PIN
 * overlay for `locked`). Pending → ignored (H5).
 */
export function useCommand(key: ControlKey, deviceId?: string) {
  const api = useApiClient();
  const gate = useControlGate(deviceId);
  const pending = usePending(key);
  const error = useInlineError(key);
  const sender = useMemo(() => createCommandSender({ api, pending: pendingStore, inlineErrors: inlineErrorStore }), [api]);
  const send = useCallback(
    (body: CommandBody) => {
      if (!gate.enabled) return;
      void sender(key, body);
    },
    [gate.enabled, sender, key],
  );
  return { send, pending, error, gate };
}
