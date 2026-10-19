import { spawn } from "node:child_process";

// S3e "Restart controller". RESTART_COMMAND is configuration (M10 sets
// `sudo systemctl restart eduscope.target`): split on spaces, run without a shell, detached so it
// outlives core-api. Nothing from a request ever reaches it. Unset: core-api exits.

export type Spawn = (file: string, args: readonly string[], onError: (error: Error) => void) => void;

export const spawnDetached: Spawn = (file, args, onError) => {
  const child = spawn(file, [...args], { detached: true, stdio: "ignore" });
  child.on("error", onError);
  child.unref();
};

export function createRestart(options: {
  command: string | undefined;
  exit: () => void;
  onError: (error: Error) => void;
  spawn?: Spawn;
}): () => void {
  const [file, ...args] = options.command?.trim().split(/\s+/) ?? [];
  if (file === undefined || file === "") return options.exit;
  const run = options.spawn ?? spawnDetached;
  return () => run(file, args, options.onError);
}
