/**
 * The longest single sleep the AI SDK's retry chain can take between attempts,
 * in milliseconds.
 *
 * @remarks
 * The SDK's own exponential backoff starts at 2s and doubles, but a provider's
 * `retry-after` header overrides it — and the SDK accepts whatever it names up
 * to (exclusive) one minute. So one minute, not the exponential series, is the
 * longest sleep a chain can actually start, and it is what a total deadline has
 * to budget for per attempt. See `integrating-llm`'s "A backoff sleep that does
 * not consult the signal".
 */
export const RETRY_BACKOFF_CAP_MS = 60_000;

/**
 * The largest delay Node's timers represent without clamping.
 *
 * @remarks
 * `AbortSignal.timeout` throws above the *unsigned* 32-bit range, which is
 * loud. Between the signed ceiling and that, Node clamps silently and the
 * deadline fires within a millisecond instead — a failure that arrives at
 * completely the wrong time with no error anywhere. The signed ceiling is
 * therefore what a total deadline is validated against.
 */
const TIMER_CEILING_MS = 2_147_483_647;

/** How a {@link totalDeadlineMs} budget is derived. */
export interface DeadlineBudget {
  /** The per-attempt bound handed to the SDK, in milliseconds. */
  readonly attemptTimeoutMs: number;

  /** How many times the SDK may retry after the first attempt. */
  readonly maxRetries: number;
}

/**
 * The bound covering a whole `generate` call — every attempt and every sleep
 * between them.
 *
 * @remarks
 * Derived from the caller's own configuration rather than fixed, so someone who
 * raises the per-attempt timeout or the retry count still gets a total bound
 * that fits what they asked for.
 *
 * @throws A `RangeError` when the budget is not a usable timer delay. This is
 * the one place this layer throws rather than answering with a `Result`: it is
 * a construction-time configuration mistake, not a request failure, and a
 * deadline armed outside every `try` would otherwise become the rejected
 * promise `LlmPort` promises never to produce.
 */
export function totalDeadlineMs(budget: DeadlineBudget): number {
  const { attemptTimeoutMs, maxRetries } = budget;

  if (!Number.isInteger(attemptTimeoutMs) || attemptTimeoutMs <= 0) {
    throw new RangeError(
      `attemptTimeoutMs must be a positive integer number of milliseconds, got ${String(attemptTimeoutMs)}.`,
    );
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError(
      `maxRetries must be a non-negative integer, got ${String(maxRetries)}.`,
    );
  }

  const total = (attemptTimeoutMs + RETRY_BACKOFF_CAP_MS) * (maxRetries + 1);
  if (total > TIMER_CEILING_MS) {
    throw new RangeError(
      `The total request deadline (${String(total)}ms) exceeds the ${String(TIMER_CEILING_MS)}ms timer ceiling; lower attemptTimeoutMs or maxRetries.`,
    );
  }

  return total;
}

/**
 * Composes the total deadline into the signal the request is actually made
 * under.
 *
 * @remarks
 * `AbortSignal.any`, never a `Promise.race` against a timer: racing settles the
 * promise the adapter returns while leaving the socket open and the body still
 * arriving, so it bounds the caller's wait and nothing else. Composing instead
 * means firing the deadline cancels the transport, and that an abort landing
 * between two attempts ends the retry chain rather than starting another one.
 *
 * The caller's signal is listed first so its `reason` — not the deadline's — is
 * what the composed signal carries when both are eligible, which is what keeps
 * a caller's own abort reason recognisable by identity on the resulting error.
 */
export function deadlineSignal(
  totalMs: number,
  callerSignal: AbortSignal | undefined,
): AbortSignal {
  const deadline = AbortSignal.timeout(totalMs);
  return AbortSignal.any(
    callerSignal === undefined ? [deadline] : [callerSignal, deadline],
  );
}
