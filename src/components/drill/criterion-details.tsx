import type { ReactElement } from "react";

import { CRITERIA } from "@/core/rubric";
import type { DrillRecord } from "@/core/records";
import { criterionScores } from "@/core/scoring";
import { BODY_TEXT_CLASS_NAME } from "@/components/shared/format";

const MONO_BODY_CLASS_NAME =
  "font-mono text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] whitespace-nowrap text-ink";

interface CriterionDetailsProps {
  readonly record: DrillRecord;
}

/**
 * One native disclosure per criterion, closed by default: the summary row
 * keeps the criterion and its subtotal visible, and opening it shows the two
 * sub-scores and the criterion's comment. `<details>` needs no script to
 * toggle and is keyboard-operable as rendered.
 */
export function CriterionDetails({ record }: CriterionDetailsProps): ReactElement {
  const scores = criterionScores(record.scores);
  return (
    <div className="flex flex-col">
      {CRITERIA.map((criterion) => (
        <details
          key={criterion.id}
          className="group border-b border-rule last:border-b-0"
        >
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 rounded-control py-3 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="font-mono text-micro text-slate transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              <span className="font-sans text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] font-medium text-ink">
                {criterion.label}
              </span>
            </span>
            <span className={MONO_BODY_CLASS_NAME}>{scores[criterion.id]} / 10</span>
          </summary>
          <div className="flex flex-col gap-1 pb-4 pl-5">
            {criterion.items.map((item) => (
              <div
                key={item.id}
                className="flex items-baseline justify-between gap-3 border-t border-rule pt-1"
              >
                <span className={BODY_TEXT_CLASS_NAME}>{item.label}</span>
                <span className={MONO_BODY_CLASS_NAME}>
                  {record.scores[item.id]} / 5
                </span>
              </div>
            ))}
            <p className={`${BODY_TEXT_CLASS_NAME} mt-2 mb-0`}>
              {record.comments[criterion.id]}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
