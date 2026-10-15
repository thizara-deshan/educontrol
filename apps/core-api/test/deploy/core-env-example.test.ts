import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.ts";

// M10: /etc/eduscope/core.env is created from deploy/pi/env/core.env.example (placeholders filled by
// deploy/pi/lib.sh ensure_env_file). The example must stay a valid core-api environment.

const EXAMPLE = new URL("../../../../deploy/pi/env/core.env.example", import.meta.url);

/** KEY=VALUE lines of an env file; comments and blank lines skipped. */
function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) env[match[1]] = match[2];
  }
  return env;
}

function renderedExample(): Record<string, string> {
  const text = readFileSync(EXAMPLE, "utf8")
    .replace("@COOKIE_SECRET@", "a".repeat(64));
  // The unit file sets KIOSK_DIST (it holds the checkout path); install.sh fills the rest.
  return { ...parseEnvFile(text), KIOSK_DIST: "/home/eduscope/edcontrol/apps/kiosk/dist" };
}

describe("deploy/pi/env/core.env.example", () => {
  it("has only the cookie-secret placeholder", () => {
    const placeholders = readFileSync(EXAMPLE, "utf8").match(/@[A-Z_]+@/g);
    expect(placeholders).toEqual(["@COOKIE_SECRET@"]);
  });
  it("is a valid production config once rendered", () => {
    const config = loadConfig(renderedExample());
    expect(config).toMatchObject({
      PORT: 80,
      HOST: "0.0.0.0",
      DB_PATH: "/var/lib/eduscope/eduscope.db",
      HW_URL: "http://127.0.0.1:8081",
      ROOM_ID: "R-101",
      ROOM_HOSTNAME: "r-101.local",
      LOCALHOST_IS_KIOSK: true,
      INITIAL_ROOM_PIN: "1234",
      INITIAL_TECH_PIN: "123456",
      SEED_FAKE_IR_CODES: false,
    });
  });
  it("restarts through the path unit, never sudo (D-23)", () => {
    expect(loadConfig(renderedExample()).RESTART_COMMAND).toBe("/usr/bin/touch /var/lib/eduscope/restart.request");
  });
});
