import { ApiError } from "./api-error";

/** The body-text utility that avoids the `text-body` color/size collision. */
export const BODY_TEXT_CLASS_NAME =
  "text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] text-(color:--color-body)";

/**
 * The body-text message shown under a failed request, in the one shape this
 * screen uses everywhere: `"<prefix> (<code>). Try again."`.
 */
export function describeApiError(error: unknown, prefix: string): string {
  const code = error instanceof ApiError ? error.code : "ERR_UNKNOWN";
  return `${prefix} (${code}). Try again.`;
}
