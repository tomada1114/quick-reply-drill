import { useCallback, useRef, useState } from "react";

import type { DrillRecord } from "@/core/records";
import type { WireQuestion } from "@/core/wire";

import { submitForScoring } from "@/components/shared/api";
import { buildForcedEmptyRecord, buildScoredRecord } from "./build-record";
import { DRILL_DURATION_MS } from "./constants";

/** The profile a forced-empty record falls back to before any reply has ever been graded. */
export interface ScoreProfile {
  readonly alias: string;
  readonly reasoningEffort: string;
}

export interface UseSubmissionResult {
  readonly submitting: boolean;
  readonly scoreError: unknown;
  /** Clears the failed/completed state a new rep starts fresh from. Stable across renders. */
  readonly reset: () => void;
  /** Sends the current reply now, as a manual `Send`. No-op on a blank reply. */
  readonly onSend: () => void;
  /** The clock reached zero: scores a non-blank reply, or records zeros locally. */
  readonly onExpire: () => void;
  /** Resubmits the same reply after a failure. No-op before one has ever been sent. */
  readonly onRetry: () => void;
}

/**
 * The submission half of the drill loop: sending a reply to `/api/score` (or,
 * for a blank reply at expiry, building the zero-score record locally without
 * a request), tracking the in-flight/failed state a screen shows, and
 * remembering the last graded profile a later forced-empty record falls back
 * to. Split out of `use-drill.ts` to stay under the per-file size budget.
 *
 * @remarks
 * `reply` and `remainingMs` are read fresh every render rather than passed
 * per call, the same pattern `useCountdown`'s own `onExpire` ref uses. Every
 * returned function is `useCallback`-memoized, matching `useQuestionQueue`'s
 * and `useCountdown`'s own convention, so `use-drill.ts`'s `startRep` (which
 * calls `reset`) and its continuation effect (which depends on the whole
 * chain) do not churn identity on every keystroke into the reply field.
 */
export function useSubmission(
  activeQuestion: WireQuestion | undefined,
  reply: string,
  remainingMs: number,
  onFinished: (record: DrillRecord) => void,
): UseSubmissionResult {
  const [submittedReply, setSubmittedReply] = useState<string | undefined>(undefined);
  const [forced, setForced] = useState(false);
  const [scoreError, setScoreError] = useState<unknown>(undefined);
  const [inFlight, setInFlight] = useState(false);
  const [lastModel, setLastModel] = useState<ScoreProfile | undefined>(undefined);
  const controllerRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (
      answer: string,
      forcedSubmit: boolean,
      remainingMsAtSubmit: number,
    ): Promise<void> => {
      if (!activeQuestion) {
        return;
      }
      setSubmittedReply(answer);
      setForced(forcedSubmit);
      setScoreError(undefined);
      setInFlight(true);

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await submitForScoring(
          {
            question: activeQuestion.question,
            scenarioLine: activeQuestion.scenarioLine,
            answer,
          },
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }
        setLastModel(response.model);
        onFinished(
          buildScoredRecord({
            id: crypto.randomUUID(),
            recordedAt: new Date().toISOString(),
            question: activeQuestion,
            answer,
            forcedSubmit,
            elapsedMs: DRILL_DURATION_MS - remainingMsAtSubmit,
            response,
          }),
        );
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }
        setScoreError(caught);
      } finally {
        if (!controller.signal.aborted) {
          setInFlight(false);
        }
      }
    },
    [activeQuestion, onFinished],
  );

  return {
    submitting: inFlight,
    scoreError,
    reset: useCallback(() => {
      setSubmittedReply(undefined);
      setForced(false);
      setScoreError(undefined);
    }, []),
    onSend: useCallback(() => {
      const trimmed = reply.trim();
      if (trimmed !== "") {
        void submit(trimmed, false, remainingMs);
      }
    }, [reply, remainingMs, submit]),
    onExpire: useCallback(() => {
      if (!activeQuestion) {
        return;
      }
      const trimmed = reply.trim();
      if (trimmed === "") {
        onFinished(
          buildForcedEmptyRecord({
            id: crypto.randomUUID(),
            recordedAt: new Date().toISOString(),
            question: activeQuestion,
            answer: reply,
            elapsedMs: DRILL_DURATION_MS,
            lastModel,
          }),
        );
        return;
      }
      void submit(trimmed, true, 0);
    }, [activeQuestion, reply, lastModel, onFinished, submit]),
    onRetry: useCallback(() => {
      if (submittedReply !== undefined) {
        void submit(submittedReply, forced, remainingMs);
      }
    }, [submittedReply, forced, remainingMs, submit]),
  };
}
