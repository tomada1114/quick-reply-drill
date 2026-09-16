import * as z from "zod";

import { ITEM_IDS, SCORE_LEVELS } from "./rubric";
import { MAX_DASHBOARD_COMMENT_LENGTH } from "./wire-dashboard";

/**
 * The version of the `localStorage` envelope this module reads and writes.
 *
 * @remarks
 * Bump this, and add the migration, the day the envelope shape changes.
 * `recordsEnvelopeSchema` accepts only this exact value, so an envelope
 * written by a future version — one this code has never seen — fails
 * validation and is treated as empty rather than misread.
 */
export const RECORDS_STORAGE_VERSION = 1;

/** The most recent records the store keeps; older ones are dropped on append. */
export const MAX_RECORDS = 50;

/**
 * One rubric item's score, encoded the same way
 * `src/server/prompts/scoring.ts`'s `scoringOutputSchema` encodes it: a
 * `z.literal` of the six levels, not a `.min()`/`.max()` pair.
 *
 * @remarks
 * `src/core` cannot import `src/server`, so this is built directly from
 * {@link SCORE_LEVELS} rather than imported from the prompt module — the two
 * are kept in step by both reading the same rubric vocabulary, not by one
 * importing the other.
 */
const scoreSchema = z.literal([...SCORE_LEVELS]);

/**
 * A value keyed by every {@link ItemId} and no other key.
 *
 * @remarks
 * `z.record` with an enum key schema is exact in this Zod version: it
 * requires every enum member to be present and rejects a key outside the
 * enum, which is what makes this `Record<ItemId, T>` rather than a partial
 * map that would silently accept a typo'd or missing item.
 */
function exactByItemId<Value extends z.ZodType>(value: Value) {
  return z.record(z.enum(ITEM_IDS), value);
}

/**
 * One completed drill attempt, as it is stored and read back.
 *
 * @remarks
 * Criterion scores and the 0–100 total are deliberately absent: they are
 * derived values `src/core/scoring.ts` computes from `scores` on read, so a
 * later change to the weighting policy re-scores stored history instead of
 * orphaning it. `model` and `rubricVersion` are carried on every record
 * because the rubric and the model behind a reply can both change over time,
 * and a comparison across two different versions of either is meaningless —
 * the dashboard has to be able to tell them apart.
 */
export const drillRecordSchema = z.object({
  /** Unique identifier, minted with `crypto.randomUUID()`. */
  id: z.string(),
  /** When the attempt was recorded, as an ISO 8601 timestamp. */
  recordedAt: z.string(),
  question: z.object({
    /** The one-line question the learner was asked. */
    text: z.string(),
    /** The one-line caption describing who is asking, and where. */
    scenarioLine: z.string(),
    /** The identifiers the question was drawn from. */
    seed: z.object({
      interlocutorId: z.string(),
      settingId: z.string(),
      topicId: z.string(),
    }),
  }),
  /** The learner's own reply, exactly as written. */
  answer: z.string(),
  /** Whether the clock reached zero before the learner submitted. */
  forcedSubmit: z.boolean(),
  /** Time spent on the attempt, in milliseconds. */
  elapsedMs: z.int().min(0),
  /** Every item's raw score, keyed by {@link ItemId}. */
  scores: exactByItemId(scoreSchema),
  /**
   * Every item's rationale, keyed by {@link ItemId}.
   *
   * @remarks
   * Bounded by {@link MAX_DASHBOARD_COMMENT_LENGTH}, the grader's own output
   * ceiling in `src/core/wire.ts` — see that module for why it shares the
   * constant `dashboardRecordSchema` holds a caller's comment to.
   */
  rationales: exactByItemId(z.string().max(MAX_DASHBOARD_COMMENT_LENGTH)),
  /** One short comment per criterion, bounded the same way `rationales` is. */
  comments: z.object({
    clarity: z.string().max(MAX_DASHBOARD_COMMENT_LENGTH),
    accuracy: z.string().max(MAX_DASHBOARD_COMMENT_LENGTH),
    vocabulary: z.string().max(MAX_DASHBOARD_COMMENT_LENGTH),
    appropriateness: z.string().max(MAX_DASHBOARD_COMMENT_LENGTH),
  }),
  /** The learner's reply, corrected and made natural. */
  modelReply: z.string(),
  /** The model that graded this attempt. */
  model: z.object({
    alias: z.string(),
    reasoningEffort: z.string(),
  }),
  /** The rubric version the score was produced under. */
  rubricVersion: z.string(),
});

/** One completed drill attempt, as it is stored and read back. */
export type DrillRecord = z.infer<typeof drillRecordSchema>;

/**
 * The whole value written under the store's `localStorage` key: a version tag
 * plus the records it tags.
 *
 * @remarks
 * `version` is a literal, not a range, on purpose: a store built by a later
 * version of this module — one this code has never validated against — fails
 * this schema and is read as empty by `records-store.ts` rather than
 * misinterpreted. A future migration (reading an older or newer envelope
 * shape forward or back) lives in that read path, once there is a second
 * version to migrate from.
 */
export const recordsEnvelopeSchema = z.object({
  version: z.literal(RECORDS_STORAGE_VERSION),
  records: z.array(drillRecordSchema),
});

/** The whole value written under the store's `localStorage` key. */
export type RecordsEnvelope = z.infer<typeof recordsEnvelopeSchema>;
