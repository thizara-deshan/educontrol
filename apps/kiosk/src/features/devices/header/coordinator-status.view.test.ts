import { describe, expect, it } from "vitest";
import { coordinatorStatusView } from "./coordinator-status.view";

describe("coordinatorStatusView (S2.E3)", () => {
  it.each([
    ["online", { tone: "confirmed", text: "Coordinator online" }],
    ["starting", { tone: "warning", text: "Coordinator starting…" }],
    ["offline", { tone: "offline", text: "Coordinator offline" }],
    [undefined, { tone: "unknown", text: "Connecting…" }],
  ] as const)("%s", (status, expected) => {
    expect(coordinatorStatusView(status)).toEqual(expected);
  });
});
