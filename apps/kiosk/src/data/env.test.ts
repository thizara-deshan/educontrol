import { describe, expect, it } from "vitest";
import { readEnv } from "./env";

describe("readEnv", () => {
  it("defaults to http and R-101", () => {
    expect(readEnv({})).toEqual({ VITE_API_MODE: "http", VITE_ROOM_ID: "R-101" });
  });
  it("accepts mock", () => {
    expect(readEnv({ VITE_API_MODE: "mock" }).VITE_API_MODE).toBe("mock");
  });
  it("rejects an unknown mode", () => {
    expect(() => readEnv({ VITE_API_MODE: "fake" })).toThrow();
  });
});
