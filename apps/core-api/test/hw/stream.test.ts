import type { HwEvent } from "@eduscope/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHwEventDecoder, startHwStream } from "../../src/hw/stream.ts";
import { hwEventFixtures, must } from "../helpers.ts";

const sse = (event: HwEvent): string => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

describe("hw SSE decoder", () => {
  it("parses every fixtures/hw event, even when chunks split frames anywhere", () => {
    const fixtures = hwEventFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(15);
    const text = fixtures.map(({ event }) => sse(event)).join("");
    const seen: HwEvent[] = [];
    const feed = createHwEventDecoder((event) => seen.push(event), (reason) => expect.fail(reason));
    for (let i = 0; i < text.length; i += 7) feed(text.slice(i, i + 7));
    expect(seen).toEqual(fixtures.map(({ event }) => event));
  });

  it("drops non-JSON and contract-violating events and reports them", () => {
    const seen: HwEvent[] = [];
    const invalid: string[] = [];
    const feed = createHwEventDecoder((event) => seen.push(event), (reason) => invalid.push(reason));
    feed("event: lights.state\ndata: not json\n\n");
    feed('event: lights.state\ndata: {"type":"lights.state","at":"2026-10-05T10:42:00Z","data":{"gang":"middle","on":true}}\n\n');
    feed('event: heartbeat\ndata: {"type":"heartbeat","at":"2026-10-05T10:42:00Z","data":{}}\n\n');
    expect(seen.map((e) => e.type)).toEqual(["heartbeat"]);
    expect(invalid).toHaveLength(2);
    expect(invalid[0]).toContain("non-JSON");
  });
});

describe("startHwStream", () => {
  afterEach(() => vi.useRealTimers());

  const body = (text: string): ReadableStream<Uint8Array> =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });

  it("delivers events, reports the drop and reconnects with backoff", async () => {
    const snapshot = must(hwEventFixtures().find(({ name }) => name === "event.snapshot.json")).event;
    const fetch = vi.fn(async () => new Response(body(sse(snapshot)), { status: 200 }));
    const events: string[] = [];
    let downs = 0;
    const stream = startHwStream({
      url: "http://hw/v1/events", deadMs: 15_000, fetch, backoffMs: [10],
      onEvent: (event) => events.push(event.type), onDown: () => (downs += 1), onInvalid: () => undefined,
    });
    await vi.waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2));
    stream.stop();
    expect(events.slice(0, 2)).toEqual(["snapshot", "snapshot"]);
    expect(downs).toBeGreaterThanOrEqual(1);
  });

  it("connection refused ⇒ onDown, then retries", async () => {
    const fetch = vi.fn(async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    });
    let downs = 0;
    const stream = startHwStream({
      url: "http://hw/v1/events", deadMs: 15_000, fetch, backoffMs: [5],
      onEvent: () => undefined, onDown: () => (downs += 1), onInvalid: () => undefined,
    });
    await vi.waitFor(() => expect(downs).toBeGreaterThanOrEqual(2));
    stream.stop();
  });

  it("no frame for deadMs ⇒ the stream is treated as dead", async () => {
    // Never sends, never closes; like real fetch, aborting the request errors the body.
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const silent = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(silent, { status: 200 });
    });
    let downs = 0;
    const stream = startHwStream({
      url: "http://hw/v1/events", deadMs: 30, fetch, backoffMs: [60_000],
      onEvent: () => undefined, onDown: () => (downs += 1), onInvalid: () => undefined,
    });
    await vi.waitFor(() => expect(downs).toBe(1));
    stream.stop();
  });
});
