import * as z from "zod";

import {
  CRITERIA,
  ITEM_IDS,
  SCORE_LEVELS,
  type CriterionId,
  type ItemId,
} from "./rubric";

/** One item's verdict: the reasoning first, then the level it justifies. */
const scoreItem = z.object({
  // No `.max()` — `maxLength` is unguaranteed under strict mode, see `score`
  // below. Bounded by truncation instead, in `scoring.ts`'s `MAX_GRADER_PROSE_LENGTH`.
  rationale: z.string(),
  // `z.literal` of the six levels converts to a numeric `enum`, which the
  // provider's strict JSON Schema mode accepts. A `.min()`/`.max()` pair would
  // rely on `minimum`/`maximum`, which strict mode does not guarantee.
  score: z.literal([...SCORE_LEVELS]),
});

/**
 * The ceilings `POST /api/score` accepts, in characters once trimmed.
 *
 * @remarks
 * Each one bounds the input tokens a single grading call can be billed for,
 * and each is sized to what the screen actually sends: a generated question
 * and its one-line scenario caption, and a reply the drill asks for in one or
 * two sentences. Raising one is a cost decision, not a formality.
 */
export const MAX_SCORE_QUESTION_LENGTH = 300;

/** @see {@link MAX_SCORE_QUESTION_LENGTH} */
export const MAX_SCORE_SCENARIO_LINE_LENGTH = 200;

/** @see {@link MAX_SCORE_QUESTION_LENGTH} */
export const MAX_SCORE_ANSWER_LENGTH = 600;

/** The JSON body `POST /api/score` accepts. */
export const scoreRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_SCORE_QUESTION_LENGTH),
  scenarioLine: z.string().trim().max(MAX_SCORE_SCENARIO_LINE_LENGTH),
  answer: z.string().trim().min(1).max(MAX_SCORE_ANSWER_LENGTH),
});

/**
 * The eight item results, keyed by {@link ITEM_IDS} in rubric order.
 *
 * @remarks
 * Built from the rubric rather than retyped, so an item added there cannot be
 * left out of what the model is asked for. The assertion restates only what
 * `ITEM_IDS` already guarantees — it is `readonly ItemId[]` covering the whole
 * union — and the scoring suite pins both the key set and its order.
 */
export const scoreItemsSchema = z.object(
  Object.fromEntries(ITEM_IDS.map((id) => [id, scoreItem])) as Record<
    ItemId,
    typeof scoreItem
  >,
);

/** One comment per criterion, keyed by {@link CRITERIA} in rubric order. */
export const scoreCommentsSchema = z.object(
  Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, z.string()])) as Record<
    CriterionId,
    z.ZodString
  >,
);

/** The JSON body `POST /api/score` answers with. */
export const scoreResponseSchema = z.object({
  rubricVersion: z.string(),
  model: z.object({ alias: z.string(), reasoningEffort: z.string() }),
  items: scoreItemsSchema,
  comments: scoreCommentsSchema,
  modelReply: z.string(),
});

/** The request body {@link scoreRequestSchema} accepts. */
export type ScoreRequest = z.infer<typeof scoreRequestSchema>;

/** The answer body {@link scoreResponseSchema} describes. */
export type ScoreResponse = z.infer<typeof scoreResponseSchema>;
