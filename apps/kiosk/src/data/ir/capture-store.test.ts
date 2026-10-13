import { describe, expect, it } from "vitest";
import { createIrCaptureStore, type IrCaptureEvent } from "./capture-store";

const event = (command_id: string, status: IrCaptureEvent["status"], deadline: string | null = null): IrCaptureEvent => ({
  type: "ir_capture", command_id, status, deadline,
});

describe("irCaptureStore (H21)", () => {
  it("keeps the latest status per command", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "listening", "2026-10-13T09:00:20Z"));
    expect(store.entries.get().get("c1")).toEqual({ status: "listening", deadline: "2026-10-13T09:00:20Z" });
    store.apply(event("c1", "captured"));
    expect(store.entries.get().get("c1")).toEqual({ status: "captured", deadline: null });
  });

  it("cancelled removes the entry (the row shows the stored code again)", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "listening", "2026-10-13T09:00:20Z"));
    store.apply(event("c1", "cancelled"));
    expect(store.entries.get().has("c1")).toBe(false);
  });

  it("a new listening replaces every other entry (one blaster)", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "timeout"));
    store.apply(event("c2", "listening", "2026-10-13T09:00:20Z"));
    expect([...store.entries.get().keys()]).toEqual(["c2"]);
  });

  it("dismiss and clear", () => {
    const store = createIrCaptureStore();
    store.apply(event("c1", "captured"));
    store.apply(event("c2", "timeout"));
    store.dismiss("c1");
    expect([...store.entries.get().keys()]).toEqual(["c2"]);
    store.clear();
    expect(store.entries.get().size).toBe(0);
  });
});
