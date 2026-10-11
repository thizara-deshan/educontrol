import type { ClientSession, Command, RoomState, ServerEvent } from "@eduscope/contracts";
import { formatActivity } from "@/lib/format";
import { MESSAGE_FAILED, MESSAGE_TIMED_OUT, type InlineErrorStore } from "@/data/commands/inline-errors";
import type { PendingStore } from "@/data/commands/pending-store";

// ServerEvent → client state (ARCHITECTURE §4.5). Pure apart from the injected ports, so the
// mock and the http adapter share this one path. Never writes values optimistically.

/** The query cache as apply-event sees it (implemented over QueryClient in cache-port.ts). */
export interface CachePort {
  getState(): RoomState | undefined;
  setState(state: RoomState): void;
  getSession(): ClientSession | undefined;
  setSession(session: ClientSession): void;
  invalidateAllExceptState(): void;
  invalidate(keys: readonly (readonly string[])[]): void;
}

export interface ApplyEventDeps {
  cache: CachePort;
  pending: PendingStore;
  inlineErrors: InlineErrorStore;
  /** H13 toast (bottom, 4 s). */
  toast(text: string): void;
  /** S1.E2 server clock offset. */
  syncServerTime(serverTimeIso: string): void;
}

function applyCommand(command: Command, deps: ApplyEventDeps): void {
  switch (command.status) {
    case "pending":
      return;
    case "sent":
      deps.pending.markSent(command.client_cmd_id);
      return;
    case "confirmed":
    case "assumed":
      deps.pending.remove(command.client_cmd_id);
      return;
    case "failed":
    case "timed_out": {
      const entry = deps.pending.remove(command.client_cmd_id);
      if (entry === undefined) return; // another client's command
      const message = command.status === "timed_out" ? MESSAGE_TIMED_OUT : (command.error ?? MESSAGE_FAILED);
      deps.inlineErrors.show(entry.key, message);
      return;
    }
  }
}

export function applyEvent(event: ServerEvent, deps: ApplyEventDeps): void {
  switch (event.type) {
    case "snapshot":
      // H4: full replace regardless of rev (a restarted server starts again at rev 0).
      deps.cache.setState(event.state);
      deps.syncServerTime(event.state.server_time);
      deps.pending.clear();
      deps.cache.invalidateAllExceptState();
      return;
    case "state": {
      const current = deps.cache.getState();
      if (current === undefined || event.state.rev <= current.rev) return; // stale or before snapshot
      deps.cache.setState(event.state);
      deps.syncServerTime(event.state.server_time);
      return;
    }
    case "command":
      applyCommand(event.command, deps);
      return;
    case "activity": {
      const own = deps.cache.getSession()?.public_id;
      if (event.public_id !== null && event.public_id === own) return;
      deps.toast(formatActivity(event.text, event.by));
      return;
    }
    case "ir_capture":
      return; // M06 adds the capture store (H21)
    case "invalidate":
      deps.cache.invalidate(event.keys);
      return;
    case "session":
      deps.cache.setSession(event.session);
      return;
    case "ping":
      return; // liveness only: the connection manager records every frame
  }
}
