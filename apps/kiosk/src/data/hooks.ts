import type { ClientLabel, ClientSession, CommandBody, RoomState } from "@eduscope/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { decideAccess, type RequiredAccess } from "./access/decide-access";
import { pinRequests } from "./access/pin-requests";
import { localLockStore, lock, login } from "./access/session-actions";
import { useApiClient } from "./api-context";
import { createCommandSender, type SendOptions } from "./commands/command-sender";
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

/**
 * `ensure()` (ARCHITECTURE §4.7): `true` when the session already has `level`; otherwise opens
 * S4 and resolves after the PIN (`true`) or Cancel (`false`). Callers never replay the tap.
 */
export function useRequireAccess(level: RequiredAccess) {
  const access = useSession()?.access;
  const ensure = useCallback(async (): Promise<boolean> => {
    const decision = decideAccess(level, access);
    if (decision === "granted") return true;
    if (decision === "wait") return false;
    return pinRequests.request(level);
  }, [level, access]);
  return { ensure };
}

/** Login (S4) and Lock (S1.E8) against the active adapter; results land in `["session"]`. */
export function useSessionActions() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMemo(() => {
    const deps = {
      api,
      setSession: (session: ClientSession) => queryClient.setQueryData(sessionQuery(api).queryKey, session),
      localLock: localLockStore,
    };
    return {
      login: (level: RequiredAccess, pin: string, label: ClientLabel) => login(deps, level, pin, label),
      lock: () => lock(deps),
    };
  }, [api, queryClient]);
}

/** Lock (S1.E8 / S3.E3) with a pending flag for the button. Resolves `false` if it failed. */
export function useLock() {
  const { lock } = useSessionActions();
  const [pending, setPending] = useState(false);
  const run = useCallback(async (): Promise<boolean> => {
    setPending(true);
    const ok = await lock();
    setPending(false);
    return ok;
  }, [lock]);
  return { run, pending };
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
 * `send(body)` for one control (ARCHITECTURE §4.6). Locked (H12) → opens S4 with the room PIN
 * and does NOT send, now or after the unlock (SPEC S1). Other closed gates → ignored.
 * Pending → ignored (H5). `unlock()` opens S4 directly (e.g. a press on a locked slider).
 */
export function useCommand(key: ControlKey, deviceId?: string) {
  const api = useApiClient();
  const gate = useControlGate(deviceId);
  const pending = usePending(key);
  const error = useInlineError(key);
  const { ensure } = useRequireAccess("control");
  const sender = useMemo(() => createCommandSender({ api, pending: pendingStore, inlineErrors: inlineErrorStore }), [api]);
  const unlock = useCallback(() => {
    void ensure();
  }, [ensure]);
  const send = useCallback(
    (body: CommandBody, options?: SendOptions) => {
      if (gate.reason === "locked") {
        unlock();
        return;
      }
      if (!gate.enabled) return;
      void sender(key, body, options);
    },
    [gate.enabled, gate.reason, unlock, sender, key],
  );
  return { send, unlock, pending, error, gate };
}
