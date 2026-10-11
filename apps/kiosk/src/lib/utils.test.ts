import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a type token next to a colour token", () => {
    expect(cn("text-section font-bold text-text-2")).toBe("text-section font-bold text-text-2");
    expect(cn("text-value", "text-accent")).toBe("text-value text-accent");
  });
  it("later type tokens replace earlier ones", () => {
    expect(cn("text-caption", "text-button")).toBe("text-button");
  });
  it("later colour tokens replace earlier ones", () => {
    expect(cn("text-text-2", "text-accent")).toBe("text-accent");
    expect(cn("bg-control", "bg-accent-fill")).toBe("bg-accent-fill");
  });
  it("later radius tokens replace earlier ones", () => {
    expect(cn("rounded-card", "rounded-btn")).toBe("rounded-btn");
  });
});
