import type { ClientSession } from "@eduscope/contracts";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/data/query-keys";
import { stubApi } from "@/data/test/api-stub";
import { roomState } from "@/data/test/room-state";
import { createCachePort } from "./cache-port";

const api = stubApi();
const session: ClientSession = {
  public_id: "me", client_type: "remote", label: "laptop", access: "control",
  unlocked_at: null, last_activity: null, expires_at: null,
};

describe("cache port", () => {
  it("round-trips state and session through the query cache", () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    expect(port.getState()).toBeUndefined();
    const state = roomState();
    port.setState(state);
    port.setSession(session);
    expect(port.getState()).toBe(state);
    expect(queryClient.getQueryData(queryKeys.state())).toBe(state);
    expect(port.getSession()).toBe(session);
  });

  it("invalidateAllExceptState leaves ['state'] valid", async () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    port.setState(roomState());
    queryClient.setQueryData(queryKeys.devices(), []);
    port.invalidateAllExceptState();
    expect(queryClient.getQueryState(queryKeys.state())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.devices())?.isInvalidated).toBe(true);
  });

  it("invalidate marks only the given keys", () => {
    const queryClient = new QueryClient();
    const port = createCachePort(queryClient, api);
    queryClient.setQueryData(queryKeys.irDevices(), []);
    queryClient.setQueryData(queryKeys.schedule(), {});
    port.invalidate([["ir", "devices"]]);
    expect(queryClient.getQueryState(queryKeys.irDevices())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.schedule())?.isInvalidated).toBe(false);
  });
});
