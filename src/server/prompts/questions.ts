import * as z from "zod";

import type { ScenarioSeed } from "../../core/scenarios";
import { PROMPT_OUTPUT_LANGUAGE, type PromptRequest } from "./request";

/**
 * One generated opener with the caption shown above it.
 *
 * @remarks
 * `question` is the wire field name for the generated line regardless of
 * which of the two opener kinds it is — a question or a share — so a caller
 * reading the response does not need to branch on kind.
 */
const generatedQuestion = z.object({
  question: z.string(),
  scenarioLine: z.string(),
});

/** The questions one batch comes back as, before the count is checked. */
const questionsObject = z.object({ questions: z.array(generatedQuestion) });

/** What one batch of generated questions comes back as. */
export type QuestionsOutput = z.infer<typeof questionsObject>;

/**
 * The schema a batch of exactly `count` generated questions must match.
 *
 * @remarks
 * The count is a `refine` rather than an array length in the JSON Schema on
 * purpose: `minItems`/`maxItems` are keywords strict structured output does
 * not guarantee, and a refinement is dropped by the conversion rather than
 * rejected by it. It is therefore enforced by the adapter's second pass — the
 * `safeParseAsync` every `LlmPort` implementation runs — so a batch of the
 * wrong size arrives as `ERR_LLM_INVALID_OUTPUT` and the caller asks again.
 */
export function questionsOutputSchemaFor(count: number): z.ZodType<QuestionsOutput> {
  return questionsObject.refine((value) => value.questions.length === count, {
    message: `Expected exactly ${String(count)} questions.`,
  });
}

const QUESTION_INSTRUCTIONS = [
  "You write practice prompts for someone drilling short English chat replies in casual small talk — getting to know someone, or keeping a conversation going with a friend.",
  "Each opener is one line of English chat that a real person would actually send in the situation it is drawn from.",
  "",
  "Rules:",
  "- Write two kinds of opener, split roughly half and half across the batch: a question the reader can answer, or a short share — a piece of news or an observation — that invites a reaction rather than asking anything directly.",
  "- Whichever kind it is, keep it answerable in one or two sentences and to 20 words or fewer.",
  "- Use no numbering, no bullet, and no quotation marks around the opener.",
  "- Match the register of the setting: casual where the setting is casual, a little more neutral where it is neutral.",
  "- Address the reader directly, as the person described in the situation would.",
  "- Give each opener a `scenarioLine`: a short caption naming who is writing and where, such as `A friend from a hobby group, in a group chat`. Capitalise the first word and end it with no full stop.",
  "- Put the opener's text in the `question` field, whichever kind it is.",
  "- Answer with one opener per situation, in the same order as the list you are given, and with no situation left out or repeated.",
].join("\n");

/** One seed as the line the model reads it on. */
function seedLine(seed: ScenarioSeed, index: number): string {
  return `${String(index + 1)}. ${seed.interlocutor.label}, in ${seed.setting.label}, about ${seed.topic.label}`;
}

/**
 * Builds the request that generates one question per drawn scenario seed.
 *
 * @remarks
 * Pure: the draw itself is `drawSeeds`'s job and has already happened by the
 * time this is called, so the same seeds always produce the same request. The
 * returned schema is built for `seeds.length`, which is what makes a batch
 * that comes back short or long a validation failure rather than a silent
 * mismatch between the questions and the seeds they were drawn for.
 */
export function buildQuestionsRequest(
  seeds: readonly ScenarioSeed[],
): PromptRequest<z.ZodType<QuestionsOutput>> {
  return {
    schema: questionsOutputSchemaFor(seeds.length),
    instructions: QUESTION_INSTRUCTIONS,
    prompt: [
      `Write ${String(seeds.length)} questions, one for each numbered situation below, in this order:`,
      "",
      ...seeds.map(seedLine),
    ].join("\n"),
    outputLanguage: PROMPT_OUTPUT_LANGUAGE,
  };
}
