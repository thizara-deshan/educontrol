import { createContext, useContext, type ReactNode } from "react";
import type { ApiClient } from "./api-client";
import type { RealtimeRuntime } from "./realtime/runtime";

interface DataContextValue {
  api: ApiClient;
  realtime: RealtimeRuntime;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ value, children }: { value: DataContextValue; children: ReactNode }) {
  return <DataContext value={value}>{children}</DataContext>;
}

function useDataContext(): DataContextValue {
  const value = useContext(DataContext);
  if (value === null) throw new Error("DataProvider is missing");
  return value;
}

export const useApiClient = (): ApiClient => useDataContext().api;
export const useRealtime = (): RealtimeRuntime => useDataContext().realtime;
