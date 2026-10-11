import type { ClientSession, RoomState } from "@eduscope/contracts";
import { queryOptions, skipToken } from "@tanstack/react-query";
import type { ApiClient } from "./api-client";
import { queryKeys } from "./query-keys";

/**
 * `["state"]` is written ONLY by apply-event from WS frames (snapshot first). It is never
 * fetched by the UI (skipToken), never refetched and never garbage-collected.
 */
export const stateQuery = queryOptions<RoomState>({
  queryKey: queryKeys.state(),
  queryFn: skipToken,
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
});

/** `["session"]`: fetched once, then replaced by `session` events and refetched after a snapshot. */
export const sessionQuery = (api: ApiClient) =>
  queryOptions<ClientSession>({
    queryKey: queryKeys.session(),
    queryFn: () => api.getSession(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
