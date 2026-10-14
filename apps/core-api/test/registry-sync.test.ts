import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "../src/clock.ts";
import { openDb } from "../src/db/client.ts";
import { updateDevice } from "../src/db/devices.ts";
import { irCommands } from "../src/db/schema.ts";
import { seed } from "../src/db/seed.ts";
import { createStateStore } from "../src/domain/state-store.ts";
import { createRegistrySync } from "../src/registry-sync.ts";
import { bootModel, RULES, T0, testConfig } from "./helpers.ts";

async function setup() {
  const { db } = openDb(":memory:");
  await seed(db, testConfig(), T0);
  const store = createStateStore({ initial: bootModel({ acSetpoints: [] }), clock: fixedClock(T0), rules: RULES, coalesceMs: 0 });
  return { db, store, sync: createRegistrySync(db, store) };
}

describe("registry sync", () => {
  it("R8: a transport change reaches devices[] in the next state", async () => {
    const { db, store, sync } = await setup();
    updateDevice(db, "projector", { transport: "ir_mcu", name: "Beamer" });
    const rev = store.get().rev;
    sync.registry();
    expect(store.get().devices.find((d) => d.id === "projector")).toMatchObject({ name: "Beamer", transport: "ir_mcu" });
    expect(store.get().rev).toBe(rev + 1);
  });

  it("R4: S1's range is rebuilt from captured setpoint frames", async () => {
    const { db, store, sync } = await setup();
    db.update(irCommands).set({ code: "QUJD" }).where(eq(irCommands.id, "ac.setpoint_22")).run();
    db.update(irCommands).set({ code: "QUJE" }).where(eq(irCommands.id, "ac.setpoint_18")).run();
    sync.acSetpoints();
    expect(store.get().environment.ac.available_setpoints).toEqual([18, 22]);
  });
});
