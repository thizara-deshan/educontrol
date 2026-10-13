import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { ApiClient } from "@/data/api-client";
import { useApiClient } from "@/data/api-context";
import { useSession } from "@/data/hooks";
import { aboutQuery, devicesQuery, irDevicesQuery, networkQuery, scheduleQuery } from "./queries";

/** Settings queries run only for a technician session (milestone note; core-api enforces it). */
export function useIsTechnician(): boolean {
  return useSession()?.access === "technician";
}

export const useIrDevices = () => useQuery(irDevicesQuery(useApiClient(), useIsTechnician()));
export const useSchedule = () => useQuery(scheduleQuery(useApiClient(), useIsTechnician()));
export const useDeviceRegistry = () => useQuery(devicesQuery(useApiClient(), useIsTechnician()));
export const useNetworkInfo = () => useQuery(networkQuery(useApiClient(), useIsTechnician()));
export const useAboutInfo = () => useQuery(aboutQuery(useApiClient(), useIsTechnician()));

/**
 * A settings change (CLAUDE.md: never optimistic). `isPending` stays true until the server
 * answered AND the listed queries have refetched, so the control shows its pending overlay
 * until the new server value is on screen. The server's `invalidate` push does the same for
 * every other client.
 */
export function useServerMutation<TArgs, TResult>(run: (api: ApiClient, args: TArgs) => Promise<TResult>, keys: readonly QueryKey[]) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TArgs>({
    mutationFn: (args) => run(api, args),
    onSettled: () => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
