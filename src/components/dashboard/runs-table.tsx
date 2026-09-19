import type { ReactElement } from "react";

import { LEVEL_FILL_CLASS_NAME, itemLevel } from "@/components/shared/score-chip";
import type { DrillRecord } from "@/core/records";
import { ITEM_IDS, type ItemId } from "@/core/rubric";
import { totalScore } from "@/core/scoring";

import { formatRecordedAt } from "./dashboard-view";

/**
 * The mono micro-label each sub-score column heads with.
 *
 * @remarks
 * One column per rubric item rather than per criterion, and in rubric order,
 * so each criterion's two items stay adjacent and a weak item shows as its
 * own tinted stripe down the table — which a criterion's averaged subtotal
 * would hide. The same short names the radar's axes use, abbreviated further
 * because a column head has less room than an axis label.
 */
const ITEM_ABBREVIATIONS: Readonly<Record<ItemId, string>> = {
  respondsToPartner: "RESP",
  keepsItGoing: "KEEP",
  grammar: "GRAM",
  spellingPunctuation: "SPELL",
  wordChoice: "WORD",
  collocation: "COLL",
  toneRegister: "TONE",
  chatForm: "FORM",
};

interface RunsTableProps {
  /** Newest first. */
  readonly records: readonly DrillRecord[];
}

const HEADER_CELL_CLASS_NAME =
  "px-1.5 py-1 text-center font-mono text-micro uppercase font-normal text-slate first:pl-0 first:text-left last:pr-0 last:text-right";

/**
 * The recent-runs table as a heat table: one mono row per rep, newest first,
 * every sub-score cell filled with its level's tint so a weak item reads as a
 * pink stripe before a single digit is, and the total in plain ink at the
 * right with a `FORCED` tag where the clock forced the reply through.
 *
 * @remarks
 * The date column is slate and the total column is ink: neither is a
 * sub-score, so neither takes a level colour — the scale grades the eight
 * items, and the total's own standing is the trend chart's and the delta
 * chip's job above.
 *
 * Wrapped in its own horizontally scrolling container — never the page —
 * because ten columns of mono figures do not fit a phone-width viewport.
 * `overflow-x-auto` on this div, paired with the table's own `min-width`,
 * is what keeps a narrow screen's horizontal scroll inside this box rather
 * than on the page itself; see the `#17` footer bug this repeats the fix for.
 */
export function RunsTable({ records }: RunsTableProps): ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-[3px] font-mono text-caption">
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL_CLASS_NAME}>
              REP
            </th>
            {ITEM_IDS.map((itemId) => (
              <th key={itemId} scope="col" className={HEADER_CELL_CLASS_NAME}>
                {ITEM_ABBREVIATIONS[itemId]}
              </th>
            ))}
            <th scope="col" className={HEADER_CELL_CLASS_NAME}>
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td className="py-1.5 pr-1.5 text-left whitespace-nowrap text-slate">
                {formatRecordedAt(record.recordedAt)}
              </td>
              {ITEM_IDS.map((itemId) => (
                <td
                  key={itemId}
                  className={`rounded-control px-1.5 py-1.5 text-center ${LEVEL_FILL_CLASS_NAME[itemLevel(record.scores[itemId])]}`}
                >
                  {record.scores[itemId]}
                </td>
              ))}
              <td className="py-1.5 pl-1.5 text-right font-semibold whitespace-nowrap text-ink">
                {totalScore(record.scores)}
                {record.forcedSubmit ? (
                  <span className="ml-2 text-micro uppercase text-status">FORCED</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
