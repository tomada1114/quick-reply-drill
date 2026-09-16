import * as z from "zod";

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
 * `comments` below is deliberately its own schema rather than a reuse of
 * `wire.ts`'s `scoreCommentsSchema`: that one types the grader's own output
 * and this one types what a caller sends back, two different trust
 * boundaries even though both now hold every comment to
 * {@link MAX_DASHBOARD_COMMENT_LENGTH} — the one constant, declared here,
 * that keeps a stored comment and a dashboard-request comment from being two
 * ceilings that merely happen to agree.
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
 */
export const MAX_DASHBOARD_RECORDED_AT_LENGTH = 40;

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
   * When the attempt was recorded. Pinned to an ISO 8601 UTC datetime, never a
   * bare `z.string()`, because `buildDashboardRequest` sorts records by this
   * field to write them out newest first — an unpinned format has no
   * chronological meaning to sort by, and a caller-chosen offset would let a
   * lexicographically-later string name an earlier instant.
   */
  recordedAt: z.iso.datetime().max(MAX_DASHBOARD_RECORDED_AT_LENGTH),
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
