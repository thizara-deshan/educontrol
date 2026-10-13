import type { PinError } from "@eduscope/contracts";
import type { Clock } from "../clock.ts";

// ARCHITECTURE §5 throttle (in memory, D-08): per (ip, level) 5 wrong ⇒ locked 60 s (H17);
// more than 20 failures in a minute across all IPs ⇒ PIN entry locked for everyone for 60 s.

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 60_000;
export const GLOBAL_MAX_FAILURES = 20;
export const GLOBAL_WINDOW_MS = 60_000;

export interface PinThrottle {
  /** A PinError `locked` while entry is blocked for this (ip, level), else null. */
  check(ip: string, level: string): PinError | null;
  /** Records a wrong PIN; the 5th in a row answers `locked`. */
  fail(ip: string, level: string): PinError;
  succeed(ip: string, level: string): void;
}

export function createPinThrottle(clock: Clock): PinThrottle {
  const failures = new Map<string, number>();
  const lockedUntil = new Map<string, number>();
  let recent: number[] = [];
  let globalLockedUntil = 0;
  const key = (ip: string, level: string): string => `${level}|${ip}`;
  const locked = (until: number, now: number): PinError => ({
    reason: "locked", retry_after_s: Math.max(1, Math.ceil((until - now) / 1000)), attempts_left: 0,
  });

  return {
    check(ip, level) {
      const now = clock.now().getTime();
      if (now < globalLockedUntil) return locked(globalLockedUntil, now);
      const until = lockedUntil.get(key(ip, level)) ?? 0;
      return now < until ? locked(until, now) : null;
    },
    fail(ip, level) {
      const now = clock.now().getTime();
      recent = [...recent.filter((at) => now - at < GLOBAL_WINDOW_MS), now];
      if (recent.length > GLOBAL_MAX_FAILURES) globalLockedUntil = now + LOCKOUT_MS;
      const k = key(ip, level);
      const count = (failures.get(k) ?? 0) + 1;
      if (count >= MAX_ATTEMPTS) {
        failures.delete(k);
        lockedUntil.set(k, now + LOCKOUT_MS);
        return locked(now + LOCKOUT_MS, now);
      }
      failures.set(k, count);
      if (now < globalLockedUntil) return locked(globalLockedUntil, now);
      return { reason: "wrong", retry_after_s: null, attempts_left: MAX_ATTEMPTS - count };
    },
    succeed(ip, level) {
      failures.delete(key(ip, level));
    },
  };
}
