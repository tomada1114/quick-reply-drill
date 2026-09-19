import type { ReactElement, ReactNode } from "react";

import { cn } from "@/components/lib/utils";

/**
 * The score scale's three steps: how good a figure is, and nothing else.
 *
 * @remarks
 * Deliberately not the theme green and not the countdown's red — see the
 * colour role rules in `designing-ui`. A level never travels alone: every
 * caller here renders it behind a digit or a glyph.
 */
export type ScoreLevel = "high" | "mid" | "low";

/** A rubric item's 0-5 score as a level: 4-5 high, 2-3 mid, 0-1 low. */
export function itemLevel(score: number): ScoreLevel {
  if (score >= 4) return "high";
  return score >= 2 ? "mid" : "low";
}

/** A criterion's 0-10 subtotal as a level: 8-10 high, 4-7 mid, 0-3 low. */
export function criterionLevel(score: number): ScoreLevel {
  if (score >= 8) return "high";
  return score >= 4 ? "mid" : "low";
}

/**
 * Each level's tint-and-ink pair, written out rather than interpolated:
 * Tailwind scans source text for whole class names, so a `bg-${level}-tint`
 * template would compile to no CSS at all.
 */
export const LEVEL_FILL_CLASS_NAME: Readonly<Record<ScoreLevel, string>> = {
  high: "bg-high-tint text-high-ink",
  mid: "bg-mid-tint text-mid-ink",
  low: "bg-low-tint text-low-ink",
};

/** Each level's saturated mark colour, for a chart's own geometry. */
export const LEVEL_MARK_COLOR: Readonly<Record<ScoreLevel, string>> = {
  high: "var(--color-high)",
  mid: "var(--color-mid)",
  low: "var(--color-low)",
};

/** Each level's ink, used to ring a mark that would not otherwise reach 3:1. */
export const LEVEL_MARK_RING_COLOR: Readonly<Record<ScoreLevel, string>> = {
  high: "var(--color-high-ink)",
  mid: "var(--color-mid-ink)",
  low: "var(--color-low-ink)",
};

interface ScoreChipProps {
  readonly level: ScoreLevel;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * A figure on its level's tint: `4 / 5`, `7 / 10`, or a delta.
 *
 * @remarks
 * A label, not a control — no hover, no border, no pointer cursor.
 */
export function ScoreChip({
  level,
  children,
  className,
}: ScoreChipProps): ReactElement {
  return (
    <span
      className={cn(
        "inline-block rounded-control px-[9px] py-1 font-mono text-caption whitespace-nowrap",
        LEVEL_FILL_CLASS_NAME[level],
        className,
      )}
    >
      {children}
    </span>
  );
}

interface DeltaChipProps {
  readonly delta: number;
  /** Words between the figure and the glyph, e.g. `since first`. */
  readonly note?: string;
}

/**
 * A change shown as `+4 ▲` at the high level, `-2 ▼` at the low level, and
 * `±0` as plain slate text with no chip at all.
 *
 * @remarks
 * The scale's two ends are reused here because "better" and "worse" are the
 * same judgement the scale already makes. The sign and the glyph are what
 * carry the meaning; the colour is added to them, never substituted for them.
 */
export function DeltaChip({ delta, note }: DeltaChipProps): ReactElement {
  const tail = note === undefined ? "" : ` ${note}`;
  if (delta === 0) {
    return <span className="font-mono text-caption text-slate">±0{tail}</span>;
  }
  const sign = delta > 0 ? `+${delta.toString()}` : delta.toString();
  return (
    <ScoreChip level={delta > 0 ? "high" : "low"}>
      {sign}
      {tail} {delta > 0 ? "▲" : "▼"}
    </ScoreChip>
  );
}
