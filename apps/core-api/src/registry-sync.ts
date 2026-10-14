import { capturedSetpoints } from "./commands/ir-codes.ts";
import type { Db } from "./db/client.ts";
import { loadRegistry } from "./db/devices.ts";
import { withAvailableSetpoints } from "./domain/ac.ts";
import type { StateStore } from "./domain/state-store.ts";

// After a settings write the in-memory model must match the DB: the device registry (S3d renames,
// R8 transport, removals → `devices[]` in RoomState) and S1's AC range (R4). Each call is one store
// update, so every client gets the change in the next `state` push.

export interface RegistrySync {
  /** Reloads `RoomModel.registry` from the `devices` table. */
  registry(): void;
  /** Rebuilds `environment.ac.available_setpoints` from the captured setpoint frames of the "ac" device. */
  acSetpoints(): void;
}

export function createRegistrySync(db: Db, store: StateStore): RegistrySync {
  return {
    registry: () => {
      store.update((model) => ({ ...model, registry: loadRegistry(db) }));
    },
    acSetpoints: () => {
      store.update((model) => withAvailableSetpoints(model, capturedSetpoints(db, "ac")));
    },
  };
}
