import type { LlmError, LlmErrorCode } from "../ai/index";

/**
 * The failure body every non-2xx answer carries.
 *
 * @remarks
 * `code` is the contract a client branches on; `message` is prose and may be
 * reworded. A message names the shape of what was refused — a field, a limit,
 * the set of accepted values — and never the content that was sent, which
 * would copy a caller's own data into every log that records the answer.
 */
export function failure(
  status: number,
  code: string,
  message: string,
  headers: HeadersInit = {},
): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

// The HTTP status each port failure is reported as. `satisfies` keeps the
// literal keys, so a new `LlmErrorCode` member fails this object to compile
// rather than falling through to a default status. `ERR_LLM_AUTH` is a 500 on
// purpose: the credential that failed is the server's, not the caller's.
const STATUS_BY_LLM_CODE = {
  ERR_LLM_AUTH: 500,
  ERR_LLM_RATE_LIMIT: 429,
  ERR_LLM_TIMEOUT: 504,
  ERR_LLM_INVALID_OUTPUT: 502,
  ERR_LLM_UNAVAILABLE: 503,
} as const satisfies Record<LlmErrorCode, number>;

/**
 * The answer a failed `LlmPort.generate` becomes, for every handler alike.
 *
 * @remarks
 * Shared rather than restated per handler, so two endpoints cannot report one
 * port failure as two different statuses. The prose is fixed: an `LlmError`'s
 * own message may name what the provider said, and a handler is where that
 * would reach a client.
 */
export function llmFailure(error: LlmError): Response {
  return failure(
    STATUS_BY_LLM_CODE[error.code],
    error.code,
    "The language model could not answer this request.",
  );
}

/**
 * Rejects a request that does not identify itself as same-origin.
 *
 * @remarks
 * `Sec-Fetch-Site` is browser-supplied Fetch Metadata: an absent header and
 * every value other than `same-origin` are refused with a fixed `403` response.
 * This is a CSRF-grade guard, not authentication — a caller that can reach the
 * process can set the header by hand — so the loopback bind keeps strangers off
 * the local server and a deployed app needs access control in front of it.
 *
 * @returns `undefined` for a case-insensitive `same-origin` value, or the
 * fixed failure response to return before the request body is read.
 */
export function rejectCrossOrigin(request: Request): Response | undefined {
  return request.headers.get("sec-fetch-site")?.toLowerCase() === "same-origin"
    ? undefined
    : failure(
        403,
        "ERR_FORBIDDEN_ORIGIN",
        "This endpoint answers same-origin browser requests only.",
      );
}
