import { z } from "zod";

export const ApiErrorCode = z.enum([
  "unauthorized", "forbidden", "validation", "precondition", "hw_unavailable", "not_found",
]);
export const ApiError = z.object({ code: ApiErrorCode, message: z.string() });

export type ApiErrorCode = z.infer<typeof ApiErrorCode>;
export type ApiError = z.infer<typeof ApiError>;
