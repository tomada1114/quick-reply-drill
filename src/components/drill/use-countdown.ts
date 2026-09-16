import { useCallback, useEffect, useRef, useState } from "react";

/** How often the remaining time is recomputed while the timer runs. */
const TICK_MS = 100;

export interface UseCountdownOptions {
  /** How long a run of the countdown lasts, in milliseconds. */
  readonly durationMs: number;

  /** Called exactly once per {@link UseCountdownResult.start} call, at zero. */
  readonly onExpire: () => void;
}

export interface UseCountdownResult {
  /** Time left in the current run, in milliseconds; never negative. */
  readonly remainingMs: number;

  /** Whether a run is currently counting down. */
  readonly running: boolean;

  /** Starts (or restarts) a run of {@link UseCountdownOptions.durationMs}. */
  readonly start: () => void;

  /** Stops the current run without firing `onExpire`. */
  readonly stop: () => void;
}

/**
 * A countdown whose deadline is wall-clock time, not accumulated ticks.
 *
 * @remarks
 * `start()` records `Date.now() + durationMs` once, in a ref, and every
 * 100 ms tick recomputes `Math.max(0, deadline - Date.now())` from scratch —
 * so a throttled or backgrounded tab cannot stretch the run by falling behind
 * on ticks. A `visibilitychange` listener forces the same recomputation on
 * top of the interval, so a tab that comes back after the deadline has
 * already passed fires `onExpire` immediately rather than waiting for the
 * next scheduled tick. `onExpire` is guarded so it fires at most once per
 * `start()`, and `stop()` clears the deadline as well as the timer, so no
 * later recomputation — from the interval or from `visibilitychange` — can
 * fire it after the caller asked to stop.
 */
export function useCountdown({
  durationMs,
  onExpire,
}: UseCountdownOptions): UseCountdownResult {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [running, setRunning] = useState(false);

  const deadlineRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read through a ref so `tick` never needs `onExpire` in its own dependency
  // list — a caller that passes a new function identity on every render must
  // not retrigger the interval or the listener effect below.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const deadline = deadlineRef.current;
    if (deadline === null) {
      return;
    }

    const remaining = Math.max(0, deadline - Date.now());
    setRemainingMs(remaining);

    if (remaining === 0 && !expiredRef.current) {
      expiredRef.current = true;
      clearTimer();
      setRunning(false);
      onExpireRef.current();
    }
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    // Clearing the deadline, not only the interval, is what keeps a
    // `visibilitychange` recomputation after `stop()` from firing `onExpire`.
    deadlineRef.current = null;
    setRunning(false);
  }, [clearTimer]);

  const start = useCallback(() => {
    clearTimer();
    expiredRef.current = false;
    deadlineRef.current = Date.now() + durationMs;
    setRemainingMs(durationMs);
    setRunning(true);
    intervalRef.current = setInterval(tick, TICK_MS);
  }, [clearTimer, durationMs, tick]);

  useEffect(() => {
    function handleVisibilityChange(): void {
      tick();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tick]);

  // Unmount cleanup: nothing here fires `onExpire` — it only stops the timer.
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { remainingMs, running, start, stop };
}
