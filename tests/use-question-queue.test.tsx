import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useQuestionQueue } from "../src/components/drill/use-question-queue";
import type { QuestionsResponse, WireQuestion } from "../src/core/wire";

/** One fake generated question, distinguishable by `id`. */
function makeQuestion(id: string): WireQuestion {
  return {
    id,
    question: `Question ${id}?`,
    scenarioLine: `Scenario ${id}.`,
    seed: {
      interlocutorId: "coworker",
      settingId: "office-chat",
      topicId: "scheduling",
    },
  };
}

/** A batch response built from a list of ids. */
function makeBatch(ids: readonly string[]): QuestionsResponse {
  return { questions: ids.map(makeQuestion) };
}

describe("useQuestionQueue", () => {
  it("fetches a first batch of 5 on mount", async () => {
    const fetchQuestions = vi
      .fn()
      .mockResolvedValue(makeBatch(["1", "2", "3", "4", "5"]));
    const { result } = renderHook(() => useQuestionQueue({ fetchQuestions }));

    expect(result.current.status).toBe("loading");
    expect(result.current.current).toBeUndefined();

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(fetchQuestions).toHaveBeenCalledTimes(1);
    expect(fetchQuestions).toHaveBeenCalledWith(5, expect.any(AbortSignal));
    expect(result.current.current?.id).toBe("1");
  });

  it("triggers exactly one refill request for 5 more once advance() ×4 crosses the threshold", async () => {
    const fetchQuestions = vi
      .fn()
      .mockResolvedValueOnce(makeBatch(["1", "2", "3", "4", "5"]))
      .mockResolvedValueOnce(makeBatch(["6", "7", "8", "9", "10"]));
    const { result } = renderHook(() => useQuestionQueue({ fetchQuestions }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.advance()); // 5 -> 4
    act(() => result.current.advance()); // 4 -> 3
    act(() => result.current.advance()); // 3 -> 2
    expect(fetchQuestions).toHaveBeenCalledTimes(1);
    expect(result.current.current?.id).toBe("4");

    act(() => result.current.advance()); // 2 -> 1, crosses refillBelow (2)

    await waitFor(() => expect(fetchQuestions).toHaveBeenCalledTimes(2));
    expect(fetchQuestions).toHaveBeenLastCalledWith(5, expect.any(AbortSignal));

    await waitFor(() => expect(result.current.error).toBeUndefined());
    expect(result.current.current?.id).toBe("5");
  });

  it("keeps current intact and sets error when a refill fails", async () => {
    const refillError = new Error("network down");
    const fetchQuestions = vi
      .fn()
      .mockResolvedValueOnce(makeBatch(["1", "2", "3", "4", "5"]))
      .mockRejectedValueOnce(refillError);
    const { result } = renderHook(() => useQuestionQueue({ fetchQuestions }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.advance());
    act(() => result.current.advance());
    act(() => result.current.advance());
    act(() => result.current.advance());

    await waitFor(() => expect(result.current.error).toBe(refillError));

    expect(result.current.status).toBe("ready");
    expect(result.current.current?.id).toBe("5");
  });

  it("does not coalesce two refill triggers into two requests", async () => {
    let resolveRefill: ((value: QuestionsResponse) => void) | undefined;
    const fetchQuestions = vi
      .fn()
      .mockResolvedValueOnce(makeBatch(["1", "2", "3"]))
      .mockImplementationOnce(
        () =>
          new Promise<QuestionsResponse>((resolve) => {
            resolveRefill = resolve;
          }),
      );
    const { result } = renderHook(() =>
      useQuestionQueue({ fetchQuestions, batchSize: 3, refillBelow: 4 }),
    );

    // The initial batch (length 3) already sits under the refill threshold
    // (refillBelow: 4), so the first refill starts as soon as it lands.
    await waitFor(() => expect(fetchQuestions).toHaveBeenCalledTimes(2));

    // Advancing while that refill is still in flight must not start a second
    // one — concurrent refills are coalesced.
    act(() => result.current.advance());
    act(() => result.current.advance());
    expect(fetchQuestions).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefill?.(makeBatch(["4", "5", "6"]));
      await Promise.resolve();
    });

    expect(fetchQuestions).toHaveBeenCalledTimes(2);
  });

  it('reports an initial load failure as status "error" with current left unset', async () => {
    const loadError = new Error("boom");
    const fetchQuestions = vi.fn().mockRejectedValue(loadError);
    const { result } = renderHook(() => useQuestionQueue({ fetchQuestions }));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toBe(loadError);
    expect(result.current.current).toBeUndefined();
  });

  it("retries the initial load through retry() after a failure", async () => {
    const fetchQuestions = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makeBatch(["1", "2", "3", "4", "5"]));
    const { result } = renderHook(() => useQuestionQueue({ fetchQuestions }));

    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.current?.id).toBe("1");
  });

  it("aborts an in-flight retry() fetch on unmount, not the long-settled mount fetch", async () => {
    const signals: AbortSignal[] = [];
    let resolveRetryFetch: ((value: QuestionsResponse) => void) | undefined;
    const fetchQuestions = vi
      .fn()
      .mockImplementation((_count: number, signal?: AbortSignal) => {
        if (signal) {
          signals.push(signal);
        }
        if (signals.length === 1) {
          return Promise.reject(new Error("initial load failed"));
        }
        return new Promise<QuestionsResponse>((resolve) => {
          resolveRetryFetch = resolve;
        });
      });
    const { result, unmount } = renderHook(() => useQuestionQueue({ fetchQuestions }));

    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());
    await waitFor(() => expect(signals).toHaveLength(2));

    // `loadInitial()` (which `retry()` calls) already aborts the mount
    // controller itself, before starting the new one — that part is
    // intentional and unrelated to the bug this test guards. What matters
    // here is the *retry's* controller, still in flight when unmount runs.
    const retrySignal = signals[1];
    expect(retrySignal?.aborted).toBe(false);

    unmount();

    expect(retrySignal?.aborted).toBe(true);

    // Let the still-pending promise settle so it does not leak into another test.
    resolveRetryFetch?.(makeBatch(["1"]));
  });

  it('transitions to status "empty" when a batch resolves with zero questions', async () => {
    const fetchQuestions = vi.fn().mockResolvedValue(makeBatch([]));
    const { result } = renderHook(() => useQuestionQueue({ fetchQuestions }));

    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(result.current.current).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('transitions to status "empty" (not a silent "ready" with no question) when a refill fails after advance() drains the queue', async () => {
    // `mockRejectedValue` (no "Once") rather than a fixed count: draining the
    // queue to empty drives one automatic extra refill attempt beyond
    // whichever one emptied it (see the status/queue.length-sync effect in
    // the hook), so more than one further call is expected here.
    const fetchQuestions = vi
      .fn()
      .mockResolvedValueOnce(makeBatch(["1", "2"]))
      .mockRejectedValue(new Error("refill failed"));
    const { result } = renderHook(() =>
      useQuestionQueue({ fetchQuestions, batchSize: 2, refillBelow: 2 }),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchQuestions).toHaveBeenCalledTimes(1);

    act(() => result.current.advance()); // 2 -> 1, crosses refillBelow (2)
    await waitFor(() => expect(fetchQuestions).toHaveBeenCalledTimes(2));

    act(() => result.current.advance()); // 1 -> 0

    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(result.current.current).toBeUndefined();
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  });

  it("clears a stale error when retry() is pressed while a refill is already in flight", async () => {
    let resolveThirdFetch: ((value: QuestionsResponse) => void) | undefined;
    const fetchQuestions = vi
      .fn()
      .mockResolvedValueOnce(makeBatch(["1", "2", "3"]))
      .mockRejectedValueOnce(new Error("first refill failed"))
      .mockImplementationOnce(
        () =>
          new Promise<QuestionsResponse>((resolve) => {
            resolveThirdFetch = resolve;
          }),
      );
    const { result } = renderHook(() =>
      useQuestionQueue({ fetchQuestions, batchSize: 3, refillBelow: 4 }),
    );

    // The initial batch (length 3) is already under refillBelow (4), so a
    // refill starts immediately and this first one fails.
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(fetchQuestions).toHaveBeenCalledTimes(2);

    // Advancing changes queue.length, which starts a second refill attempt —
    // this one never settles, standing in for an in-flight/stalled refill.
    act(() => result.current.advance());
    await waitFor(() => expect(fetchQuestions).toHaveBeenCalledTimes(3));

    act(() => result.current.retry());

    // No new request: the in-flight refill coalesces it. But the stale error
    // from the first failure must still be cleared, so the press is visible.
    expect(fetchQuestions).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBeUndefined();

    await act(async () => {
      resolveThirdFetch?.(makeBatch(["4"]));
      await Promise.resolve();
    });
  });
});
