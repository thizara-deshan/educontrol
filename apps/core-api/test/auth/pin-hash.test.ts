import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "../../src/auth/pin-hash.ts";

describe("PIN hash (D-08)", () => {
  it("scrypt round trip; a wrong PIN or a malformed hash never matches", async () => {
    const hash = await hashPin("1234");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    expect(await verifyPin("1234", hash)).toBe(true);
    expect(await verifyPin("1235", hash)).toBe(false);
    expect(await verifyPin("1234", "plain-1234")).toBe(false);
    expect(await hashPin("1234")).not.toBe(hash); // salted
  });
});
