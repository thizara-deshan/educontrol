import type { Command, CommandBody, HwEvent, ServerEvent } from "@eduscope/contracts";
import { fixedClock } from "../../src/clock.ts";
import { createDispatcher, type Issuer } from "../../src/commands/dispatcher.ts";
import type { IrCodeLookup } from "../../src/commands/ir-codes.ts";
import type { LogEntry } from "../../src/db/event-log.ts";
import { applyHwEvent } from "../../src/domain/hw-events.ts";
import type { KwhBaseline } from "../../src/domain/model.ts";
import { createStateStore } from "../../src/domain/state-store.ts";
import { createIngest } from "../../src/hw/ingest.ts";
import { bootModel, fakeHw, RULES, snapshotEvent, T0 } from "../helpers.ts";

/** Short deadlines so timeout tests run on real timers. */
export const TEST_TIMEOUTS = { zigbeeMs: 60, irSendMs: 60, irLearnMs: 60, hdmiMs: 60, mixerMs: 60, screenMs: 60 };

export const PHONE: Issuer = { public_id: "pub-phone", label: "phone", access: "control" };
export const LAPTOP: Issuer = { public_id: "pub-laptop", label: "laptop", access: "control" };
export const TECH: Issuer = { public_id: "pub-tech", label: "laptop", access: "technician" };

/** Captured codes by "<device>.<role>" / "<device>.setpoint_<t>"; anything else is missing. */
export function irStub(codes: Record<string, string>): IrCodeLookup {
  return {
    find(deviceId, match) {
      const key = "role" in match ? `${deviceId}.${match.role}` : `${deviceId}.setpoint_${match.setpoint_c}`;
      const code = codes[key];
      return code === undefined ? { ok: false, message: `${key} has no captured IR code` } : { ok: true, code, transport: "ir_zs06" };
    },
  };
}

const ALL_CODES = {
  "projector.power_on": "ON", "projector.power_off": "OFF", "ac.power_off": "AC-OFF",
  ...Object.fromEntries([18, 20, 22, 24, 26, 28, 30].map((t) => [`ac.setpoint_${t}`, `AC-${t}`])),
};

/** A live room (fixture snapshot applied, hw up) with dispatcher + ingest wired like app.ts. */
export function room(options: { codes?: Record<string, string> } = {}) {
  const clock = fixedClock(T0);
  const hw = fakeHw();
  const events: ServerEvent[] = [];
  const logs: LogEntry[] = [];
  const baselines: KwhBaseline[] = [];
  const ticks: number[] = [];
  const store = createStateStore({
    initial: applyHwEvent(bootModel({ acSetpoints: [18, 20, 22, 24, 26, 28, 30] }), snapshotEvent()),
    clock, rules: RULES, coalesceMs: 0,
  });
  store.subscribe((state) => events.push({ type: "state", state }));
  const emit = (event: ServerEvent): void => {
    events.push(event);
  };
  const log = (entry: LogEntry): void => {
    logs.push(entry);
  };
  const dispatcher = createDispatcher({ store, hw, ir: irStub(options.codes ?? ALL_CODES), timeouts: TEST_TIMEOUTS, clock, emit, log });
  const ingest = createIngest({
    store, dispatcher, emit, log, hwDownGraceMs: 10_000,
    persistBaseline: (baseline) => baselines.push(baseline),
    scheduleTick: (ms) => ticks.push(ms),
  });
  let seq = 0;
  const send = (body: CommandBody, issuer: Issuer = PHONE): Command =>
    dispatcher.dispatch({ client_cmd_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, body }, issuer);
  const statuses = (command: Command): string[] =>
    events.flatMap((e) => (e.type === "command" && e.command.id === command.id ? [e.command.status] : []));
  const activities = (): string[] => events.flatMap((e) => (e.type === "activity" ? [`${e.text} · ${e.by}`] : []));
  /** A hw report, through ingest (attribution, correlation). */
  const report = (event: HwEvent): void => ingest.handle(event);
  /** Makes the fake hw answer every command with the matching report, like the real fake service. */
  const echo = (toEvent: (method: string, body: unknown) => HwEvent | null): void => {
    hw.onCall = (method, body) => {
      const event = toEvent(method, body);
      if (event !== null) ingest.handle(event);
    };
  };
  return { clock, hw, events, logs, baselines, ticks, store, dispatcher, ingest, send, statuses, activities, report, echo };
}
