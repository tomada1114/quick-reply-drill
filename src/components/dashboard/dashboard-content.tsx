import type { ReactElement } from "react";

import type { DrillRecord } from "@/core/records";
import { totalScore } from "@/core/scoring";
import { MAX_DASHBOARD_RECORDS } from "@/core/wire";
import { DrillDivider } from "@/components/shared/card";
import { DeltaChip } from "@/components/shared/score-chip";

import { buildDashboardView } from "./dashboard-view";
import { RunsTable } from "./runs-table";
import { MIN_SPARKLINE_RECORDS, Sparkline } from "./sparkline";
import { SummaryPanel } from "./summary-panel";

interface DashboardContentProps {
  readonly records: readonly DrillRecord[];
}

/** The newest rows this screen shows before older reps drop off entirely. */
const TABLE_ROW_LIMIT = 20;

/** The change across the whole window the trend chart draws, oldest to newest. */
function windowDelta(records: readonly DrillRecord[]): number | undefined {
  const newest = records[0];
  const oldest = records.at(-1);
  if (newest === undefined || oldest === undefined || newest === oldest) {
    return undefined;
  }
  return totalScore(newest.scores) - totalScore(oldest.scores);
}

/**
 * The body a non-empty dashboard shows: the total's trend chart under its
 * micro-label, the recent-runs heat table (the newest rubric version, then
 * one section per older version), and the AI summary control.
 *
 * @remarks
 * The trend comes first because it is the one thing on this screen that
 * reads before it is read; the table is the detail behind it.
 *
 * Split out of `dashboard.tsx` to stay under `eslint.config.mjs`'s per-file
 * size budget.
 */
export function DashboardContent({ records }: DashboardContentProps): ReactElement {
  const view = buildDashboardView(records, TABLE_ROW_LIMIT, MAX_DASHBOARD_RECORDS);
  const delta = windowDelta(view.current);

  return (
    <>
      {view.current.length >= MIN_SPARKLINE_RECORDS ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="mb-0 font-mono text-micro uppercase text-link">
              TOTAL · LAST {view.current.length} REPS
            </p>
            {delta === undefined ? null : (
              <DeltaChip delta={delta} note="since first" />
            )}
          </div>
          <Sparkline records={view.current} />
          <DrillDivider />
        </div>
      ) : null}
      <RunsTable records={view.current} />
      {view.older.map((group) => (
        <div key={group.rubricVersion} className="flex flex-col gap-3">
          <DrillDivider />
          <p className="mb-0 font-mono text-micro uppercase text-link">
            RUBRIC {group.rubricVersion}
          </p>
          <RunsTable records={group.records} />
        </div>
      ))}
      <DrillDivider />
      <SummaryPanel records={view.summaryCandidates} />
    </>
  );
}
