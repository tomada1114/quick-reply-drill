import type { ReactElement } from "react";

import type { DrillRecord } from "@/core/records";
import { totalScore } from "@/core/scoring";

interface SparklineProps {
  /** Newest first, current rubric version only — the same rows the table shows. */
  readonly records: readonly DrillRecord[];
}

/** Below this many records there is no trend to draw; the lock hides the sparkline entirely. */
export const MIN_SPARKLINE_RECORDS = 2;

const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 40;
const INSET = 4;
/** The total is always 0-100, so the vertical scale is fixed rather than fit to the data. */
const MAX_TOTAL = 100;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** One point per total, evenly spaced left to right. Callers only ever pass 2 or more. */
function toPoints(totals: readonly number[]): Point[] {
  const span = totals.length - 1;
  return totals.map((total, index) => ({
    x: INSET + (index / span) * (VIEW_WIDTH - 2 * INSET),
    y: VIEW_HEIGHT - INSET - (total / MAX_TOTAL) * (VIEW_HEIGHT - 2 * INSET),
  }));
}

function toPath(points: readonly Point[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${String(point.x)},${String(point.y)}`,
    )
    .join(" ");
}

/**
 * The one monochrome sparkline the lock allows: an ink stroke, no fill, no
 * gridlines, no axis, and a 3px ink dot on the latest point.
 *
 * @remarks
 * `records` arrives newest first, matching every other list in this
 * application; this component reverses it once, internally, so the drawn
 * path always reads oldest → newest, left to right — that reversal is not the
 * caller's to remember.
 */
export function Sparkline({ records }: SparklineProps): ReactElement | null {
  if (records.length < MIN_SPARKLINE_RECORDS) {
    return null;
  }

  const oldestFirst = [...records].reverse();
  const totals = oldestFirst.map((record) => totalScore(record.scores));
  const points = toPoints(totals);
  const latest = points.at(-1);
  if (latest === undefined) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`}
      role="img"
      aria-label="Total score trend"
      className="h-10 w-full max-w-[240px]"
    >
      <path
        d={toPath(points)}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={1.5}
      />
      <circle cx={latest.x} cy={latest.y} r={3} fill="var(--color-ink)" />
    </svg>
  );
}
