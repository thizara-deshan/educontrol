import type { CommandBody } from "@eduscope/contracts";
import type { ApiClient } from "@/data/api-client";
import { MESSAGE_FAILED, type InlineErrorStore } from "./inline-errors";
import type { ControlKey, PendingStore } from "./pending-store";

// ARCHITECTURE §4.6 steps 1–3. The gate check happens in useCommand before this is called.
export interface CommandSenderDeps {
  api: Pick<ApiClient, "sendCommand">;
  pending: PendingStore;
  inlineErrors: InlineErrorStore;
  newId?: () => string;
  now?: () => number;
}

export type SendOutcome = "sent" | "ignored";

export function createCommandSender(deps: CommandSenderDeps) {
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const now = deps.now ?? Date.now;

  return async function send(key: ControlKey, body: CommandBody): Promise<SendOutcome> {
    if (deps.pending.isPending(key)) return "ignored"; // H5: repeat taps ignored
    const clientCmdId = newId();
    deps.inlineErrors.dismiss(key);
    deps.pending.add({ key, clientCmdId, status: "pending", startedAt: now() });
    try {
      await deps.api.sendCommand({ client_cmd_id: clientCmdId, body });
      return "sent"; // 202: keep pending until a `command` event
    } catch {
      if (deps.pending.remove(clientCmdId) !== undefined) {
        deps.inlineErrors.show(key, MESSAGE_FAILED);
      }
      return "sent";
    }
  };
}
