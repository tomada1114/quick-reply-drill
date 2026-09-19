import type { ReactElement } from "react";

import type { DrillRecord } from "@/core/records";
import { totalScore } from "@/core/scoring";

interface SparklineProps {
  /** Newest first, current rubric version only — the same rows the table shows. */
  readonly records: readonly DrillRecord[];
}

/** Below this many records there is no trend to draw; the lock hides the chart entirely. */
export const MIN_SPARKLINE_RECORDS = 2;

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 110;
/** Left inset, and the room the right-hand gridline labels need. */
const INSET_X = 8;
const LABEL_GUTTER = 30;
const INSET_TOP = 10;
const INSET_BOTTOM = 10;
/** The total is always 0-100, so the vertical scale is fixed rather than fit to the data. */
const MAX_TOTAL = 100;
/** The two readings the dotted gridlines mark. */
const GRIDLINES = [50, 100] as const;
const GRADIENT_ID = "trend-area-fill";

interface Point {
  readonly x: number;
  readonly y: number;
}

function toY(total: number): number {
  return (
    VIEW_HEIGHT -
    INSET_BOTTOM -
    (total / MAX_TOTAL) * (VIEW_HEIGHT - INSET_TOP - INSET_BOTTOM)
  );
}

/** One point per total, evenly spaced left to right. Callers only ever pass 2 or more. */
function toPoints(totals: readonly number[]): Point[] {
  const span = totals.length - 1;
  const width = VIEW_WIDTH - INSET_X - LABEL_GUTTER;
  return totals.map((total, index) => ({
    x: INSET_X + (index / span) * width,
    y: toY(total),
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
 * The total over recent reps: a theme-green stroke over an area fill that
 * fades to nothing at the baseline, on dotted gridlines at 50 and 100, with
 * the latest rep marked by a ringed dot.
 *
 * @remarks
 * The line is theme green because it draws the learner's own shape, not a
 * verdict — how good any one total is is the score scale's job, and it is the
 * delta chip beside this chart that carries it.
 *
 * The area fill is the one gradient this design system allows anywhere.
 *
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
  const first = points[0];
  if (latest === undefined || first === undefined) {
    return null;
  }
  const line = toPath(points);
  const baseline = VIEW_HEIGHT - INSET_BOTTOM;

  return (
    <div className="relative">
      {/* The gridline readings are HTML, not SVG text: this drawing scales with
          the card, and text inside it would scale too — landing near 8px on a
          phone and 15px on a wide screen, so it would never be the token size
          the type scale defines. Positioned as a percentage of the drawing's
          own height, which tracks the same scaling exactly. */}
      {GRIDLINES.map((value) => (
        <span
          key={value}
          aria-hidden="true"
          className="absolute right-0 -translate-y-1/2 font-mono text-micro text-slate"
          style={{ top: `${String((toY(value) / VIEW_HEIGHT) * 100)}%` }}
        >
          {value}
        </span>
      ))}
      <svg
        viewBox={`0 0 ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`}
        role="img"
        aria-label="Total score trend"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-action)" stopOpacity={0.28} />
            <stop offset="1" stopColor="var(--color-action)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {GRIDLINES.map((value) => (
          <line
            key={value}
            x1={INSET_X}
            x2={VIEW_WIDTH - LABEL_GUTTER}
            y1={toY(value)}
            y2={toY(value)}
            stroke="var(--color-tint-strong)"
            strokeDasharray="1.5 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={`${line} L${String(latest.x)},${String(baseline)} L${String(first.x)},${String(baseline)} Z`}
          fill={`url(#${GRADIENT_ID})`}
          stroke="none"
        />
        <path
          d={line}
          fill="none"
          stroke="var(--color-action-hover)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={latest.x}
          cy={latest.y}
          r={4.5}
          fill="var(--color-action)"
          stroke="var(--color-paper)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
