/** A sheet's form checked against its contract: the request body, or one message per field. */
export type FormResult<T, F extends string> = { ok: true; value: T } | { ok: false; errors: Partial<Record<F, string>> };
