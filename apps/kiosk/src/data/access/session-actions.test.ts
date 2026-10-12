import type { ClientSession, LoginResult } from "@eduscope/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/data/api-client";
import { createStore } from "@/lib/store";
import { consumeLocalLock, DEFAULT_LOCKOUT_S, lock, login, type SessionActionDeps } from "./session-actions";

const session = (access: ClientSession["access"]): ClientSession => ({
  public_id: "me", client_type: "remote", label: "phone", access,
  unlocked_at: null, last_activity: null, expires_at: null,
});

function deps(overrides: Partial<SessionActionDeps["api"]> = {}) {
  const value = {
    api: {
      login: vi.fn(async (): Promise<LoginResult> => session("control")),
      lock: vi.fn(async () => session("view")),
      ...overrides,
    },
    setSession: vi.fn(),
    localLock: createStore(false),
  };
  return value;
}

describe("login", () => {
  it("ok: stores the returned session", async () => {
    const d = deps();
    await expect(login(d, "control", "1234", "phone")).resolves.toEqual({ kind: "ok", session: session("control") });
    expect(d.api.login).toHaveBeenCalledWith({ level: "control", pin: "1234", label: "phone" });
    expect(d.setSession).toHaveBeenCalledWith(session("control"));
  });

  it("wrong: passes attempts_left through and stores nothing", async () => {
    const d = deps({ login: vi.fn(async (): Promise<LoginResult> => ({ reason: "wrong", retry_after_s: null, attempts_left: 3 })) });
    await expect(login(d, "control", "0000", "phone")).resolves.toEqual({ kind: "wrong", attemptsLeft: 3 });
    expect(d.setSession).not.toHaveBeenCalled();
  });

  it("locked: uses retry_after_s, or 60 s when missing", async () => {
    const d = deps({ login: vi.fn(async (): Promise<LoginResult> => ({ reason: "locked", retry_after_s: 42, attempts_left: 0 })) });
    await expect(login(d, "control", "0000", "phone")).resolves.toEqual({ kind: "locked", retryAfterS: 42 });
    const e = deps({ login: vi.fn(async (): Promise<LoginResult> => ({ reason: "locked", retry_after_s: null, attempts_left: null })) });
    await expect(login(e, "control", "0000", "phone")).resolves.toEqual({ kind: "locked", retryAfterS: DEFAULT_LOCKOUT_S });
  });

  it("error: a thrown request becomes { kind: error }", async () => {
    const d = deps({ login: vi.fn(async (): Promise<LoginResult> => { throw new ApiRequestError("network", "down", null); }) });
    await expect(login(d, "technician", "123456", "phone")).resolves.toEqual({ kind: "error" });
  });
});

describe("lock", () => {
  it("stores the downgraded session and leaves the local-lock flag set", async () => {
    const d = deps();
    await expect(lock(d)).resolves.toBe(true);
    expect(d.setSession).toHaveBeenCalledWith(session("view"));
    expect(d.localLock.get()).toBe(true);
  });

  it("clears the flag when the lock fails", async () => {
    const d = deps({ lock: vi.fn(async () => { throw new ApiRequestError("network", "down", null); }) });
    await expect(lock(d)).resolves.toBe(false);
    expect(d.localLock.get()).toBe(false);
  });

  it("consumeLocalLock returns true once", () => {
    const flag = createStore(true);
    expect(consumeLocalLock(flag)).toBe(true);
    expect(consumeLocalLock(flag)).toBe(false);
  });
});
