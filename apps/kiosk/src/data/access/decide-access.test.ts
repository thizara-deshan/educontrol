import type { AccessLevel } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { decideAccess, type AccessDecision, type RequiredAccess } from "./decide-access";

describe("decideAccess (useRequireAccess decision table)", () => {
  it.each<[RequiredAccess, AccessLevel | undefined, AccessDecision]>([
    ["control", "view", "prompt"],
    ["control", "control", "granted"],
    ["control", "technician", "granted"],
    ["technician", "view", "prompt"],
    ["technician", "control", "prompt"],
    ["technician", "technician", "granted"],
    ["control", undefined, "wait"],
    ["technician", undefined, "wait"],
  ])("needs %s, has %s → %s", (required, access, expected) => {
    expect(decideAccess(required, access)).toBe(expected);
  });
});
