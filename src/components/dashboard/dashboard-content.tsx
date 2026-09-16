import type { ReactElement } from "react";

import { DrillDivider } from "@/components/drill/card";
import type { DrillRecord } from "@/core/records";
import { MAX_DASHBOARD_RECORDS } from "@/core/wire";

import { buildDashboardView } from "./dashboard-view";
import { RunsTable } from "./runs-table";
import { MIN_SPARKLINE_RECORDS, Sparkline } from "./sparkline";
import { SummaryPanel } from "./summary-panel";

interface DashboardContentProps {
  readonly records: readonly DrillRecord[];
}

/** The newest rows this screen shows before older reps drop off entirely. */
const TABLE_ROW_LIMIT = 20;

/**
 * The body a non-empty dashboard shows: the recent-runs table (the newest
 * rubric version, then one section per older version), the total's
 * sparkline, and the AI summary control.
 *
 * @remarks
 * Split out of `dashboard.tsx` to stay under `eslint.config.mjs`'s per-file
 * size budget.
 */
export function DashboardContent({ records }: DashboardContentProps): ReactElement {
  const view = buildDashboardView(records, TABLE_ROW_LIMIT, MAX_DASHBOARD_RECORDS);

  return (
    <>
      <RunsTable records={view.current} />
      {view.older.map((group) => (
        <div key={group.rubricVersion} className="flex flex-col gap-3">
          <DrillDivider />
          <p className="font-mono text-micro uppercase text-slate">
            RUBRIC {group.rubricVersion}
          </p>
          <RunsTable records={group.records} />
        </div>
      ))}
      {view.current.length >= MIN_SPARKLINE_RECORDS ? (
        <>
          <DrillDivider />
          <Sparkline records={view.current} />
        </>
      ) : null}
      <DrillDivider />
      <SummaryPanel records={view.summaryCandidates} />
    </>
  );
}
