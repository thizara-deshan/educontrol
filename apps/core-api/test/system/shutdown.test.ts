import { describe, expect, it, vi } from "vitest";
import { createShutdown } from "../../src/system/shutdown.ts";

describe("power off (D-32)", () => {
  it("runs SHUTDOWN_COMMAND as argv, without a shell", () => {
    const spawn = vi.fn();
    const onUnset = vi.fn();
    createShutdown({ command: " /usr/bin/touch  /var/lib/eduscope/shutdown.request", onUnset, onError: vi.fn(), spawn })();
    expect(spawn).toHaveBeenCalledWith("/usr/bin/touch", ["/var/lib/eduscope/shutdown.request"], expect.any(Function));
    expect(onUnset).not.toHaveBeenCalled();
  });

  it("only reports when no command is configured", () => {
    const onUnset = vi.fn();
    createShutdown({ command: undefined, onUnset, onError: vi.fn() })();
    expect(onUnset).toHaveBeenCalledOnce();
  });
});
