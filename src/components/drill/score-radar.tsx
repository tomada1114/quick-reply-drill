"use client";

import type { ReactElement } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

import {
  itemLevel,
  LEVEL_MARK_COLOR,
  LEVEL_MARK_RING_COLOR,
  ScoreChip,
} from "@/components/shared/score-chip";
import { ChartContainer } from "@/components/ui/chart";
import type { ItemId } from "@/core/rubric";

import { describeRadar, toRadarAxes, type RadarAxis } from "./radar-data";

interface ScoreRadarProps {
  readonly scores: Readonly<Record<ItemId, number>>;
}

interface AxisTickProps {
  readonly x?: number | string;
  readonly y?: number | string;
  readonly cy?: number | string;
  readonly textAnchor?: string;
  readonly index?: number;
  readonly axes: readonly RadarAxis[];
}

interface VertexDotProps {
  readonly cx?: number;
  readonly cy?: number;
  readonly payload?: { readonly score?: number };
}

/**
 * `dy` for the two lines, in px: stacked away from the centre, so an axis
 * label never sits on the dot at the end of its own spoke.
 */
function lineOffsets(y: number, cy: number): readonly [number, number] {
  if (y < cy - 1) {
    return [-14, 12];
  }
  if (y > cy + 1) {
    return [12, 14];
  }
  return [-3, 14];
}

/** Two lines per axis: the criterion micro-label in slate, the item in ink. */
function AxisTick({
  x,
  y,
  cy,
  textAnchor,
  index,
  axes,
}: AxisTickProps): ReactElement | null {
  const axis = index === undefined ? undefined : axes[index];
  if (axis === undefined) {
    return null;
  }
  const anchor = textAnchor === "start" || textAnchor === "end" ? textAnchor : "middle";
  const [groupDy, labelDy] = lineOffsets(Number(y), Number(cy));
  return (
    <text x={x} y={y} textAnchor={anchor} data-slot="radar-axis" className="font-mono">
      <tspan
        x={x}
        dy={groupDy}
        fontSize={11}
        letterSpacing="0.08em"
        fill="var(--color-slate)"
      >
        {axis.group}
      </tspan>
      <tspan x={x} dy={labelDy} fontSize={12} fill="var(--color-ink)">
        {axis.label}
      </tspan>
    </text>
  );
}

/**
 * The verdict on one corner: a dot in that sub-score's level colour.
 *
 * @remarks
 * Always ringed in the level's own ink — `--color-mid` alone is 2.0:1 on
 * paper, below the 3:1 a graphic needs to be seen at all.
 */
function VertexDot({ cx, cy, payload }: VertexDotProps): ReactElement | null {
  if (cx === undefined || cy === undefined || payload?.score === undefined) {
    return null;
  }
  const level = itemLevel(payload.score);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill={LEVEL_MARK_COLOR[level]}
      stroke={LEVEL_MARK_RING_COLOR[level]}
      strokeWidth={1.5}
    />
  );
}

/**
 * The eight sub-scores as one radar: the learner's shape in theme green on a
 * tinted grid, and each vertex dot in the level colour of the sub-score it
 * sits on — the outline is "you", the corners are the verdict.
 *
 * @remarks
 * The drawing is decorative to assistive technology: the wrapper is a single
 * `img` whose accessible name states every sub-score, and the legend below it
 * names each level in words.
 *
 * The outer ring is drawn as a constant `max` series rather than by the grid:
 * `PolarGrid` styles all of its rings alike, and the lock wants the inner ones
 * dotted with the outer one solid. For the same reason the grid is two
 * elements — one for the dotted rings, one for the solid spokes.
 */
export function ScoreRadar({ scores }: ScoreRadarProps): ReactElement {
  const axes = toRadarAxes(scores);
  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={describeRadar(scores)} className="w-full">
        <ChartContainer className="mx-auto aspect-square max-h-[320px] w-full max-w-[320px]">
          <RadarChart data={axes} outerRadius="62%" accessibilityLayer={false}>
            <PolarGrid
              gridType="polygon"
              radialLines={false}
              stroke="var(--color-tint-strong)"
              strokeDasharray="1.5 3"
            />
            <PolarGrid
              gridType="polygon"
              polarRadius={[]}
              stroke="var(--color-tint-strong)"
            />
            <PolarRadiusAxis
              domain={[0, 5]}
              tickCount={6}
              tick={false}
              axisLine={false}
            />
            <PolarAngleAxis
              dataKey="label"
              tick={(props: Omit<AxisTickProps, "axes">) => (
                <AxisTick {...props} axes={axes} />
              )}
            />
            <Radar
              dataKey="max"
              stroke="var(--color-tint-strong)"
              strokeWidth={1}
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
            <Radar
              dataKey="score"
              stroke="var(--color-action-hover)"
              strokeWidth={2}
              strokeLinejoin="round"
              fill="var(--color-action)"
              fillOpacity={0.16}
              dot={<VertexDot />}
              isAnimationActive={false}
            />
          </RadarChart>
        </ChartContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <ScoreChip level="high">4–5 strong</ScoreChip>
        <ScoreChip level="mid">2–3 developing</ScoreChip>
        <ScoreChip level="low">0–1 focus here</ScoreChip>
      </div>
    </div>
  );
}
