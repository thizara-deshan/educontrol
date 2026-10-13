import type { ChangedBy, Confidence, Observed, Source } from "@eduscope/contracts";

// Small helpers every rule module uses to build Observed<T> values (SPEC §6 Observed).

/** Never reported (H11): value null, confidence unknown. */
export function unknown<T>(source: Source): Observed<T> {
  return { value: null, confidence: "unknown", source, updated_at: null, stale: false, changed_by: null };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * A fresh hardware report. `changed_by` survives only when the value did not change; who changed a
 * value is decided afterwards by attribution (H13).
 */
export function reported<T>(prev: Observed<T>, value: T | null, at: string, confidence: Confidence = "confirmed"): Observed<T> {
  return {
    value,
    confidence: value === null ? "unknown" : confidence,
    source: prev.source,
    updated_at: at,
    stale: false,
    changed_by: same(prev.value, value) ? prev.changed_by : null,
  };
}

/** A value core-api set itself (IR: assumed, R3), attributed to whoever caused it. */
export function assumed<T>(value: T, at: string, by: ChangedBy | null): Observed<T> {
  return { value, confidence: "assumed", source: "ir", updated_at: at, stale: false, changed_by: by };
}

export function withChangedBy<T>(observed: Observed<T>, by: ChangedBy | null): Observed<T> {
  return { ...observed, changed_by: by };
}

export function withStale<T>(observed: Observed<T>, stale: boolean): Observed<T> {
  return observed.stale === stale ? observed : { ...observed, stale };
}

export function sameValue(a: unknown, b: unknown): boolean {
  return same(a, b);
}
