import { readdirSync, readFileSync } from "node:fs";
import { DeviceKind, HwEvent, Transport, type HwAck } from "@eduscope/contracts";
import { vi } from "vitest";
import { Config } from "../src/config.ts";
import type { HwClient, IrLearnOutcome } from "../src/hw/client.ts";
import { initialModel } from "../src/domain/initial.ts";
import type { DeviceInfo, RoomModel, RuleConfig } from "../src/domain/model.ts";
import { SEED_DEVICES } from "../src/db/seed.ts";

/** Screenshot clock (Mon 5 Oct 10:42 UTC); every test that needs "now" starts here. */
export const T0 = "2026-10-05T10:42:00.000Z";

/** A complete, valid config for tests; override any key. */
export function testConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  return Config.parse({
    DB_PATH: ":memory:",
    COOKIE_SECRET: "test-cookie-secret-test-cookie-secret",
    INITIAL_ROOM_PIN: "1234",
    INITIAL_TECH_PIN: "123456",
    ...overrides,
  });
}

export const RULES: RuleConfig = { climateIntervalS: 300, powerIntervalS: 60, hwDownGraceMs: 10_000 };

/** The seeded R-101 registry as domain DeviceInfo. */
export const REGISTRY: DeviceInfo[] = SEED_DEVICES.map((row) => ({
  id: row.id, name: row.name, kind: DeviceKind.parse(row.kind), transport: Transport.parse(row.transport),
  brand: row.brand ?? null, model: row.model ?? null, hw_ref: row.hw_ref ?? null,
}));

export function bootModel(overrides: Partial<Parameters<typeof initialModel>[0]> = {}): RoomModel {
  return initialModel({
    room: { id: "R-101", hostname: "r-101.local" },
    registry: REGISTRY,
    acSetpoints: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    interlockBypassed: false,
    kwhBaseline: null,
    now: T0,
    ...overrides,
  });
}

const FIXTURES = new URL("../../../packages/contracts/fixtures/hw/", import.meta.url);

/** A parsed fixtures/hw file. */
export function hwFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8"));
}

/** Every `event.*.json` in fixtures/hw, parsed as HwEvent. */
export function hwEventFixtures(): { name: string; event: HwEvent }[] {
  return readdirSync(FIXTURES)
    .filter((name) => name.startsWith("event.") && name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, event: HwEvent.parse(hwFixture(name)) }));
}

/** The fixture snapshot event (screenshot 01 state), with its time moved to `at`. */
export function snapshotEvent(at: string = T0): HwEvent {
  const event = HwEvent.parse(hwFixture("event.snapshot.json"));
  return { ...event, at };
}

export function hwEvent<T extends HwEvent["type"]>(type: T, data: Extract<HwEvent, { type: T }>["data"], at: string = T0): HwEvent {
  return HwEvent.parse({ type, at, data });
}

export interface FakeHw extends HwClient {
  calls: { method: keyof HwClient; body: unknown }[];
  /** Answer of the next calls (default `{ok:true}`). */
  nextAcks: HwAck[];
  /** Answer of the next `irLearn` calls (default captured "Q0FQVFVSRUQ="); a promise lets a test hold the learn open. */
  nextLearns: (IrLearnOutcome | Promise<IrLearnOutcome>)[];
  /** Runs after each call is recorded (e.g. to feed the echo event into ingest). */
  onCall?: (method: keyof HwClient, body: unknown) => void;
}

export function fakeHw(): FakeHw {
  const hw: FakeHw = {
    calls: [],
    nextAcks: [],
    nextLearns: [],
    lightsSet: vi.fn(async (body) => record("lightsSet", body)),
    projectorRelay: vi.fn(async (body) => record("projectorRelay", body)),
    irSend: vi.fn(async (body) => record("irSend", body)),
    hdmiSelect: vi.fn(async (body) => record("hdmiSelect", body)),
    screenMove: vi.fn(async (body) => record("screenMove", body)),
    audioLevel: vi.fn(async (body) => record("audioLevel", body)),
    audioMute: vi.fn(async (body) => record("audioMute", body)),
    irLearnCancel: vi.fn(async () => record("irLearnCancel", {})),
    permitJoin: vi.fn(async (body) => record("permitJoin", body)),
    irLearn: vi.fn(async (body): Promise<IrLearnOutcome> => {
      hw.calls.push({ method: "irLearn", body });
      hw.onCall?.("irLearn", body);
      return hw.nextLearns.shift() ?? { status: "captured", code_format: "tuya", code: "Q0FQVFVSRUQ=" };
    }),
  };
  function record(method: keyof HwClient, body: unknown): HwAck {
    hw.calls.push({ method, body });
    hw.onCall?.(method, body);
    return hw.nextAcks.shift() ?? { ok: true };
  }
  return hw;
}

/** Unwraps a value a test knows is there (no `!` allowed by lint). */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
