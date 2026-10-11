import { CommandRequest } from "@eduscope/contracts";
import { describe, expect, it } from "vitest";
import { uuidV4 } from "./uuid";

describe("uuidV4", () => {
  it("formats bytes as a v4 UUID", () => {
    expect(uuidV4((bytes) => bytes.fill(0xff))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(uuidV4((bytes) => bytes.fill(0))).toBe("00000000-0000-4000-8000-000000000000");
  });
  it("is accepted by the command contract", () => {
    const id = uuidV4();
    expect(CommandRequest.safeParse({ client_cmd_id: id, body: { kind: "projector.power", on: true } }).success).toBe(true);
  });
  it("differs between calls", () => {
    expect(uuidV4()).not.toBe(uuidV4());
  });
});
