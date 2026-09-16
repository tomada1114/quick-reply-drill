import * as z from "zod";

import { MAX_RECORDED_AT_LENGTH, recordedAtSchema } from "./records";
import { CRITERIA, ITEM_IDS, SCORE_LEVELS, type CriterionId } from "./rubric";

/**
 * `POST /api/dashboard`'s wire contract: a bounded window of past records in,
 * one trend paragraph out.
 *
 * @remarks
 * Split out of `src/core/wire.ts` once this endpoint's own per-field ceilings
 * would have pushed that file over `eslint.config.mjs`'s 200-line `max-lines`
 * budget. `wire.ts` re-exports every name below under its own module, so a
 * caller still writes `from "../../core/wire"` regardless of which file
 * actually declares it.
 *
 * `comments` below is deliberately its own bounded schema rather than a reuse
 * of `wire.ts`'s `scoreCommentsSchema`: that schema types the grader's own
 * output, which this application never bounds by length in the schema — a
 * ceiling there would land as `maxLength` in the JSON Schema the grader's
 * structured-output request is converted to, which strict mode does not
 * guarantee — while a dashboard record's `comments` arrives from a caller
 * like every other field here and has to be bounded the same way they are.
 */

/** The most records one `POST /api/dashboard` call may summarise. */
export const MAX_DASHBOARD_RECORDS = 10;

/**
 * The ceilings `POST /api/dashboard` accepts on one record's fields, in
 * characters.
 *
 * @remarks
 * `MAX_DASHBOARD_QUESTION_LENGTH`, `MAX_DASHBOARD_SCENARIO_LINE_LENGTH` and
 * `MAX_DASHBOARD_ANSWER_LENGTH` mirror the bounds `scoreRequestSchema` already
 * held the same question, scenario line and reply to on the way in, so a
 * record built from a real `POST /api/score` answer is always legal here.
 * `MAX_DASHBOARD_COMMENT_LENGTH` bounds each of the four criterion comments,
 * and `MAX_DASHBOARD_RECORDED_AT_LENGTH` and `MAX_DASHBOARD_RUBRIC_VERSION_LENGTH`
 * bound the two fields this server writes itself, generously enough for
 * either to grow a few characters without becoming a contract change.
 *
 * This one is equal to `src/core/records.ts`'s {@link MAX_RECORDED_AT_LENGTH},
 * kept under this module's own name because every other `MAX_DASHBOARD_*`
 * constant here is named for the wire contract it bounds — imported rather
 * than restated so the stored record and this wire contract cannot drift
 * apart.
 */
export const MAX_DASHBOARD_RECORDED_AT_LENGTH = MAX_RECORDED_AT_LENGTH;

/** @see {@link MAX_DASHBOARD_RECORDED_AT_LENGTH} */
export const MAX_DASHBOARD_QUESTION_LENGTH = 300;

/** @see {@link MAX_DASHBOARD_RECORDED_AT_LENGTH} */
export const MAX_DASHBOARD_SCENARIO_LINE_LENGTH = 200;

/** @see {@link MAX_DASHBOARD_RECORDED_AT_LENGTH} */
export const MAX_DASHBOARD_ANSWER_LENGTH = 600;

/** @see {@link MAX_DASHBOARD_RECORDED_AT_LENGTH} */
export const MAX_DASHBOARD_COMMENT_LENGTH = 300;

/** @see {@link MAX_DASHBOARD_RECORDED_AT_LENGTH} */
export const MAX_DASHBOARD_RUBRIC_VERSION_LENGTH = 32;

/** A `DrillRecord`, trimmed to what the dashboard's trend paragraph is written from. */
export const dashboardRecordSchema = z.object({
  /**
   * When the attempt was recorded. The same `src/core/records.ts` schema the
   * stored `DrillRecord` uses, not a second copy: `buildDashboardRequest`
   * sorts records by this field to write them out newest first, and an
   * unpinned format has no chronological meaning to sort by — a
   * caller-chosen offset would let a lexicographically-later string name an
   * earlier instant.
   */
  recordedAt: recordedAtSchema,
  question: z.object({
    text: z.string().max(MAX_DASHBOARD_QUESTION_LENGTH),
    scenarioLine: z.string().max(MAX_DASHBOARD_SCENARIO_LINE_LENGTH),
  }),
  answer: z.string().max(MAX_DASHBOARD_ANSWER_LENGTH),
  scores: z.record(z.enum(ITEM_IDS), z.literal([...SCORE_LEVELS])),
  comments: z.object(
    Object.fromEntries(
      CRITERIA.map((criterion) => [
        criterion.id,
        z.string().max(MAX_DASHBOARD_COMMENT_LENGTH),
      ]),
    ) as Record<CriterionId, z.ZodString>,
  ),
  rubricVersion: z.string().max(MAX_DASHBOARD_RUBRIC_VERSION_LENGTH),
});
/** One record as {@link dashboardRequestSchema} accepts it. */
export type DashboardRecord = z.infer<typeof dashboardRecordSchema>;
/** Refused with 400 when the records mix `rubricVersion`, which the client filters to one before sending. */
export const dashboardRequestSchema = z
  .object({ records: z.array(dashboardRecordSchema).min(1).max(MAX_DASHBOARD_RECORDS) })
  .refine(
    (value) => new Set(value.records.map((record) => record.rubricVersion)).size === 1,
    { message: "Every record must share the same rubricVersion.", path: ["records"] },
  );
/** The JSON body `POST /api/dashboard` answers with. */
export const dashboardResponseSchema = z.object({ summary: z.string() });
/** The request body {@link dashboardRequestSchema} accepts. */
export type DashboardRequest = z.infer<typeof dashboardRequestSchema>;
/** The answer body {@link dashboardResponseSchema} describes. */
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
