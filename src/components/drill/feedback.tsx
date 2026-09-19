import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type { DrillRecord } from "@/core/records";
import { scoreDelta, totalScore } from "@/core/scoring";
import { Caption } from "@/components/shared/caption";
import { DrillCard, DrillDivider } from "@/components/shared/card";
import { DeltaChip } from "@/components/shared/score-chip";

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

/**
 * The feedback screen: the total alone at the top, the eight sub-scores as a
 * radar to look at before anything is read, each criterion's
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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-3">
          <span className="font-mono font-semibold text-figure text-ink">{total}</span>
          <span className="font-mono text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] text-slate">
            /100
          </span>
          {record.forcedSubmit ? (
            <span className="font-mono text-micro uppercase text-status">FORCED</span>
          ) : null}
        </span>
        {delta !== undefined ? <DeltaChip delta={delta} /> : null}
      </div>
      {saveError !== undefined ? (
        <Caption>This score was not saved to your local history.</Caption>
      ) : null}
      <DrillDivider />
      <ScoreRadar scores={record.scores} />
      <CriterionDetails record={record} />
      {record.modelReply !== "" ? (
        <div className="flex flex-col gap-2">
          <p className="mb-0 font-mono text-micro uppercase text-link">MODEL REPLY</p>
          <p className="mb-0 rounded-control bg-inset px-3.5 py-3 font-sans text-body-lg text-(color:--color-body)">
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
