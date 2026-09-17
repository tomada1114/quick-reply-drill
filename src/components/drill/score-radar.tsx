"use client";

import type { ReactElement } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import type { ItemId } from "@/core/rubric";

import { describeRadar, toRadarAxes, type RadarAxis } from "./radar-data";

interface ScoreRadarProps {
  readonly scores: Readonly<Record<ItemId, number>>;
}

interface AxisTickProps {
  readonly x?: number | string;
  readonly y?: number | string;
  readonly textAnchor?: string;
  readonly index?: number;
  readonly axes: readonly RadarAxis[];
}

/** Two lines per axis: the criterion micro-label in slate, the item in ink. */
function AxisTick({
  x,
  y,
  textAnchor,
  index,
  axes,
}: AxisTickProps): ReactElement | null {
  const axis = index === undefined ? undefined : axes[index];
  if (axis === undefined) {
    return null;
  }
  const anchor = textAnchor === "start" || textAnchor === "end" ? textAnchor : "middle";
  return (
    <text x={x} y={y} textAnchor={anchor} data-slot="radar-axis" className="font-mono">
      <tspan
        x={x}
        dy="-0.2em"
        fontSize={11}
        letterSpacing="0.08em"
        fill="var(--color-slate)"
      >
        {axis.group}
      </tspan>
      <tspan x={x} dy="1.3em" fontSize={12} fill="var(--color-ink)">
        {axis.label}
      </tspan>
    </text>
  );
}

/**
 * The eight sub-scores as one monochrome radar — an ink outline on rule-grey
 * rings, one ring per score level, no fill, no animation — so a dent shows
 * the weak item before anything is read.
 *
 * @remarks
 * The drawing is decorative to assistive technology: the wrapper is a single
 * `img` whose accessible name states every sub-score.
 */
export function ScoreRadar({ scores }: ScoreRadarProps): ReactElement {
  const axes = toRadarAxes(scores);
  return (
    <div role="img" aria-label={describeRadar(scores)} className="w-full">
      <ChartContainer className="aspect-square max-h-[320px] w-full">
        <RadarChart data={axes} outerRadius="62%" accessibilityLayer={false}>
          <PolarGrid stroke="var(--color-rule)" />
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
            dataKey="score"
            stroke="var(--color-ink)"
            strokeWidth={1.5}
            fill="none"
            dot={{ r: 3, fill: "var(--color-ink)", stroke: "none" }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}
