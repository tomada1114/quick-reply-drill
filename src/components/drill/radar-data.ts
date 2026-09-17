import { CRITERIA, type CriterionId, type ItemId } from "@/core/rubric";

/** One axis of the feedback radar: a rubric item and the criterion it belongs to. */
export interface RadarAxis {
  readonly itemId: ItemId;
  /** The criterion's short mono micro-label, drawn above the item on the axis. */
  readonly group: string;
  /** The item's short label, drawn on the axis. */
  readonly label: string;
  readonly score: number;
}

// The rubric's own labels run to six words ("Collocation, no translated-sounding
// phrasing"), which cannot sit around a radar at phone width. These are the
// axis names only; the collapsed detail sections still show the full labels.
const GROUP_LABELS = {
  conversation: "FLOW",
  accuracy: "ACCURACY",
  vocabulary: "VOCABULARY",
  appropriateness: "FIT",
} as const satisfies Record<CriterionId, string>;

const AXIS_LABELS = {
  respondsToPartner: "Responds",
  keepsItGoing: "Keeps going",
  grammar: "Grammar",
  spellingPunctuation: "Spelling",
  wordChoice: "Word choice",
  collocation: "Collocation",
  toneRegister: "Tone",
  chatForm: "Chat form",
} as const satisfies Record<ItemId, string>;

/** The eight axes in rubric order, so each criterion's two items sit side by side. */
export function toRadarAxes(scores: Readonly<Record<ItemId, number>>): RadarAxis[] {
  return CRITERIA.flatMap((criterion) =>
    criterion.items.map((item) => ({
      itemId: item.id,
      group: GROUP_LABELS[criterion.id],
      label: AXIS_LABELS[item.id],
      score: scores[item.id],
    })),
  );
}

/**
 * The chart's text equivalent: every sub-score by its full rubric label, so a
 * screen reader hears what the shape shows without opening a section.
 */
export function describeRadar(scores: Readonly<Record<ItemId, number>>): string {
  const parts = CRITERIA.flatMap((criterion) =>
    criterion.items.map((item) => `${item.label} ${scores[item.id].toString()} of 5`),
  );
  return `Sub-scores out of 5: ${parts.join(", ")}.`;
}
