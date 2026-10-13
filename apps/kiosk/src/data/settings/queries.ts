import type { AboutInfo, Device, IrDevice, NetworkInfo, Schedule } from "@eduscope/contracts";
import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/data/api-client";
import { queryKeys } from "@/data/query-keys";

// S3–S3e data (ARCHITECTURE §4.4). Technician-only on the server, so nothing is fetched until the
// session is `technician` (M08 would answer 403). Changes arrive as `invalidate` pushes; no
// polling, no refetch on focus.

const common = { staleTime: Infinity, refetchOnWindowFocus: false } as const;

export const irDevicesQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<IrDevice[]>({ ...common, queryKey: queryKeys.irDevices(), queryFn: () => api.ir.listDevices(), enabled });

export const scheduleQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<Schedule>({ ...common, queryKey: queryKeys.schedule(), queryFn: () => api.schedule.get(), enabled });

export const devicesQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<Device[]>({ ...common, queryKey: queryKeys.devices(), queryFn: () => api.devices.list(), enabled });

export const networkQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<NetworkInfo>({ ...common, queryKey: queryKeys.systemNetwork(), queryFn: () => api.system.network(), enabled });

/** S3e uptime: refetched each time About opens. */
export const aboutQuery = (api: ApiClient, enabled: boolean) =>
  queryOptions<AboutInfo>({ ...common, staleTime: 0, queryKey: queryKeys.systemAbout(), queryFn: () => api.system.about(), enabled });
