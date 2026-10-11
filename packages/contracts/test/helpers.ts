/** Fixed server time used by every contract test (screenshot clock: Mon 5 Oct, 10:42). */
export const AT = "2026-10-05T10:42:00Z";

/** A complete Observed<T> wire object; override any field to build a bad sample. */
export function obs(value: unknown, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    value,
    confidence: "confirmed",
    source: "switch",
    updated_at: AT,
    stale: false,
    changed_by: null,
    ...overrides,
  };
}
