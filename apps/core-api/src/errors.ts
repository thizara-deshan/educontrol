import type { ApiErrorCode } from "@eduscope/contracts";

/** Any failure a route answers with an ApiError body (`{code, message}`). */
export class ApiFailure extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiFailure";
    this.status = status;
    this.code = code;
  }
}
