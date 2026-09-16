import { ApiError } from "./api";

/**
 * The `text-body`/`--color-body` collision `tokens.md` documents: a bare
 * `text-body` utility always resolves to the color, so the size, its line
 * height and its tracking are each read from the CSS variable directly, and
 * the color is read the same way rather than through the `text-body` class.
 */
export const BODY_TEXT_CLASS_NAME =
  "text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] text-(color:--color-body)";

/**
 * Formats milliseconds remaining as `m:ss`, e.g. `0:21`.
 *
 * @remarks
 * Rounds up rather than down: a whole second is shown for as long as any part
 * of it remains, so the figure reaches `0:00` only once `remainingMs` is
 * actually zero, matching the countdown recipe's "at zero the figure reads
 * `0:00`".
 */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString()}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * The body-text message shown under a failed request, in the one shape this
 * screen uses everywhere: `"<prefix> (<code>). Try again."`.
 *
 * @remarks
 * Only an {@link ApiError} carries a stable `code`; anything else (a network
 * failure, an unexpected throw) falls back to `ERR_UNKNOWN` rather than
 * inlining the caught value's own message, which could be arbitrary text.
 */
export function describeApiError(error: unknown, prefix: string): string {
  const code = error instanceof ApiError ? error.code : "ERR_UNKNOWN";
  return `${prefix} (${code}). Try again.`;
}
