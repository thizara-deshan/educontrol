import { describe, expect, it } from "vitest";
import { formatUptime, qrPath } from "./about.view";

describe("formatUptime (S3e)", () => {
  it.each<[number, string]>([
    [30, "under a minute"],
    [12 * 60, "12 min"],
    [5 * 3600 + 12 * 60, "5 h 12 min"],
    [(3 * 24 + 4) * 3600 + 59, "3 d 4 h"],
  ])("%d s → %s", (seconds, text) => {
    expect(formatUptime(seconds)).toBe(text);
  });
});

describe("qrPath", () => {
  it("encodes http://r-101.local as a 25×25 code (version 2, level M)", () => {
    const qr = qrPath("http://r-101.local");
    expect(qr.size).toBe(25);
    // Finder pattern: the top-left module is dark, offset by the 4-module quiet zone.
    expect(qr.d.startsWith("M4 4h1v1h-1z")).toBe(true);
  });
  it("is deterministic and depends on the text", () => {
    expect(qrPath("http://r-101.local").d).toBe(qrPath("http://r-101.local").d);
    expect(qrPath("http://r-102.local").d).not.toBe(qrPath("http://r-101.local").d);
  });
});
