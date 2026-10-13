import { useConnectionStatus } from "@/data/hooks";

/** Settings controls are usable only while connected (H2/H3 disable every control). */
export function useWritable(): boolean {
  const status = useConnectionStatus();
  return status === "live" || status === "back_online";
}
