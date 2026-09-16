import type { ChangeEvent, ReactElement } from "react";

import { cn } from "@/components/lib/utils";
import { DrillCard, DrillDivider } from "@/components/shared/card";
import { BODY_TEXT_CLASS_NAME, describeApiError } from "@/components/shared/format";
import { LoadingIndicator } from "@/components/shared/loading-indicator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_SCORE_ANSWER_LENGTH, type WireQuestion } from "@/core/wire";

import { formatCountdown } from "./format";

interface AnsweringCardProps {
  readonly question: WireQuestion;
  readonly remainingMs: number;
  readonly reply: string;
  readonly onReplyChange: (value: string) => void;
  readonly onSend: () => void;
  readonly onRetry: () => void;
  /** Whether a scoring request is in flight for this reply. */
  readonly submitting: boolean;
  /** The most recent scoring failure, or `undefined` when there is none. */
  readonly scoreError: unknown;
}

const URGENT_THRESHOLD_MS = 10_000;

/**
 * The drill card: countdown and scenario line in the header, the question and
 * the reply textarea in the body, the hint and the one filled action in the
 * footer. Rendered for both `"answering"` and `"scoring"` — scoring locks the
 * submitted reply, puts its loading status in the body, and marks the stopped
 * countdown; a failed request keeps that locked state and offers `Retry`.
 */
export function AnsweringCard({
  question,
  remainingMs,
  reply,
  onReplyChange,
  onSend,
  onRetry,
  submitting,
  scoreError,
}: AnsweringCardProps): ReactElement {
  const hasError = scoreError !== undefined;
  const expired = remainingMs === 0;
  const stopped = submitting || hasError;
  const urgent = !stopped && remainingMs > 0 && remainingMs < URGENT_THRESHOLD_MS;
  const disabled = submitting || hasError;

  const footerHint = hasError ? undefined : "Reply in one or two sentences.";
  const buttonLabel = hasError ? "Retry" : "Send";
  const buttonDisabled = hasError ? false : submitting || reply.trim() === "";

  // Clamped here, not only through the `maxLength` attribute below: a native
  // `maxLength` stops a real browser's typing and pasting, but this is what
  // guarantees the invariant regardless of how `value` arrives, so `reply`
  // can never carry more than `scoreRequestSchema` accepts and reach
  // `submitForScoring`'s local parse as an unrecoverable `ZodError`.
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onReplyChange(event.target.value.slice(0, MAX_SCORE_ANSWER_LENGTH));
  }

  return (
    <DrillCard urgent={urgent || expired}>
      <header className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono font-semibold text-figure",
              stopped ? "text-slate" : urgent || expired ? "text-status" : "text-ink",
            )}
          >
            {formatCountdown(remainingMs)}
          </span>
          {expired ? (
            <span className="font-mono text-micro uppercase text-status">TIME UP</span>
          ) : null}
          {stopped ? (
            <span className="font-mono text-micro uppercase text-slate">STOPPED</span>
          ) : null}
        </div>
        <p className="font-sans text-caption text-slate">{question.scenarioLine}</p>
      </header>
      <DrillDivider />
      <div className="flex flex-col gap-4">
        <p className="font-mono text-question text-balance text-ink">
          {question.question}
        </p>
        <Textarea
          value={reply}
          onChange={handleChange}
          disabled={disabled}
          autoFocus
          rows={3}
          maxLength={MAX_SCORE_ANSWER_LENGTH}
          aria-label="Your reply"
          className={stopped ? "disabled:bg-rule disabled:text-slate" : undefined}
        />
        {submitting ? (
          <div className="flex items-center border border-rule p-3">
            <LoadingIndicator label="Scoring your reply" />
          </div>
        ) : null}
        {hasError ? (
          <p className={BODY_TEXT_CLASS_NAME}>
            {describeApiError(scoreError, "The scorer did not answer")}
          </p>
        ) : null}
      </div>
      <DrillDivider />
      <div
        className={cn(
          // `flex-wrap`, as in the idle screen: below 720px the button is
          // `w-full`, and without wrapping it sits beside the hint and runs
          // past the viewport instead of dropping onto its own line.
          "flex flex-wrap items-center gap-3",
          footerHint ? "justify-between" : "justify-end",
        )}
      >
        {!submitting && footerHint ? (
          <p className="mb-0 font-sans text-caption text-slate">{footerHint}</p>
        ) : null}
        <Button
          onClick={hasError ? onRetry : onSend}
          disabled={buttonDisabled}
          className="w-full min-[720px]:w-auto"
        >
          {buttonLabel}
        </Button>
      </div>
    </DrillCard>
  );
}
