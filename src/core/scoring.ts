import { type CriterionId, CRITERIA, type ItemId, type Score } from "./rubric";

/** One score for each of the eight fixed rubric items. */
export type ScoreSheet = Record<ItemId, Score>;

/**
 * The percentage contribution assigned to each criterion.
 *
 * @remarks
 * Weights are percentages and are expected to sum to 100. They live in the
 * scoring module rather than in a stored record, so changing the weighting
 * policy re-scores history without changing the rubric version.
 */
export type CriterionWeights = Readonly<Record<CriterionId, number>>;

/** Equal weighting of the four criteria, used unless a caller supplies another policy. */
export const EQUAL_WEIGHTS = {
  conversation: 25,
  accuracy: 25,
  vocabulary: 25,
  appropriateness: 25,
} as const satisfies CriterionWeights;

/**
 * Sums the two item scores belonging to each criterion.
 *
 * @returns Each criterion's score on a 0–10 scale.
 */
export function criterionScores(sheet: ScoreSheet): Record<CriterionId, number> {
  return {
    conversation: sheet.respondsToPartner + sheet.keepsItGoing,
    accuracy: sheet.grammar + sheet.spellingPunctuation,
    vocabulary: sheet.wordChoice + sheet.collocation,
    appropriateness: sheet.toneRegister + sheet.chatForm,
  };
}

/**
 * Calculates the weighted rubric score on a 0–100 scale.
 *
 * @remarks
 * Each criterion contributes its 0–10 score scaled by its percentage weight.
 * The final fractional point is rounded with {@link Math.round}; callers
 * therefore receive the integer shown in the feedback UI.
 */
export function totalScore(
  sheet: ScoreSheet,
  weights: CriterionWeights = EQUAL_WEIGHTS,
): number {
  const scores = criterionScores(sheet);
  const weighted = CRITERIA.reduce(
    (total, criterion) => total + (scores[criterion.id] / 10) * weights[criterion.id],
    0,
  );
  return Math.round(weighted);
}

/** Returns the displayed change from a previous score sheet to the current one. */
export function scoreDelta(current: ScoreSheet, previous: ScoreSheet): number {
  return totalScore(current) - totalScore(previous);
}
