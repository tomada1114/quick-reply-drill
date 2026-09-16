import type { DrillRecord } from "@/core/records";
import type { DashboardRecord } from "@/core/wire";

/** One rubric version's records, shown in their own section, newest first. */
export interface DashboardVersionGroup {
  readonly rubricVersion: string;
  readonly records: DrillRecord[];
}

/** The three views of a learner's history the dashboard screen renders. */
export interface DashboardView {
  /** Newest-first records under the newest rubric version, capped at the table's row limit. */
  readonly current: DrillRecord[];
  /** Older rubric versions found within that same window, newest group first, each newest-first. */
  readonly older: readonly DashboardVersionGroup[];
  /** The newest same-version records `POST /api/dashboard` may be asked to summarise. */
  readonly summaryCandidates: DrillRecord[];
}

/**
 * Orders two records by the instant `recordedAt` actually names, never by
 * comparing the strings themselves.
 *
 * @remarks
 * `records-store.ts`'s "newest first" is an insertion-order guarantee, not a
 * guarantee about `recordedAt` itself, and a bare string comparison would
 * rank a non-UTC offset or a differently-precise timestamp wrong even when
 * every value is individually a legal ISO 8601 datetime. `Date.parse`
 * resolves each to the instant it names before either is compared.
 */
function byRecordedAtDescending(a: DrillRecord, b: DrillRecord): number {
  return Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
}

/**
 * Groups `records` for the dashboard screen: the newest rubric version's rows
 * (the recent-runs table's main columns), the older versions split into their
 * own sections, and the bounded window `POST /api/dashboard` may be asked to
 * summarise.
 *
 * @remarks
 * `summaryCandidates` is drawn from the whole of `records`, not only the
 * `tableLimit` window: the table caps rows for legibility, while the summary
 * is capped at `summaryLimit` (the wire contract's own ceiling)
 * independently, so a learner with more than `tableLimit` reps still gets a
 * summary built from their most recent same-version ones.
 */
export function buildDashboardView(
  records: readonly DrillRecord[],
  tableLimit: number,
  summaryLimit: number,
): DashboardView {
  const sorted = [...records].sort(byRecordedAtDescending);
  const [newest] = sorted;
  const newestVersion = newest?.rubricVersion;

  const summaryCandidates = sorted
    .filter((record) => record.rubricVersion === newestVersion)
    .slice(0, summaryLimit);

  const windowed = sorted.slice(0, tableLimit);
  const current: DrillRecord[] = [];
  const olderOrder: string[] = [];
  const olderByVersion = new Map<string, DrillRecord[]>();

  for (const record of windowed) {
    if (record.rubricVersion === newestVersion) {
      current.push(record);
      continue;
    }
    const existing = olderByVersion.get(record.rubricVersion);
    if (existing === undefined) {
      olderByVersion.set(record.rubricVersion, [record]);
      olderOrder.push(record.rubricVersion);
    } else {
      existing.push(record);
    }
  }

  const older = olderOrder.map((rubricVersion) => ({
    rubricVersion,
    records: olderByVersion.get(rubricVersion) ?? [],
  }));

  return { current, older, summaryCandidates };
}

/** Trims a `DrillRecord` to what `POST /api/dashboard`'s wire contract accepts. */
export function toDashboardRecord(record: DrillRecord): DashboardRecord {
  return {
    recordedAt: record.recordedAt,
    question: {
      text: record.question.text,
      scenarioLine: record.question.scenarioLine,
    },
    answer: record.answer,
    scores: record.scores,
    comments: record.comments,
    rubricVersion: record.rubricVersion,
  };
}

/**
 * `recordedAt` as a short `YYYY-MM-DD HH:mm` reading.
 *
 * @remarks
 * A plain slice of the ISO string rather than `Intl.DateTimeFormat` or a
 * `Date`-based format: `writing-tests` rules out a dependence on the runner's
 * timezone or locale, and every `recordedAt` this application writes is
 * already a UTC instant (`new Date().toISOString()`), so slicing it reads the
 * same wall-clock figure everywhere this runs.
 */
export function formatRecordedAt(recordedAt: string): string {
  return recordedAt.slice(0, 16).replace("T", " ");
}
