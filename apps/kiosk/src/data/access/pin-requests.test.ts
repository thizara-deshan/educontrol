import { describe, expect, it } from "vitest";
import { createPinRequests } from "./pin-requests";

describe("pin requests", () => {
  it("opens one request and resolves true on success", async () => {
    const requests = createPinRequests();
    const granted = requests.request("control");
    expect(requests.current.get()).toEqual({ id: 1, level: "control" });
    requests.finish(true);
    expect(requests.current.get()).toBeNull();
    await expect(granted).resolves.toBe(true);
  });

  it("resolves false on cancel", async () => {
    const requests = createPinRequests();
    const granted = requests.request("technician");
    requests.finish(false);
    await expect(granted).resolves.toBe(false);
  });

  it("joins an open request for the same level", async () => {
    const requests = createPinRequests();
    const first = requests.request("control");
    const second = requests.request("control");
    expect(second).toBe(first);
    expect(requests.current.get()?.id).toBe(1);
    requests.finish(true);
    await expect(second).resolves.toBe(true);
  });

  it("a different level replaces the open request, which resolves false", async () => {
    const requests = createPinRequests();
    const room = requests.request("control");
    const technician = requests.request("technician");
    await expect(room).resolves.toBe(false);
    expect(requests.current.get()).toEqual({ id: 2, level: "technician" });
    requests.finish(true);
    await expect(technician).resolves.toBe(true);
  });

  it("finish without an open request does nothing", () => {
    const requests = createPinRequests();
    expect(() => requests.finish(true)).not.toThrow();
    expect(requests.current.get()).toBeNull();
  });
});
