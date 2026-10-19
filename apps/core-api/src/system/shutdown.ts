import { spawnDetached, type Spawn } from "./restart.ts";

// D-32 "Power off" (S1 header). SHUTDOWN_COMMAND is configuration (the Pi touches a request file that
// eduscope-shutdown.path turns into `systemctl poweroff`): split on spaces, run without a shell,
// detached. Nothing from a request ever reaches it. Unset (dev): only reported, nothing powers off.

export function createShutdown(options: {
  command: string | undefined;
  onUnset: () => void;
  onError: (error: Error) => void;
  spawn?: Spawn;
}): () => void {
  const [file, ...args] = options.command?.trim().split(/\s+/) ?? [];
  if (file === undefined || file === "") return options.onUnset;
  const run = options.spawn ?? spawnDetached;
  return () => run(file, args, options.onError);
}
