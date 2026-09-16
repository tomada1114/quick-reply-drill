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
});
