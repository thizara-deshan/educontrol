import { spawnDetached, type Spawn } from "./restart.ts";

// D-32/D-35 S1 power menu: Shut down (SHUTDOWN_COMMAND) and Restart (REBOOT_COMMAND). Both are
// configuration (the Pi touches a request file that a path unit turns into `systemctl poweroff` /
// `systemctl reboot`): split on spaces, run without a shell, detached. Nothing from a request ever
// reaches them. Unset (dev): only reported, the Pi stays up.

export function createPowerCommand(options: {
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
