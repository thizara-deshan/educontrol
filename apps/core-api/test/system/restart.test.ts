import { describe, expect, it, vi } from "vitest";
import { createRestart } from "../../src/system/restart.ts";

describe("restart controller (S3e)", () => {
  it("runs RESTART_COMMAND as argv, without a shell", () => {
    const spawn = vi.fn();
    const exit = vi.fn();
    createRestart({ command: " sudo  systemctl restart eduscope.target", exit, onError: vi.fn(), spawn })();
    expect(spawn).toHaveBeenCalledWith("sudo", ["systemctl", "restart", "eduscope.target"], expect.any(Function));
    expect(exit).not.toHaveBeenCalled();
  });

  it("exits when no command is configured", () => {
    const exit = vi.fn();
    createRestart({ command: undefined, exit, onError: vi.fn() })();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("reports a command that cannot start instead of crashing", async () => {
    const onError = vi.fn();
    createRestart({ command: "/nonexistent/eduscope-restart", exit: vi.fn(), onError })();
    await expect.poll(() => onError.mock.calls.length).toBe(1);
  });
});
