import { HwEvent } from "@eduscope/contracts";
import { createParser } from "eventsource-parser";

// ARCHITECTURE §6.3: GET /v1/events (SSE). First event is always a snapshot. Every event is zod-parsed
// (invalid → reported + dropped). Drop ⇒ onDown, backoff 0.5 → 5 s, retry; no frame for 15 s ⇒ dead.

/** Turns SSE text chunks into parsed HwEvents. */
export function createHwEventDecoder(onEvent: (event: HwEvent) => void, onInvalid: (reason: string) => void): (chunk: string) => void {
  const parser = createParser({
    onEvent(message) {
      let raw: unknown;
      try {
        raw = JSON.parse(message.data);
      } catch {
        onInvalid(`non-JSON ${message.event ?? "message"} event`);
        return;
      }
      const parsed = HwEvent.safeParse(raw);
      if (parsed.success) onEvent(parsed.data);
      else onInvalid(`invalid ${message.event ?? "message"} event: ${parsed.error.issues[0]?.message ?? "?"}`);
    },
  });
  return (chunk) => parser.feed(chunk);
}

export interface HwStreamOptions {
  url: string;
  onEvent(event: HwEvent): void;
  /** The stream dropped or could not connect (called once per drop). */
  onDown(): void;
  onInvalid(reason: string): void;
  deadMs: number;
  fetch?: typeof fetch;
  backoffMs?: readonly number[];
}

export const BACKOFF_MS = [500, 1000, 2000, 4000, 5000] as const;

export interface HwStream {
  stop(): void;
}

export function startHwStream(options: HwStreamOptions): HwStream {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const backoff = options.backoffMs ?? BACKOFF_MS;
  let stopped = false;
  let attempt = 0;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  async function connectOnce(): Promise<void> {
    controller = new AbortController();
    const abort = controller;
    let deadTimer: ReturnType<typeof setTimeout> | null = null;
    const alive = (): void => {
      if (deadTimer !== null) clearTimeout(deadTimer);
      deadTimer = setTimeout(() => abort.abort(), options.deadMs);
    };
    try {
      alive();
      const response = await doFetch(options.url, { headers: { accept: "text/event-stream" }, signal: abort.signal });
      if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status}`);
      const feed = createHwEventDecoder((event) => {
        if (event.type === "snapshot") attempt = 0; // a good connection resets the backoff
        options.onEvent(event);
      }, options.onInvalid);
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        alive();
        feed(decoder.decode(chunk, { stream: true }));
      }
    } catch {
      // connection refused, aborted (dead) or broken: handled below
    } finally {
      if (deadTimer !== null) clearTimeout(deadTimer);
    }
  }

  async function loop(): Promise<void> {
    while (!stopped) {
      await connectOnce();
      if (stopped) return;
      options.onDown();
      const delay = backoff[Math.min(attempt, backoff.length - 1)] ?? 5000;
      attempt += 1;
      await new Promise<void>((resolve) => {
        retryTimer = setTimeout(resolve, delay);
      });
    }
  }

  void loop();
  return {
    stop() {
      stopped = true;
      controller?.abort();
      if (retryTimer !== null) clearTimeout(retryTimer);
    },
  };
}
