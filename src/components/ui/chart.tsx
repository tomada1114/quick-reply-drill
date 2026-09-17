"use client";

import type { ComponentProps, ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/components/lib/utils";

// Copied from the shadcn/ui registry (`chart`, new-york-v4) and cut down to its
// container, restyled to the lock in `.agents/skills/designing-ui/SKILL.md`:
// the chart is monochrome, so the registry's `ChartConfig` color map, the
// injected `<style>` that turns it into `--color-<key>` variables, and the
// tooltip and legend (both colored swatches, and a legend is on the lock's
// reject list for a chart that should read at a glance) are dropped rather
// than restyled. What stays is the container's job: a sized box around
// Recharts' `ResponsiveContainer`, with the registry's `[stroke='#ccc']`
// overrides pointed at this theme's `--color-rule` instead of shadcn's
// `border` token, which this theme never defines.

/** Used until Recharts has measured the box, and on the server. */
const INITIAL_DIMENSION = { width: 320, height: 320 } as const;

interface ChartContainerProps extends Omit<ComponentProps<"div">, "children"> {
  readonly children: ComponentProps<typeof ResponsiveContainer>["children"];
  readonly initialDimension?: { readonly width: number; readonly height: number };
}

function ChartContainer({
  className,
  children,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: ChartContainerProps): ReactElement {
  return (
    <div
      data-slot="chart"
      className={cn(
        "flex justify-center font-mono text-micro [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-rule [&_.recharts-surface]:overflow-visible [&_.recharts-surface]:outline-hidden",
        className,
      )}
      {...props}
    >
      <ResponsiveContainer initialDimension={initialDimension}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export { ChartContainer };
