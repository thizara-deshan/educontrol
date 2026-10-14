import { DevicePatch, PermitJoinRequest, type Device, type ServerEvent } from "@eduscope/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { deleteDevice, findDevice, updateDevice } from "../db/devices.ts";
import { transportChangeError } from "../domain/devices.ts";
import type { StateStore } from "../domain/state-store.ts";
import { ApiFailure } from "../errors.ts";
import type { HwClient } from "../hw/client.ts";
import type { RegistrySync } from "../registry-sync.ts";

// ARCHITECTURE §3.3 api/devices.ts — S3d registry and permit joining. Technician only. A registry
// write reloads the store's registry (devices[] in the next `state`) and invalidates both lists.

const TECHNICIAN = { access: "technician" } as const;
const IdParams = z.object({ id: z.string().min(1) });
const REGISTRY_KEYS = [["devices"], ["ir", "devices"]];
const notFound = (): ApiFailure => new ApiFailure(404, "not_found", "Device not found");

export async function deviceRoutes(
  app: FastifyInstance,
  options: { db: Db; store: StateStore; hw: HwClient; sync: RegistrySync; emit: (event: ServerEvent) => void },
) {
  const { db, store, hw, sync } = options;
  const changed = (): void => options.emit({ type: "invalidate", keys: REGISTRY_KEYS });
  const live = (id: string): Device => {
    const device = store.get().devices.find((candidate) => candidate.id === id);
    if (device === undefined) throw notFound();
    return device;
  };
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get("/devices", { config: TECHNICIAN }, async () => store.get().devices);

  /** S3d edit sheet: rename, hardware id, transport (IR devices only, R8). */
  api.patch("/devices/:id", { config: TECHNICIAN, schema: { params: IdParams, body: DevicePatch } }, async (request) => {
    const current = findDevice(db, request.params.id);
    if (current === null) throw notFound();
    const refused = transportChangeError(current.transport, request.body.transport);
    if (refused !== null) throw new ApiFailure(409, "precondition", refused);
    updateDevice(db, current.id, request.body);
    sync.registry();
    changed();
    return live(current.id);
  });

  api.delete("/devices/:id", { config: TECHNICIAN, schema: { params: IdParams } }, async (request, reply) => {
    if (!deleteDevice(db, request.params.id)) throw notFound();
    sync.registry();
    sync.acSetpoints(); // its IR commands went with it (R4)
    changed();
    return reply.status(204).send();
  });

  /** S3d "Permit joining": hw opens the mesh; `zigbee.mesh` then drives S2.E21's countdown on every client. */
  api.post("/zigbee/permit-join", { config: TECHNICIAN, schema: { body: PermitJoinRequest } }, async (request, reply) => {
    const state = store.get();
    if (state.connection.hw === "down") throw new ApiFailure(503, "hw_unavailable", "Hardware service offline");
    if (state.zigbee.coordinator.status !== "online") throw new ApiFailure(409, "precondition", "Coordinator offline");
    const ack = await hw.permitJoin({ seconds: request.body.seconds });
    if (!ack.ok) throw new ApiFailure(503, "hw_unavailable", "Coordinator didn't respond");
    return reply.status(202).send();
  });
}
