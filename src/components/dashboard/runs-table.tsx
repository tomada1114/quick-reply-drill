import type { ReactElement } from "react";

import type { DrillRecord } from "@/core/records";
import { CRITERIA, type CriterionId } from "@/core/rubric";
import { criterionScores, totalScore } from "@/core/scoring";

import { formatRecordedAt } from "./dashboard-view";

/** The mono micro-label each criterion column heads with — the lock's "abbreviated" columns. */
const CRITERION_ABBREVIATIONS: Record<CriterionId, string> = {
  conversation: "CON",
  accuracy: "ACC",
  vocabulary: "VOC",
  appropriateness: "APP",
};

interface RunsTableProps {
  /** Newest first. */
  readonly records: readonly DrillRecord[];
}

const HEADER_CELL_CLASS_NAME =
  "border-b border-rule px-3 py-2 text-right font-mono text-micro uppercase text-slate first:pl-0 first:text-left last:pr-0";

const BODY_CELL_CLASS_NAME =
  "px-3 py-2 text-right text-ink first:pl-0 first:text-left last:pr-0";

/**
 * The recent-runs table: one mono row per rep, newest first, the four
 * criterion scores under their mono micro-labels, and the total with a
 * `FORCED` tag where the clock forced the reply through empty.
 *
 * @remarks
 * Wrapped in its own horizontally scrolling container — never the page —
 * because six columns of mono figures do not fit a phone-width viewport.
 * `overflow-x-auto` on this div, paired with the table's own `min-width`,
 * is what keeps a narrow screen's horizontal scroll inside this box rather
 * than on the page itself; see the `#17` footer bug this repeats the fix for.
 */
export function RunsTable({ records }: RunsTableProps): ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse font-mono text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)]">
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL_CLASS_NAME}>
              DATE
            </th>
            {CRITERIA.map((criterion) => (
              <th key={criterion.id} scope="col" className={HEADER_CELL_CLASS_NAME}>
                {CRITERION_ABBREVIATIONS[criterion.id]}
              </th>
            ))}
            <th scope="col" className={HEADER_CELL_CLASS_NAME}>
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const scores = criterionScores(record.scores);
            return (
              <tr key={record.id} className="border-t border-rule">
                <td className={BODY_CELL_CLASS_NAME}>
                  {formatRecordedAt(record.recordedAt)}
                </td>
                {CRITERIA.map((criterion) => (
                  <td key={criterion.id} className={BODY_CELL_CLASS_NAME}>
                    {scores[criterion.id]}
                  </td>
                ))}
                <td className={BODY_CELL_CLASS_NAME}>
                  {totalScore(record.scores)}
                  {record.forcedSubmit ? (
                    <span className="ml-2 text-micro uppercase text-status">
                      FORCED
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
