import { useCallback, useEffect, useRef, useState } from "react";

import type { QuestionsResponse, WireQuestion } from "@/core/wire";

/** The shape `fetchQuestions` from `./api` has — taken as a value, not an import. */
export type FetchQuestions = (
  count: number,
  signal?: AbortSignal,
) => Promise<QuestionsResponse>;

export interface UseQuestionQueueOptions {
  /** Fetches one batch. Injected so a test can stand in for the network. */
  readonly fetchQuestions: FetchQuestions;

  /** How many questions one fetch asks for. */
  readonly batchSize?: number;

  /** Refills once the queue behind `current` drops below this many. */
  readonly refillBelow?: number;
}

/** Where the queue is in its lifecycle. */
export type QuestionQueueStatus = "loading" | "ready" | "error";

export interface UseQuestionQueueResult {
  /** The question a screen should show now, or `undefined` before the first
   * batch has loaded. */
  readonly current: WireQuestion | undefined;

  /** Drops `current` and moves to the next queued question. */
  readonly advance: () => void;

  /** `"loading"` until the first batch resolves, then `"ready"` or `"error"`. */
  readonly status: QuestionQueueStatus;

  /**
   * The most recent fetch failure, or `undefined`. Set on an initial-load
   * failure (alongside `status: "error"`) and on a refill failure (with
   * `status` left at `"ready"` and `current` untouched) alike.
   */
  readonly error: unknown;

  /** Retries the initial load if it failed, or a failed refill otherwise. */
  readonly retry: () => void;
}

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_REFILL_BELOW = 2;

/**
 * Keeps a queue of drill questions fetched five at a time, refilling in the
 * background while the current one is being answered and scored.
 *
 * @remarks
 * The initial fetch and a refill are deliberately different failure modes.
 * An initial-load failure leaves the queue empty, so `status` becomes
 * `"error"` and `retry()` repeats that same fetch. A refill failure happens
 * while a question the learner already has is still on screen, so it must
 * not disturb `current` or the queue behind it — only `error` is set, and
 * `status` stays `"ready"`; `retry()` in that state repeats the refill
 * instead. Concurrent refills are coalesced through `refillingRef`, since
 * `advance()` can cross the `refillBelow` line more than once before the
 * first request resolves.
 */
export function useQuestionQueue({
  fetchQuestions,
  batchSize = DEFAULT_BATCH_SIZE,
  refillBelow = DEFAULT_REFILL_BELOW,
}: UseQuestionQueueOptions): UseQuestionQueueResult {
  const [queue, setQueue] = useState<readonly WireQuestion[]>([]);
  const [status, setStatus] = useState<QuestionQueueStatus>("loading");
  const [error, setError] = useState<unknown>(undefined);

  // Read through a ref so a caller passing a new `fetchQuestions` identity on
  // every render does not retrigger the mount effect below.
  const fetchQuestionsRef = useRef(fetchQuestions);
  useEffect(() => {
    fetchQuestionsRef.current = fetchQuestions;
  }, [fetchQuestions]);

  const initialControllerRef = useRef<AbortController | null>(null);
  const refillControllerRef = useRef<AbortController | null>(null);
  const refillingRef = useRef(false);

  // The async half of an initial load: no synchronous `setState` here, only
  // inside the `.then`/`.catch` callbacks, so this is safe to call directly
  // from the mount effect below without tripping `react-hooks/set-state-in-effect`.
  const startInitialFetch = useCallback(
    (controller: AbortController) => {
      fetchQuestionsRef
        .current(batchSize, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setQueue(response.questions);
          setStatus("ready");
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          setError(caught);
          setStatus("error");
        });
    },
    [batchSize],
  );

  // The version `retry()` calls: it resets `status`/`error` synchronously
  // because it always runs from an event handler, never from an effect body.
  const loadInitial = useCallback(() => {
    initialControllerRef.current?.abort();
    const controller = new AbortController();
    initialControllerRef.current = controller;
    setStatus("loading");
    setError(undefined);
    startInitialFetch(controller);
  }, [startInitialFetch]);

  const refill = useCallback(() => {
    if (refillingRef.current) {
      return;
    }
    refillingRef.current = true;
    const controller = new AbortController();
    refillControllerRef.current = controller;

    fetchQuestionsRef
      .current(batchSize, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }
        setQueue((previous) => [...previous, ...response.questions]);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(caught);
      })
      .finally(() => {
        refillingRef.current = false;
      });
  }, [batchSize]);

  useEffect(() => {
    // `status`/`error` already start at "loading"/`undefined`, so the mount
    // run needs only to start the fetch — never a synchronous `setState`.
    const controller = new AbortController();
    initialControllerRef.current = controller;
    startInitialFetch(controller);
    return () => {
      controller.abort();
      refillControllerRef.current?.abort();
    };
  }, [startInitialFetch]);

  // A side effect belongs here, not inside `setQueue`'s updater: React may
  // invoke that updater more than once for the same commit, and a refill
  // fetch must run at most once per crossing of `refillBelow`.
  useEffect(() => {
    if (status === "ready" && queue.length < refillBelow) {
      refill();
    }
  }, [status, queue.length, refillBelow, refill]);

  const advance = useCallback(() => {
    setQueue((previous) => previous.slice(1));
  }, []);

  const retry = useCallback(() => {
    if (status === "error") {
      loadInitial();
    } else {
      refill();
    }
  }, [status, loadInitial, refill]);

  return {
    current: queue[0],
    advance,
    status,
    error,
    retry,
  };
}
