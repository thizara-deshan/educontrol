import { Config } from "../src/config.ts";

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

/** Unwraps a value a test knows is there (no `!` allowed by lint). */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
