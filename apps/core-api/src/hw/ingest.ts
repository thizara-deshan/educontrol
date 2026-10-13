import type { ChangedBy, HwEvent, ServerEvent } from "@eduscope/contracts";
import type { Claim, Dispatcher } from "../commands/dispatcher.ts";
import type { EventLogger } from "../db/event-log.ts";
import { attributionFor } from "../domain/attribution.ts";
import { applyHwDown, applyHwEvent, reportedKeys, setChangedBy, valueChanged } from "../domain/hw-events.ts";
import type { KwhBaseline } from "../domain/model.ts";
import type { StateStore } from "../domain/state-store.ts";

// ARCHITECTURE §6.3: each HwEvent → one store update running the domain rules, then attribution
// (H13/R6): a report that proves an in-flight command confirms it; an uncommanded light change is "by hand".

export interface Ingest {
  handle(event: HwEvent): void;
  /** The stream dropped (§6.7). */
  down(): void;
}

const BY_HAND_TEXT: Record<string, (on: boolean) => string> = {
  "lights.front": (on) => `Front of room turned ${on ? "on" : "off"}`,
  "lights.rear": (on) => `Rear of room turned ${on ? "on" : "off"}`,
};

export function createIngest(deps: {
  store: StateStore;
  dispatcher: Dispatcher;
  emit: (event: ServerEvent) => void;
  log: EventLogger;
  persistBaseline: (baseline: KwhBaseline) => void;
  /** Called with the grace delay when the link drops, so the offline step lands on time. */
  scheduleTick: (delayMs: number) => void;
  hwDownGraceMs: number;
}): Ingest {
  const { store, dispatcher } = deps;

  return {
    handle(event) {
      if (event.type === "heartbeat") return;
      if (event.type === "hw.error") {
        deps.log({ type: "hw", subject: event.data.module, result: event.data.code, payload: event.data });
        return;
      }
      const wasDown = store.get().connection.hw === "down";
      const baselineBefore = store.model().facts.kwh_baseline;
      const claims: Claim[] = [];
      const byHand: { key: string; on: boolean }[] = [];

      store.update((model) => {
        const next = applyHwEvent(model, event);
        let state = next.state;
        for (const key of reportedKeys(event)) {
          const claim = dispatcher.claim(key, state);
          if (claim !== null) claims.push(claim);
          const changed = valueChanged(model.state, state, key);
          // A snapshot after a drop is a resync, not a wall-plate press: only a claim attributes it.
          const by: ChangedBy | null | undefined =
            event.type === "snapshot" ? (claim?.by ?? undefined) : attributionFor(key, changed, claim?.by ?? null);
          if (by !== undefined) state = setChangedBy(state, key, by);
          if (by === "by hand" && key in BY_HAND_TEXT) {
            const gang = key === "lights.front" ? "front" : "rear";
            byHand.push({ key, on: state.environment.lights[gang].value === true });
          }
        }
        return { ...next, state };
      });

      const baseline = store.model().facts.kwh_baseline;
      if (baseline !== null && JSON.stringify(baseline) !== JSON.stringify(baselineBefore)) deps.persistBaseline(baseline);
      if (event.type === "snapshot" && wasDown) deps.log({ type: "hw", subject: "link", result: "up" });

      if (claims.length === 0 && byHand.length === 0) return;
      store.flush(); // the new value reaches clients before the pending overlay clears
      for (const claim of claims) dispatcher.confirm(claim);
      for (const change of byHand) {
        const text = BY_HAND_TEXT[change.key]?.(change.on);
        if (text === undefined) continue;
        deps.emit({ type: "activity", text, by: "by hand", public_id: null });
        deps.log({ type: "state", actor: "by hand", subject: change.key, payload: { on: change.on } });
      }
    },
    down() {
      if (store.get().connection.hw === "up") {
        store.update((model, at) => applyHwDown(model, at));
        deps.log({ type: "hw", subject: "link", result: "down" });
      }
      deps.scheduleTick(deps.hwDownGraceMs);
    },
  };
}
