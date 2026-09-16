import { useCallback, useEffect, useRef, useState } from "react";

import type { WireQuestion } from "@/core/wire";

import type {
  QuestionQueueStatus,
  UseQuestionQueueOptions,
  UseQuestionQueueResult,
} from "./use-question-queue-types";

export type {
  FetchQuestions,
  QuestionQueueStatus,
  UseQuestionQueueOptions,
  UseQuestionQueueResult,
} from "./use-question-queue-types";
/** The phases stored in state; `"empty"` is a derived fact about `"ready"`
 * (computed in this hook's return), not something to sync via an effect. */
type InternalStatus = Exclude<QuestionQueueStatus, "empty">;

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_REFILL_BELOW = 2;

/**
 * Keeps a queue of drill questions fetched five at a time, refilling in the
 * background while the current one is being answered and scored.
 *
 * @remarks
 * The initial fetch and a refill are deliberately different failure modes.
 * An initial-load failure leaves the queue empty, so `status` becomes
 * `"error"` and `retry()` repeats that fetch. A refill failure happens while
 * a question the learner already has is on screen, so it leaves `current`
 * and the queue untouched — only `error` is set, and internal `status` stays
 * `"ready"` (reported as `"empty"` once the queue is actually drained);
 * `retry()` there repeats the refill instead. Concurrent refills are
 * coalesced through `refillingRef`, since `advance()` can cross
 * `refillBelow` more than once before the first request resolves; `retry()`
 * still clears a stale `error` even when that coalescing makes it a no-op,
 * so a press during an in-flight refill is never silently dropped.
 */
export function useQuestionQueue({
  fetchQuestions,
  batchSize = DEFAULT_BATCH_SIZE,
  refillBelow = DEFAULT_REFILL_BELOW,
}: UseQuestionQueueOptions): UseQuestionQueueResult {
  const [queue, setQueue] = useState<readonly WireQuestion[]>([]);
  const [status, setStatus] = useState<InternalStatus>("loading");
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
      // Through the ref, not the closed-over `controller`: `retry()` can install a
      // new one here, and it is that in-flight request an unmount must abort.
      initialControllerRef.current?.abort();
      refillControllerRef.current?.abort();
    };
  }, [startInitialFetch]);

  // A side effect belongs here, not inside `setQueue`'s updater: React may
  // invoke that updater more than once per commit. `refillBelow` is always
  // at least 1, so this already covers the queue draining to 0.
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
      // `refillingRef` coalesces `refill()` below into a no-op when one is
      // already in flight; clearing `error` still makes the press visible.
      setError(undefined);
      refill();
    }
  }, [status, loadInitial, refill]);

  return {
    current: queue[0],
    advance,
    status: status === "ready" && queue.length === 0 ? "empty" : status,
    error,
    retry,
  };
}
