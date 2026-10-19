import { describe, expect, it, vi } from "vitest";
import { createPowerCommand } from "../../src/system/power.ts";

describe("power commands (D-32, D-35)", () => {
  it("runs the command as argv, without a shell", () => {
    const spawn = vi.fn();
    const onUnset = vi.fn();
    createPowerCommand({ command: " /usr/bin/touch  /var/lib/eduscope/shutdown.request", onUnset, onError: vi.fn(), spawn })();
    expect(spawn).toHaveBeenCalledWith("/usr/bin/touch", ["/var/lib/eduscope/shutdown.request"], expect.any(Function));
    expect(onUnset).not.toHaveBeenCalled();
  });

  it("only reports when no command is configured", () => {
    const onUnset = vi.fn();
    createPowerCommand({ command: undefined, onUnset, onError: vi.fn() })();
    expect(onUnset).toHaveBeenCalledOnce();
  });
});
