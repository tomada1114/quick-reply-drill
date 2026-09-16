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
