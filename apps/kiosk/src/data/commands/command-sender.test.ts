import type { Command, CommandRequest } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/data/api-client";
import { createCommandSender } from "./command-sender";
import { createInlineErrorStore, MESSAGE_FAILED } from "./inline-errors";
import { createPendingStore } from "./pending-store";

const ID = "00000000-0000-4000-8000-000000000001";
const accepted = (request: CommandRequest): Command => ({
  id: "cmd-1", client_cmd_id: request.client_cmd_id, body: request.body,
  issued_by: { public_id: "me", label: "laptop" }, status: "pending", error: null,
  at: "2026-10-05T10:42:00Z",
});

function setup(sendCommand: (request: CommandRequest) => Promise<Command>) {
  const pending = createPendingStore();
  const inlineErrors = createInlineErrorStore();
  const api = { sendCommand: vi.fn(sendCommand) };
  const send = createCommandSender({ api, pending, inlineErrors, newId: () => ID, now: () => 5 });
  return { pending, inlineErrors, api, send };
}

describe("command sender", () => {
  it("adds a pending entry before POSTing and keeps it on 202", async () => {
    const { pending, api, send } = setup(async (request) => accepted(request));
    const outcome = await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    expect(outcome).toBe("sent");
    expect(api.sendCommand).toHaveBeenCalledWith({
      client_cmd_id: ID, body: { kind: "lights.set", gang: "front", on: false },
    });
    expect(pending.entries.get().get("lights.front")).toEqual({
      key: "lights.front", clientCmdId: ID, status: "pending", startedAt: 5,
    });
  });

  it("ignores a repeat tap while the key is pending", async () => {
    const { api, send } = setup(async (request) => accepted(request));
    await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    const outcome = await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    expect(outcome).toBe("ignored");
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("other keys stay usable while one is pending", async () => {
    const { api, send } = setup(async (request) => accepted(request));
    await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    await send("lights.rear", { kind: "lights.set", gang: "rear", on: true });
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("on an HTTP error clears pending and shows the inline error", async () => {
    const { pending, inlineErrors, send } = setup(async () => {
      throw new ApiRequestError("hw_unavailable", "hw down", 503);
    });
    await send("lights.front", { kind: "lights.set", gang: "front", on: false });
    expect(pending.isPending("lights.front")).toBe(false);
    expect(inlineErrors.errors.get().get("lights.front")).toBe(MESSAGE_FAILED);
  });
});
