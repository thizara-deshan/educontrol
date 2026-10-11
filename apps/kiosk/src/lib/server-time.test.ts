import { describe, expect, it } from "vitest";
import { createServerClock } from "./server-time";

describe("createServerClock", () => {
  it("is null before the first sync", () => {
    expect(createServerClock(() => 0).now()).toBeNull();
  });

  it("applies the server − client offset", () => {
    let client = Date.parse("2026-10-05T10:00:00Z");
    const clock = createServerClock(() => client);
    clock.sync("2026-10-05T10:42:00Z");
    expect(clock.now()?.toISOString()).toBe("2026-10-05T10:42:00.000Z");
    client += 60_000;
    expect(clock.now()?.toISOString()).toBe("2026-10-05T10:43:00.000Z");
  });

  it("re-syncs on every call", () => {
    const clock = createServerClock(() => Date.parse("2026-10-05T10:00:00Z"));
    clock.sync("2026-10-05T10:42:00Z");
    clock.sync("2026-10-05T09:00:00Z");
    expect(clock.offset.get()).toBe(-3_600_000);
  });
});
