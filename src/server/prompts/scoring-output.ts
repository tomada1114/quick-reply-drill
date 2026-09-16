import * as z from "zod";

import { scoreCommentsSchema, scoreItemsSchema } from "../../core/wire";

/**
 * What one graded reply comes back as.
 *
 * @remarks
 * Key order is the order the model writes, so it is the order the decision has
 * to be made in: each item's rationale before its score, every item before the
 * per-criterion comments that summarise them, and the corrected reply last,
 * once the grading it is based on exists. Nothing is optional or nullable —
 * strict structured output rejects both — so an answer that reaches a caller
 * has every field, and a shortfall in *quality* is the prompt's job.
 *
 * The two grading pieces come from `src/core/wire.ts` rather than being
 * declared here, because `POST /api/score` hands them straight on to its
 * caller: two copies of this shape would be two things to keep in step.
 */
export const scoringOutputSchema = z.object({
  items: scoreItemsSchema,
  comments: scoreCommentsSchema,
  modelReply: z.string(),
});

/** What the grader answers with, once validated against {@link scoringOutputSchema}. */
export type ScoringOutput = z.infer<typeof scoringOutputSchema>;

/**
 * The character ceiling every item's `rationale` and every criterion's
 * comment is truncated to once the grader has answered.
 */
export const MAX_GRADER_PROSE_LENGTH = 300;

/** `value`, cut to {@link MAX_GRADER_PROSE_LENGTH}, never between a surrogate pair. */
function truncateProse(value: string): string {
  const last = value.charCodeAt(MAX_GRADER_PROSE_LENGTH - 1);
  const end = MAX_GRADER_PROSE_LENGTH - (last >= 0xd800 && last <= 0xdbff ? 1 : 0);
  return value.length > MAX_GRADER_PROSE_LENGTH ? value.slice(0, end) : value;
}

/**
 * Bounds every rationale and comment in a graded answer to
 * {@link MAX_GRADER_PROSE_LENGTH}, in place of trusting the model to.
 *
 * @remarks
 * `scoringOutputSchema` carries no `.max()` on these fields on purpose — see
 * the comment beside `scoreItem` in `src/core/wire-score.ts` for why a length
 * ceiling in the structured-output schema is not safe here. This is the bound
 * instead: applied to the answer once it has already passed schema validation,
 * so the answer is always within what `POST /api/dashboard` accepts back.
 */
export function truncateGraderProse(output: ScoringOutput): ScoringOutput {
  return {
    ...output,
    items: Object.fromEntries(
      Object.entries(output.items).map(([id, item]) => [
        id,
        { ...item, rationale: truncateProse(item.rationale) },
      ]),
    ) as ScoringOutput["items"],
    comments: Object.fromEntries(
      Object.entries(output.comments).map(([id, comment]) => [
        id,
        truncateProse(comment),
      ]),
    ) as ScoringOutput["comments"],
  };
}
