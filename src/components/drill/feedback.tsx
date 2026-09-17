import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type { DrillRecord } from "@/core/records";
import { scoreDelta, totalScore } from "@/core/scoring";
import { DrillCard, DrillDivider } from "@/components/shared/card";

import { CriterionDetails } from "./criterion-details";
import { ScoreRadar } from "./score-radar";

interface FeedbackProps {
  readonly record: DrillRecord;
  /** The rep before this one, for the score delta — absent for the first rep. */
  readonly previous?: DrillRecord | undefined;
  readonly onNext: () => void;
  /**
   * Set when this record could not be written to local storage. Shown as a
   * plain, non-blocking notice below the total — never a reason to withhold
   * the feedback itself, which the learner's already-graded score earned
   * regardless of whether it persisted.
   */
  readonly saveError: unknown;
}

/** `+3 ▲` / `-2 ▼` / `±0`, mono and monochrome — never a colored chip. */
function formatDelta(delta: number): string {
  if (delta > 0) {
    return `+${delta.toString()} ▲`;
  }
  if (delta < 0) {
    return `${delta.toString()} ▼`;
  }
  return "±0";
}

/**
 * The feedback screen: the total alone at the top, the eight sub-scores as a
 * monochrome radar to look at before anything is read, each criterion's
 * sub-scores and comment in a disclosure that starts closed, the model reply
 * in its own rule-bounded block, and the one filled `Next` action in the
 * footer — the same position `Send` held on the drill card, so the rep loop
 * never moves the pointer.
 */
export function Feedback({
  record,
  previous,
  onNext,
  saveError,
}: FeedbackProps): ReactElement {
  const total = totalScore(record.scores);
  const delta =
    previous?.rubricVersion === record.rubricVersion
      ? scoreDelta(record.scores, previous.scores)
      : undefined;

  return (
    <DrillCard>
      <div className="flex items-baseline gap-3">
        <span className="font-mono font-semibold text-figure text-ink">{total}</span>
        <span className="font-mono text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] text-slate">
          /100
        </span>
        {delta !== undefined ? (
          <span className="font-mono text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] text-ink">
            {formatDelta(delta)}
          </span>
        ) : null}
        {record.forcedSubmit ? (
          <span className="font-mono text-micro uppercase text-status">FORCED</span>
        ) : null}
      </div>
      {saveError !== undefined ? (
        <p className="font-sans text-caption text-slate">
          This score was not saved to your local history.
        </p>
      ) : null}
      <DrillDivider />
      <ScoreRadar scores={record.scores} />
      <CriterionDetails record={record} />
      {record.modelReply !== "" ? (
        <div className="flex flex-col gap-2 rounded-card border border-rule p-4">
          <p className="font-mono text-micro uppercase text-slate">MODEL REPLY</p>
          <p className="font-sans text-body-lg text-(color:--color-body)">
            {record.modelReply}
          </p>
        </div>
      ) : null}
      <DrillDivider />
      <div className="flex justify-end">
        <Button onClick={onNext} className="w-full min-[720px]:w-auto">
          Next
        </Button>
      </div>
    </DrillCard>
  );
}
