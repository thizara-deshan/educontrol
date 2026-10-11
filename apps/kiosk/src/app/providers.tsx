import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DataProvider } from "@/data/api-context";
import { createApiClient } from "@/data/create-api-client";
import { kioskEnv } from "@/data/env";
import { createQueryClient } from "@/data/query-client";
import { createRealtimeRuntime } from "@/data/realtime/runtime";
import { getClientLabel } from "@/lib/client-label";

/** One ApiClient, QueryClient and realtime runtime per page; the WS starts on mount. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [value] = useState(() => {
    const api = createApiClient(kioskEnv.VITE_API_MODE);
    const queryClient = createQueryClient();
    const realtime = createRealtimeRuntime({ api, queryClient, label: getClientLabel(), toast: (text) => toast(text) });
    return { api, queryClient, realtime };
  });

  useEffect(() => {
    value.realtime.start();
    return () => value.realtime.stop();
  }, [value]);

  return (
    <QueryClientProvider client={value.queryClient}>
      <DataProvider value={value}>{children}</DataProvider>
    </QueryClientProvider>
  );
}
