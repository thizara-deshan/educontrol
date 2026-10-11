import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_TOKENS } from "./token-names";
import tokensCss from "./tokens.css?raw";

const captured = (pattern: RegExp): string[] =>
  [...tokensCss.matchAll(pattern)].map((match) => match[1] ?? "").sort();

describe("token-names", () => {
  it("lists every colour token defined with a literal in tokens.css", () => {
    expect(captured(/--color-([a-z0-9-]+):\s*#/g)).toEqual([...COLOR_TOKENS].sort());
  });
  it("has all 27 SPEC §3.1 colours", () => {
    expect(COLOR_TOKENS).toHaveLength(27);
  });
  it("lists every type-scale token", () => {
    expect(captured(/--text-([a-z]+(?:-[a-z]+)*):\s*\d+px/g)).toEqual([...TYPE_TOKENS].sort());
  });
  it("lists every radius token", () => {
    expect(captured(/--radius-([a-z]+):\s*\d+px/g)).toEqual([...RADIUS_TOKENS].sort());
  });
  it("keeps only the sm (600) and lg (1024) breakpoints", () => {
    expect(tokensCss).toContain("--breakpoint-sm: 600px;");
    expect(tokensCss).toContain("--breakpoint-lg: 1024px;");
    for (const removed of ["md", "xl", "2xl"]) {
      expect(tokensCss).toContain(`--breakpoint-${removed}: initial;`);
    }
  });
});
