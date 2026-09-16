import type { ChangeEvent, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/lib/utils";
import type { WireQuestion } from "@/core/wire";

import { DrillCard, DrillDivider } from "./card";
import { BODY_TEXT_CLASS_NAME, describeApiError, formatCountdown } from "./format";

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
 * footer. Rendered for both `"answering"` and `"scoring"` — the footer action
 * relabels to a caption plus a disabled `Send` while a request is in flight,
 * and to body text plus `Retry` once one has failed.
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
  const urgent = remainingMs > 0 && remainingMs < URGENT_THRESHOLD_MS;
  const disabled = submitting || hasError;

  const footerHint = submitting
    ? "Scoring…"
    : hasError
      ? undefined
      : "Reply in one or two sentences.";
  const buttonLabel = hasError ? "Retry" : "Send";
  const buttonDisabled = hasError ? false : submitting || reply.trim() === "";

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onReplyChange(event.target.value);
  }

  return (
    <DrillCard urgent={urgent || expired}>
      <header className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono font-semibold text-figure",
              urgent || expired ? "text-status" : "text-ink",
            )}
          >
            {formatCountdown(remainingMs)}
          </span>
          {expired ? (
            <span className="font-mono text-micro uppercase text-status">TIME UP</span>
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
          aria-label="Your reply"
        />
        {hasError ? (
          <p className={BODY_TEXT_CLASS_NAME}>
            {describeApiError(scoreError, "The scorer did not answer")}
          </p>
        ) : null}
      </div>
      <DrillDivider />
      <div
        className={cn(
          "flex items-center gap-3",
          footerHint ? "justify-between" : "justify-end",
        )}
      >
        {footerHint ? (
          <p className="font-sans text-caption text-slate">{footerHint}</p>
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
