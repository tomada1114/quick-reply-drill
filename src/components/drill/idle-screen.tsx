import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

import { DrillCard } from "./card";
import { describeApiError } from "./format";
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
 * finished (or has failed) by the time a rep ends. `"empty"` — the queue
 * drained and its one automatic refill attempt also failed — gets the same
 * retry affordance as `"error"`, per `use-question-queue`'s contract: neither
 * leaves the learner stuck with nothing to press.
 */
export function IdleScreen({
  status,
  error,
  onStart,
  onRetry,
}: IdleScreenProps): ReactElement {
  const blocked = status === "error" || status === "empty";

  return (
    <DrillCard>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={blocked ? onRetry : onStart}
          disabled={!blocked && status !== "ready"}
          className="w-full min-[720px]:w-auto"
        >
          {blocked ? "Retry" : "Start"}
        </Button>
        {blocked ? (
          <p className="font-sans text-caption text-slate">
            {describeApiError(error, "The question queue did not load")}
          </p>
        ) : null}
        {status === "loading" ? (
          <p className="font-sans text-caption text-slate">Loading questions…</p>
        ) : null}
      </div>
    </DrillCard>
  );
}
