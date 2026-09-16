import type { ReactElement } from "react";

import { DrillCard } from "@/components/shared/card";
import { describeApiError } from "@/components/shared/format";
import { LoadingIndicator } from "@/components/shared/loading-indicator";
import { Button } from "@/components/ui/button";

import type { QuestionQueueStatus } from "./use-question-queue";

interface IdleScreenProps {
  readonly status: QuestionQueueStatus;
  readonly error: unknown;
  readonly onStart: () => void;
  readonly onRetry: () => void;
}

/**
 * The screen shown whenever there is no question on hand to answer yet: the
 * very first load, and the rare gap where a background refill has not
 * finished (or has failed) by the time a rep ends. Per `use-question-queue`'s
 * contract, `"empty"` is two different situations that share one status: a
 * refill still in flight (`error` is `undefined` — the same wait as the very
 * first `"loading"`, and it resolves on its own once the refill lands) and a
 * refill that already failed (`error` is set — the dead end `"error"` shares,
 * which needs `onRetry`). Only the second gets `Retry` and the error text;
 * the first must never show either, and never invent an error code for the
 * `error` it does not have.
 */
export function IdleScreen({
  status,
  error,
  onStart,
  onRetry,
}: IdleScreenProps): ReactElement {
  const failed = status === "error" || (status === "empty" && error !== undefined);
  const waiting = status === "loading" || (status === "empty" && error === undefined);

  return (
    <DrillCard>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={failed ? onRetry : onStart}
          disabled={!failed && status !== "ready"}
          className="w-full min-[720px]:w-auto"
        >
          {failed ? "Retry" : "Start"}
        </Button>
        {failed ? (
          <p className="mb-0 font-sans text-caption text-slate">
            {describeApiError(error, "The question queue did not load")}
          </p>
        ) : null}
        {waiting ? <LoadingIndicator label="Loading questions" /> : null}
      </div>
    </DrillCard>
  );
}
