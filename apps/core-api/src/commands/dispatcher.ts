import { randomUUID } from "node:crypto";
import type { AccessLevel, ApiErrorCode, ClientLabel, Command, CommandRequest, CommandStatus, RoomState, ServerEvent } from "@eduscope/contracts";
import type { Clock } from "../clock.ts";
import type { EventLogger } from "../db/event-log.ts";
import { ApiFailure } from "../errors.ts";
import { describeCommand } from "../domain/attribution.ts";
import type { OutputKey } from "../domain/hw-events.ts";
import type { StateStore } from "../domain/state-store.ts";
import type { HwClient, HwTimeouts } from "../hw/client.ts";
import type { IrCodeLookup } from "./ir-codes.ts";
import { type CommandPlan, planCommand, requiredAccess } from "./policies.ts";

// ARCHITECTURE §6.5: CommandRequest → policies → Command (pending) → hw → sent | failed →
// read-back (confirmed) | IR ack (assumed) | deadline (timed_out). Last write wins per output.

export interface Issuer {
  /** null = the scheduler. */
  public_id: string | null;
  label: ClientLabel | "schedule";
  access: AccessLevel;
}

/** Timed actions (ARCHITECTURE §6.8): `issued_by: null`, attribution "· by schedule", any command kind. */
export const SCHEDULE_ISSUER: Issuer = { public_id: null, label: "schedule", access: "technician" };

function issuedBy(issuer: Issuer): Command["issued_by"] {
  if (issuer.public_id === null || issuer.label === "schedule") return null;
  return { public_id: issuer.public_id, label: issuer.label };
}

/** 403 (access), 409 (precondition) or 503 (hw down): no Command is created. */
export class CommandRejected extends ApiFailure {
  constructor(status: 403 | 409 | 503, code: ApiErrorCode, message: string) {
    super(status, code, message);
    this.name = "CommandRejected";
  }
}

interface Inflight {
  command: Command;
  plan: CommandPlan;
  issuer: Issuer;
  done: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

/** A command that a hw report just proved (returned by claim, finished by confirm). */
export interface Claim {
  readonly inflight: Inflight;
  readonly by: ClientLabel | "schedule";
}

export interface Dispatcher {
  /** Validates and starts a command; throws CommandRejected. Returns the `pending` Command (202). */
  dispatch(request: CommandRequest, issuer: Issuer): Command;
  /** Called by ingest inside a store update: the in-flight command this report proves, if any. */
  claim(key: OutputKey, state: RoomState): Claim | null;
  /** Broadcasts a claimed command as `confirmed` (+ activity). Call after the state broadcast. */
  confirm(claim: Claim): void;
  /** In-flight commands (tests). */
  inflightCount(): number;
  close(): void;
}

const RANK: Record<AccessLevel, number> = { view: 0, control: 1, technician: 2 };

export function createDispatcher(deps: {
  store: StateStore;
  hw: HwClient;
  ir: IrCodeLookup;
  timeouts: HwTimeouts;
  clock: Clock;
  emit: (event: ServerEvent) => void;
  log: EventLogger;
  newId?: () => string;
}): Dispatcher {
  const newId = deps.newId ?? randomUUID;
  const inflight = new Map<OutputKey, Inflight>();
  const quiet = (command: Command): boolean => command.body.kind === "audio.level" && !command.body.final;

  function finish(entry: Inflight, status: CommandStatus, error: string | null, announce: boolean): void {
    if (entry.done) return;
    entry.done = true;
    if (entry.timer !== null) clearTimeout(entry.timer);
    if (inflight.get(entry.plan.key) === entry) inflight.delete(entry.plan.key);
    entry.command = { ...entry.command, status, error };
    deps.emit({ type: "command", command: entry.command });
    if (quiet(entry.command)) return; // slider drags: no log, no toast (§6.5)
    deps.log({
      type: "command", actor: entry.issuer.label, public_id: entry.issuer.public_id, subject: entry.command.body.kind,
      payload: entry.command.body, result: status,
    });
    if (announce && (status === "confirmed" || status === "assumed")) {
      deps.emit({ type: "activity", text: describeCommand(entry.command.body), by: entry.issuer.label, public_id: entry.issuer.public_id });
    }
  }

  async function run(entry: Inflight): Promise<void> {
    const { plan } = entry;
    for (const call of plan.calls) {
      const ack = await call(deps.hw);
      if (!ack.ok) {
        if (plan.revert !== undefined) deps.store.update((model) => plan.revert?.(model) ?? model);
        finish(entry, ack.error.code === "timeout" ? "timed_out" : "failed", ack.error.code === "timeout" ? null : plan.failureText, false);
        return;
      }
    }
    if (entry.done) return; // already confirmed by an early report, or superseded
    entry.command = { ...entry.command, status: "sent" };
    deps.emit({ type: "command", command: entry.command });
    if (plan.ir) {
      if (plan.after !== undefined) deps.store.update((model, at) => plan.after?.(model, at, entry.issuer.label) ?? model);
      deps.store.flush();
      finish(entry, "assumed", null, true);
    }
  }

  return {
    dispatch(request, issuer) {
      const { body } = request;
      if (RANK[issuer.access] < RANK[requiredAccess(body)]) throw new CommandRejected(403, "forbidden", "Technician PIN required");
      const result = planCommand(body, deps.store.model(), deps.ir, deps.timeouts);
      if (!result.ok) throw new CommandRejected(result.status, result.code, result.message);
      const { plan } = result;

      const command: Command = {
        id: newId(), client_cmd_id: request.client_cmd_id, body,
        issued_by: issuedBy(issuer),
        status: "pending", error: null, at: deps.clock.now().toISOString(),
      };
      const older = inflight.get(plan.key);
      if (older !== undefined) finish(older, "assumed", null, false); // last write wins (R12)
      const entry: Inflight = { command, plan, issuer, done: false, timer: null };
      entry.timer = setTimeout(() => finish(entry, "timed_out", null, false), plan.timeoutMs);
      inflight.set(plan.key, entry);
      deps.emit({ type: "command", command });
      if (plan.before !== undefined) deps.store.update((model, at) => plan.before?.(model, at) ?? model);
      void run(entry);
      return command;
    },
    claim(key, state) {
      const entry = inflight.get(key);
      if (entry === undefined || entry.done || entry.plan.confirmedBy?.(state) !== true) return null;
      inflight.delete(key);
      if (entry.timer !== null) clearTimeout(entry.timer);
      entry.timer = null;
      return { inflight: entry, by: entry.issuer.label };
    },
    confirm(claim) {
      finish(claim.inflight, "confirmed", null, true);
    },
    inflightCount: () => inflight.size,
    close() {
      for (const entry of inflight.values()) if (entry.timer !== null) clearTimeout(entry.timer);
      inflight.clear();
    },
  };
}
