import { describe, expect, it } from "vitest";
import { baselineAccess, expiresAt, hasAccess, isKioskRequest, rowMatches } from "../../src/domain/session-rules.ts";
import { T0 } from "../helpers.ts";

describe("§5 kiosk exemption", () => {
  it.each([
    ["127.0.0.1", true, true],
    ["::1", true, true],
    ["::ffff:127.0.0.1", true, true],
    ["192.168.1.20", true, false],
    ["127.0.0.1", false, false], // flag off (dev: the Vite proxy makes everyone local)
    [undefined, true, false],
  ])("%s with LOCALHOST_IS_KIOSK=%s → kiosk %s", (address, flag, kiosk) => {
    expect(isKioskRequest(address, flag)).toBe(kiosk);
  });
  it("a kiosk row is only honoured from the kiosk, a remote row only from remote", () => {
    expect(rowMatches("kiosk", true)).toBe(true);
    expect(rowMatches("kiosk", false)).toBe(false);
    expect(rowMatches("remote", true)).toBe(false);
  });
  it("baseline: kiosk control, remote view (R14)", () => {
    expect(baselineAccess("kiosk")).toBe("control");
    expect(baselineAccess("remote")).toBe("view");
  });
});

describe("§2.3 session ends", () => {
  const last = new Date(T0);
  it.each([
    ["control", "remote", "2026-10-05T12:42:00.000Z"], // 2 h idle
    ["technician", "remote", "2026-10-05T10:57:00.000Z"], // 15 min
    ["technician", "kiosk", "2026-10-05T10:44:00.000Z"], // kiosk: 2 min
    ["control", "kiosk", null], // the kiosk never loses control
    ["view", "remote", null],
  ] as const)("%s %s expires at %s", (access, clientType, expected) => {
    expect(expiresAt(access, clientType, last)?.toISOString() ?? null).toBe(expected);
  });
  it("hasAccess ranks view < control < technician", () => {
    expect(hasAccess("technician", "control")).toBe(true);
    expect(hasAccess("control", "technician")).toBe(false);
    expect(hasAccess("view", "control")).toBe(false);
  });
});
