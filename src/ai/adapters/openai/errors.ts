import {
  APICallError,
  LoadAPIKeyError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  RetryError,
  TypeValidationError,
} from "ai";

import { abortedLlmError, asError, LlmError, type LlmErrorCode } from "../../errors";

/**
 * The prose each code reports.
 *
 * @remarks
 * Written here once, and deliberately never derived from the provider's own
 * error text: a provider can quote the prompt, the model's output, or a header
 * straight back in its message, and `LlmError.message` is what reaches a log.
 * The original failure is kept on `cause` instead, by identity, so a log that
 * wants it can still show it.
 */
const MESSAGE_BY_CODE: Readonly<Record<LlmErrorCode, string>> = {
  ERR_LLM_AUTH: "The LLM provider rejected or was given no credential.",
  ERR_LLM_RATE_LIMIT: "The LLM provider rate-limited this request.",
  ERR_LLM_TIMEOUT: "The LLM request was aborted before it completed.",
  ERR_LLM_INVALID_OUTPUT: "The model output did not match the requested schema.",
  ERR_LLM_UNAVAILABLE: "The LLM provider could not be reached or did not answer.",
};

/** Builds the {@link LlmError} for `code`, keeping `cause` by identity. */
export function llmErrorFor(code: LlmErrorCode, cause: unknown): LlmError {
  return new LlmError(code, MESSAGE_BY_CODE[code], {
    cause: asError(cause, MESSAGE_BY_CODE[code]),
  });
}

/**
 * Which code an HTTP status becomes.
 *
 * @remarks
 * The axis is what a caller can do, not the status class. `400`/`422` is
 * `ERR_LLM_INVALID_OUTPUT` because the only request this adapter builds is the
 * caller's own schema and prompt, so a rejected one is re-prompted rather than
 * retried or reconfigured. Anything unrecognised falls to
 * `ERR_LLM_UNAVAILABLE`, whose remedy — try again later — is the safe
 * suggestion for a failure nobody has classified.
 */
function codeForStatus(status: number | undefined): LlmErrorCode {
  switch (status) {
    case 401:
    case 403:
      return "ERR_LLM_AUTH";
    case 429:
      return "ERR_LLM_RATE_LIMIT";
    case 400:
    case 422:
      return "ERR_LLM_INVALID_OUTPUT";
    default:
      return "ERR_LLM_UNAVAILABLE";
  }
}

/**
 * Whether a thrown value is an abort rather than a provider failure.
 *
 * @remarks
 * Matched by `name` because the SDK's own per-attempt bound aborts a controller
 * this adapter never sees, so the composed request signal is *not* aborted when
 * it fires — only the `TimeoutError` it raises says so. `AbortError` is the
 * shape a `fetch` cancelled through a signal rejects with.
 */
function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/**
 * Translates whatever the SDK threw into the port's error vocabulary.
 *
 * @param signal - The signal the request was made under: the caller's own
 * deadline composed with this adapter's total one. It is consulted first
 * because an abort can surface wrapped in a provider error, and every abort is
 * `ERR_LLM_TIMEOUT` whichever deadline fired.
 */
export function toLlmError(error: unknown, signal: AbortSignal): LlmError {
  if (signal.aborted) {
    return abortedLlmError(signal.reason);
  }
  if (isAbort(error)) {
    return abortedLlmError(error);
  }
  // A retry chain reports the failure that ended it; the chain itself is not a
  // category a caller can act on.
  if (RetryError.isInstance(error)) {
    return toLlmError(error.lastError, signal);
  }
  if (LoadAPIKeyError.isInstance(error)) {
    return llmErrorFor("ERR_LLM_AUTH", error);
  }
  if (APICallError.isInstance(error)) {
    return llmErrorFor(codeForStatus(error.statusCode), error);
  }
  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error)
  ) {
    return llmErrorFor("ERR_LLM_INVALID_OUTPUT", error);
  }

  return llmErrorFor("ERR_LLM_UNAVAILABLE", error);
}
