import * as z from "zod";

import { CRITERIA, SCORE_LEVELS, type ItemId } from "../../core/rubric";
import { RUBRIC_DESCRIPTORS } from "../../core/rubric-descriptors";
import { scoreCommentsSchema, scoreItemsSchema } from "../../core/wire";
import { PROMPT_OUTPUT_LANGUAGE, type PromptRequest } from "./request";

/**
 * The rubric version a score produced by this prompt was graded under.
 *
 * @remarks
 * Re-exported here so the module that builds the request and the module that
 * stores the answer name the same constant. Any wording change in this file —
 * the instructions, the grading rules, the labels the prompt uses — changes
 * what a score means and must bump `RUBRIC_VERSION` in `src/core/rubric.ts`,
 * exactly as a change to a descriptor does.
 */
export { RUBRIC_VERSION } from "../../core/rubric";

/**
 * What one graded reply comes back as.
 *
 * @remarks
 * Key order is the order the model writes, so it is the order the decision has
 * to be made in: each item's rationale before its score, every item before the
 * per-criterion comments that summarise them, and the corrected reply last,
 * once the grading it is based on exists. Nothing is optional or nullable —
 * strict structured output rejects both — so an answer that reaches a caller
 * has every field, and a shortfall in *quality* is the prompt's job below.
 *
 * The two grading pieces come from `src/core/wire.ts` rather than being
 * declared here, because `POST /api/score` hands them straight on to its
 * caller: two copies of this shape would be two things to keep in step, and
 * `core` cannot import `server` to get them the other way round.
 */
export const scoringOutputSchema = z.object({
  items: scoreItemsSchema,
  comments: scoreCommentsSchema,
  modelReply: z.string(),
});

/** The reply being graded, with the situation it was written for. */
export interface ScoringPromptInput {
  /** The question the learner was asked. */
  readonly question: string;

  /** The one-line caption describing who is asking, and where. */
  readonly scenarioLine: string;

  /** The learner's own reply, exactly as written. */
  readonly answer: string;
}

/** Every level descriptor for one item, as `  0: …` lines. */
function descriptorLines(id: ItemId): string {
  return SCORE_LEVELS.map(
    (level) => `  ${String(level)}: ${RUBRIC_DESCRIPTORS[id][level]}`,
  ).join("\n");
}

/** The four criteria, their items, and all 48 descriptors, verbatim. */
function rubricBlock(): string {
  return CRITERIA.map((criterion) =>
    [
      `${criterion.label} (${criterion.id})`,
      ...criterion.items.map((item) =>
        [`- ${item.label} (${item.id})`, descriptorLines(item.id)].join("\n"),
      ),
    ].join("\n"),
  ).join("\n\n");
}

const GRADING_RULES = [
  "- For every item, pick the level whose descriptor matches what the reply actually does; do not average the descriptors or split the difference between two levels.",
  "- Write the rationale before the score, and make the score follow from it: name the words or the omission in the reply that put it at that level.",
  "- Write one short, concrete comment per criterion in English that says what to change, not what was wrong in the abstract.",
  "- `modelReply` is the learner's own reply corrected and made natural, in one or two sentences at the same register and with the same intent. It is a repair of what they wrote, never a new answer of your own.",
  "- Judge only this reply. You are never told about earlier attempts, so assume nothing about them, about the learner's level, or about anything outside the scenario, the question, and the reply below.",
].join("\n");

/**
 * The grader's whole system-level brief: its role, the rubric, and the rules.
 *
 * @remarks
 * Assembled once at module load because it is the same for every request —
 * nothing in it depends on the reply being graded, which is what keeps the
 * per-request prompt down to the three labelled fields it varies.
 */
const SCORING_INSTRUCTIONS = [
  "You are grading one short English chat reply written by someone practising English.",
  "The four criteria below each hold two items. Score every item from 0 to 5 against its own level descriptors.",
  "",
  rubricBlock(),
  "",
  "Rules:",
  GRADING_RULES,
].join("\n");

/**
 * Builds the request that grades one reply against the fixed rubric.
 *
 * @remarks
 * Pure: the same input always produces the same request, and nothing here
 * reads a clock, a random source, or the environment. The caller adds its own
 * `signal` and hands the result to an `LlmPort`.
 *
 * The rubric lives entirely in `instructions` and the three varying fields
 * entirely in `prompt`, so the instruction block is identical across requests
 * and the part a learner controls cannot reach the part that states the rules.
 */
export function buildScoringRequest(
  input: ScoringPromptInput,
): PromptRequest<typeof scoringOutputSchema> {
  return {
    schema: scoringOutputSchema,
    instructions: SCORING_INSTRUCTIONS,
    prompt: [
      `Scenario: ${input.scenarioLine}`,
      `Question: ${input.question}`,
      `Reply: ${input.answer}`,
    ].join("\n"),
    outputLanguage: PROMPT_OUTPUT_LANGUAGE,
  };
}
