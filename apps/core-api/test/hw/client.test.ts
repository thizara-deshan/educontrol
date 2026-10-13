import { describe, expect, it, vi } from "vitest";
import { createHwClient } from "../../src/hw/client.ts";
import { must } from "../helpers.ts";

const TIMEOUTS = { zigbeeMs: 5000, irSendMs: 3000, hdmiMs: 5000, mixerMs: 2000, screenMs: 5000 };

describe("hw client", () => {
  it("POSTs JSON to the §3.4 path and returns the parsed ack", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ ok: true }));
    const hw = createHwClient({ baseUrl: "http://127.0.0.1:8081", timeouts: TIMEOUTS, fetch });
    expect(await hw.lightsSet({ gang: "rear", on: true })).toEqual({ ok: true });
    const [url, init] = must(fetch.mock.calls[0]);
    expect(url).toBe("http://127.0.0.1:8081/v1/lights/set");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"gang":"rear","on":true}');
  });

  it("passes a hw error ack through", async () => {
    const ack = { ok: false, error: { code: "device_offline", message: "r101_ir is offline" } };
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch: vi.fn(async () => Response.json(ack)) });
    expect(await hw.irSend({ transport: "ir_zs06", code_format: "tuya", code: "x" })).toEqual(ack);
  });

  it.each([
    ["unreachable", async () => Promise.reject(new TypeError("fetch failed")), "transport"],
    ["timeout", async () => Promise.reject(new DOMException("timed out", "TimeoutError")), "timeout"],
    ["bad answer", async () => Response.json({ nope: 1 }, { status: 500 }), "transport"],
  ] as const)("%s → ok:false %s", async (_name, impl, code) => {
    const hw = createHwClient({ baseUrl: "", timeouts: TIMEOUTS, fetch: vi.fn(impl) });
    expect(await hw.audioLevel({ channel: "mic", level: 10 })).toMatchObject({ ok: false, error: { code } });
  });
});
