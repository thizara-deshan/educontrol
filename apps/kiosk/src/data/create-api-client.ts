import type { ApiClient } from "./api-client";
import { createHttpApiClient, sameOriginWsUrl } from "./adapters/http/http-client";
import { createMockApiClient } from "./adapters/mock/mock-client";
import type { ApiMode } from "./env";

/** The only place that knows which adapter is active (ARCHITECTURE §4.4). */
export function createApiClient(mode: ApiMode): ApiClient {
  return mode === "mock" ? createMockApiClient() : createHttpApiClient({ wsUrl: sameOriginWsUrl(window.location) });
}
