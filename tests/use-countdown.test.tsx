import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountdown } from "../src/components/drill/use-countdown";

const START_TIME = new Date("2026-09-16T00:00:00.000Z");

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the full duration and is not running before start()", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown({ durationMs: 30_000, onExpire }));

    expect(result.current.remainingMs).toBe(30_000);
    expect(result.current.running).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("counts down from 30 000 as time passes after start()", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown({ durationMs: 30_000, onExpire }));

    act(() => {
      result.current.start();
    });
    expect(result.current.running).toBe(true);

    act(() => {
      vi.advanceTimersByTime(12_000);
    });

    expect(result.current.remainingMs).toBe(18_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("fires onExpire exactly once when the system clock jumps past the deadline in a single tick", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown({ durationMs: 30_000, onExpire }));

    act(() => {
      result.current.start();
    });

    // A throttled background tab: the wall clock advances 31s but only one
    // 100ms interval tick actually runs.
    act(() => {
      vi.setSystemTime(new Date(START_TIME.getTime() + 31_000));
      vi.advanceTimersByTime(100);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.running).toBe(false);

    // Further ticks must not fire it again.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("recomputes on visibilitychange, firing onExpire immediately if the deadline already passed", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown({ durationMs: 30_000, onExpire }));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.setSystemTime(new Date(START_TIME.getTime() + 31_000));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.remainingMs).toBe(0);
  });

  it("never fires onExpire when stop() is called before zero", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown({ durationMs: 30_000, onExpire }));

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    act(() => {
      result.current.stop();
    });

    expect(result.current.running).toBe(false);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(onExpire).not.toHaveBeenCalled();

    // A visibilitychange after stop() must not resurrect the expired deadline
    // either.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("fires onExpire exactly once per start(), even across a restart", () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown({ durationMs: 30_000, onExpire }));

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(30_100);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(30_100);
    });
    expect(onExpire).toHaveBeenCalledTimes(2);
  });

  it("fires the onExpire from the latest render, not a stale one from before a re-render", () => {
    const onExpireCalls: string[] = [];
    const { result, rerender } = renderHook(
      ({ tag }: { tag: string }) =>
        useCountdown({
          durationMs: 30_000,
          onExpire: () => onExpireCalls.push(tag),
        }),
      { initialProps: { tag: "first" } },
    );

    act(() => {
      result.current.start();
    });

    // A re-render swaps in a new `onExpire` closure (as a caller re-rendering
    // with fresh state on every keystroke would) before the deadline is
    // reached.
    rerender({ tag: "second" });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(onExpireCalls).toEqual(["second"]);
  });

  it("clears the interval on unmount", () => {
    const onExpire = vi.fn();
    const { result, unmount } = renderHook(() =>
      useCountdown({ durationMs: 30_000, onExpire }),
    );

    act(() => {
      result.current.start();
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
