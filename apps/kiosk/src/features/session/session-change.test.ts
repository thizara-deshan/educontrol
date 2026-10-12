import { describe, expect, it } from "vitest";
import { sessionChangeEffects, type SessionChange, type SessionChangeEffects } from "./session-change";

describe("sessionChangeEffects", () => {
  it.each<[SessionChange, SessionChangeEffects]>([
    // first session, no change, upgrades: nothing
    [{ prev: undefined, next: "view", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    [{ prev: "control", next: "control", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    [{ prev: "view", next: "control", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    [{ prev: "control", next: "technician", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: false }],
    // remote expiry (H24)
    [{ prev: "control", next: "view", clientType: "remote", ownLock: false }, { toast: true, leaveSettings: false }],
    [{ prev: "technician", next: "view", clientType: "remote", ownLock: false }, { toast: true, leaveSettings: true }],
    // own Lock: no toast, still leaves settings
    [{ prev: "control", next: "view", clientType: "remote", ownLock: true }, { toast: false, leaveSettings: false }],
    [{ prev: "technician", next: "view", clientType: "remote", ownLock: true }, { toast: false, leaveSettings: true }],
    // technician → control (kiosk drop, or remote technician expiry that keeps control)
    [{ prev: "technician", next: "control", clientType: "kiosk", ownLock: false }, { toast: false, leaveSettings: true }],
    [{ prev: "technician", next: "control", clientType: "remote", ownLock: false }, { toast: false, leaveSettings: true }],
  ])("%o → %o", (change, expected) => {
    expect(sessionChangeEffects(change)).toEqual(expected);
  });
});
