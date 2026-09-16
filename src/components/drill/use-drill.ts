import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { createRecordsStore, type RecordStorage } from "@/components/lib/records-store";
import type { DrillRecord } from "@/core/records";
import type { WireQuestion } from "@/core/wire";

import { fetchQuestions } from "./api";
import { DRILL_DURATION_MS } from "./constants";
import { useCountdown } from "./use-countdown";
import { useQuestionQueue, type QuestionQueueStatus } from "./use-question-queue";
import { useSubmission } from "./use-submission";

export type DrillPhase = "idle" | "answering" | "scoring" | "feedback";

/**
 * The three phases actually stored: `"answering"` and `"scoring"` are one
 * `"active"` stage here, distinguished only by whether `useSubmission`
 * currently has a request in flight or a failure to show — deriving that
 * split in {@link useDrill}'s return, rather than tracking it as separate
 * state, is what stops the two from ever falling out of sync with each other.
 */
type Stage = "idle" | "active" | "feedback";

export interface UseDrillResult {
  readonly phase: DrillPhase;
  readonly queueStatus: QuestionQueueStatus;
  readonly queueError: unknown;
  readonly activeQuestion: WireQuestion | undefined;
  readonly reply: string;
  readonly setReply: (value: string) => void;
  readonly remainingMs: number;
  readonly scoreError: unknown;
  readonly submitting: boolean;
  readonly record: DrillRecord | undefined;
  readonly previousRecord: DrillRecord | undefined;
  readonly onStart: () => void;
  readonly onSend: () => void;
  readonly onRetryScore: () => void;
  readonly onRetryQueue: () => void;
  readonly onNext: () => void;
}

/**
 * The whole v0.1 loop as one hook: `idle → answering → scoring → feedback`,
 * composing `useQuestionQueue`, `useCountdown` and `./use-submission` rather
 * than reimplementing any of them. Kept apart from `drill.tsx`'s JSX so
 * neither file crosses `eslint.config.mjs`'s per-file size budget.
 *
 * @remarks
 * `storage` is read lazily, inside an event handler, never during render —
 * `window.localStorage` does not exist during this Client Component's
 * server-side render pass, and an event handler never runs there.
 */
export function useDrill(storage: RecordStorage | undefined): UseDrillResult {
  const queue = useQuestionQueue({ fetchQuestions });
  const { current: currentQuestion } = queue;

  const [stage, setStage] = useState<Stage>("idle");
  const [reply, setReply] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<WireQuestion | undefined>(
    undefined,
  );
  const [recordPair, setRecordPair] = useState<{
    current?: DrillRecord | undefined;
    previous?: DrillRecord | undefined;
  }>({});

  // Set only by `onNext`, and only read by the effect below: it marks this
  // `"idle"` stage as a between-rep gap waiting on a question that may
  // already be in hand, rather than the very first screen — which must wait
  // for an explicit `Start` press even once the queue is ready.
  const awaitingNextRef = useRef(false);

  const getStore = useCallback(
    () => createRecordsStore(storage ?? window.localStorage),
    [storage],
  );

  const finishRecord = useCallback(
    (record: DrillRecord) => {
      getStore().append(record);
      setRecordPair((previous) => ({ current: record, previous: previous.current }));
      setStage("feedback");
    },
    [getStore],
  );

  // `onExpire` closes over `submission`, declared just below — safe, since a
  // closure is not evaluated until the timer actually calls it, well after
  // this render (and `submission`'s assignment) has finished. `useCountdown`
  // has to run first regardless: `useSubmission` needs its `remainingMs`.
  const {
    remainingMs,
    start: startCountdown,
    stop: stopCountdown,
  } = useCountdown({
    durationMs: DRILL_DURATION_MS,
    onExpire: () => {
      submission.onExpire();
    },
  });

  const submission = useSubmission(activeQuestion, reply, remainingMs, finishRecord);
  // Destructured so `startRep` below depends on the plain, `useCallback`
  // -memoized function itself rather than on a `submission.reset` member
  // expression — both are stable across renders, but this is what lets
  // `react-hooks/exhaustive-deps` see that stability.
  const { reset: resetSubmission } = submission;

  const startRep = useCallback(
    (question: WireQuestion) => {
      setActiveQuestion(question);
      setReply("");
      resetSubmission();
      setStage("active");
      startCountdown();
    },
    [startCountdown, resetSubmission],
  );

  // Between-rep continuation: once `onNext` has advanced the queue and asked
  // for `"idle"`, this fires the moment a question is actually on hand —
  // immediately when the queue was already ahead (the common case, no
  // network round trip), or later once a pending refill lands. It never
  // fires for the very first `"idle"` screen, since `awaitingNextRef` starts
  // `false` and only `onNext` sets it. `useLayoutEffect` rather than
  // `useEffect`: the continuation must land before the browser paints, so an
  // already-ready next question never flashes the idle screen first — "no
  // entrance animation" per the lock.
  useLayoutEffect(() => {
    if (stage === "idle" && awaitingNextRef.current && currentQuestion) {
      awaitingNextRef.current = false;
      startRep(currentQuestion);
    }
  }, [stage, currentQuestion, startRep]);

  const phase: DrillPhase =
    stage === "active"
      ? submission.submitting || submission.scoreError !== undefined
        ? "scoring"
        : "answering"
      : stage;

  return {
    phase,
    queueStatus: queue.status,
    queueError: queue.error,
    activeQuestion,
    reply,
    setReply,
    remainingMs,
    scoreError: phase === "scoring" ? submission.scoreError : undefined,
    submitting: submission.submitting,
    record: recordPair.current,
    previousRecord: recordPair.previous,
    onStart: () => {
      if (currentQuestion) {
        startRep(currentQuestion);
      }
    },
    onSend: () => {
      stopCountdown();
      submission.onSend();
    },
    onRetryScore: () => {
      stopCountdown();
      submission.onRetry();
    },
    onRetryQueue: queue.retry,
    onNext: () => {
      queue.advance();
      awaitingNextRef.current = true;
      setStage("idle");
    },
  };
}
