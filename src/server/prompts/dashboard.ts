import * as z from "zod";

import { CRITERIA, ITEM_IDS } from "../../core/rubric";
import type { DashboardRecord } from "../../core/wire";
import { PROMPT_OUTPUT_LANGUAGE, type PromptRequest } from "./request";

/**
 * What the trend paragraph call answers with.
 *
 * @remarks
 * Shaped the same as `src/core/wire.ts`'s `dashboardResponseSchema`, and
 * declared separately from it on purpose — this one is what the model is
 * asked for, that one is what a caller receives, and the handler is the one
 * place a change to either would have to keep in step, exactly as
 * `src/server/prompts/questions.ts` declares its own output shape rather than
 * reusing the wire's.
 */
export const dashboardOutputSchema = z.object({ summary: z.string() });

const DASHBOARD_INSTRUCTIONS = [
  "You are an English-writing coach summarising a learner's recent practice reps.",
  "Write one paragraph, 120 to 200 words, describing the overall picture across the four criteria below: clarity, accuracy, vocabulary, and appropriateness.",
  "",
  "Rules:",
  "- Name recurring patterns across the reps, with at least one short quotation drawn from a reply as the example.",
  "- Say what improved from the oldest rep in this set to the newest.",
  "- Name the one habit to work on next.",
  "- Do not restate any score. Write flowing prose: no list, no heading, no bullet.",
].join("\n");

/** One record's scores, as `item: level` pairs in rubric order. */
function scoreLine(record: DashboardRecord): string {
  return ITEM_IDS.map((id) => `${id}: ${String(record.scores[id])}`).join(", ");
}

/** One record's comments, as `criterion: text` pairs in rubric order. */
function commentLine(record: DashboardRecord): string {
  return CRITERIA.map(
    (criterion) => `${criterion.id}: ${record.comments[criterion.id]}`,
  ).join(" | ");
}

/** One record, as the block of lines the model reads it on. */
function recordBlock(record: DashboardRecord): string {
  return [
    `Recorded at: ${record.recordedAt}`,
    `Scenario: ${record.question.scenarioLine}`,
    `Question: ${record.question.text}`,
    `Reply: ${record.answer}`,
    `Scores: ${scoreLine(record)}`,
    `Comments: ${commentLine(record)}`,
  ].join("\n");
}

/**
 * Builds the request that summarises a bounded set of past records.
 *
 * @remarks
 * Pure: the same records always produce the same request. The records are
 * written out newest first regardless of the order they arrived in, so the
 * "what improved" framing in {@link DASHBOARD_INSTRUCTIONS} reads against a
 * fixed direction whatever order a caller happened to send.
 */
export function buildDashboardRequest(
  records: readonly DashboardRecord[],
): PromptRequest<typeof dashboardOutputSchema> {
  const newestFirst = [...records].sort((a, b) =>
    b.recordedAt.localeCompare(a.recordedAt),
  );
  return {
    schema: dashboardOutputSchema,
    instructions: DASHBOARD_INSTRUCTIONS,
    prompt: newestFirst.map(recordBlock).join("\n\n"),
    outputLanguage: PROMPT_OUTPUT_LANGUAGE,
  };
}
