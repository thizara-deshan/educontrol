import type { QueryClient } from "@tanstack/react-query";
import { sessionQuery, stateQuery } from "@/data/queries";
import { STATE_ROOT_KEY } from "@/data/query-keys";
import type { ApiClient } from "@/data/api-client";
import type { CachePort } from "./apply-event";

/** CachePort over TanStack Query. The typed query options carry the data type, no casts. */
export function createCachePort(queryClient: QueryClient, api: ApiClient): CachePort {
  const sessionKey = sessionQuery(api).queryKey;
  return {
    getState: () => queryClient.getQueryData(stateQuery.queryKey),
    setState: (state) => {
      queryClient.setQueryData(stateQuery.queryKey, state);
    },
    getSession: () => queryClient.getQueryData(sessionKey),
    setSession: (session) => {
      queryClient.setQueryData(sessionKey, session);
    },
    invalidateAllExceptState() {
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== STATE_ROOT_KEY });
    },
    invalidate(keys) {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  };
}
