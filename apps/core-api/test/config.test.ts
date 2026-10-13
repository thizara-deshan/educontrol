import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const BASE = { DB_PATH: "/tmp/x.db", COOKIE_SECRET: "x".repeat(32) };

describe("config", () => {
  it("applies defaults", () => {
    const config = loadConfig(BASE);
    expect(config).toMatchObject({ PORT: 3000, HOST: "0.0.0.0", HW_URL: "http://127.0.0.1:8081", ROOM_ID: "R-101", ROOM_HOSTNAME: "r-101.local" });
    expect(config).toMatchObject({ LOCALHOST_IS_KIOSK: false, SEED_FAKE_IR_CODES: false, TIMEOUT_IR_SEND_MS: 3000, HW_DOWN_GRACE_MS: 10_000 });
  });
  it("parses booleans and numbers from strings", () => {
    expect(loadConfig({ ...BASE, LOCALHOST_IS_KIOSK: "true", PORT: "80" })).toMatchObject({ LOCALHOST_IS_KIOSK: true, PORT: 80 });
  });
  it("lists every problem", () => {
    expect(() => loadConfig({ DB_PATH: "", COOKIE_SECRET: "short", INITIAL_ROOM_PIN: "12345", LOCALHOST_IS_KIOSK: "yes" })).toThrow(
      /DB_PATH[\s\S]*COOKIE_SECRET must be at least 32 characters[\s\S]*LOCALHOST_IS_KIOSK[\s\S]*INITIAL_ROOM_PIN must be 4 digits/,
    );
  });
});
