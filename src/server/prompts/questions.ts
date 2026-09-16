import * as z from "zod";

import type { ScenarioSeed } from "../../core/scenarios";
import { PROMPT_OUTPUT_LANGUAGE, type PromptRequest } from "./request";

/** One generated question with the caption shown above it. */
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
  "You write practice prompts for someone drilling short English chat replies.",
  "Each question is one line of English chat that a real person would actually send in the situation it is drawn from.",
  "",
  "Rules:",
  "- Write a question the reader can answer in one or two sentences.",
  "- Keep every question to 20 words or fewer.",
  "- Use no numbering, no bullet, and no quotation marks around the question.",
  "- Match the register of the setting: casual where the setting is casual, formal where it is formal.",
  "- Address the reader directly, as the person described in the situation would.",
  "- Give each question a `scenarioLine`: a short caption naming who is writing and where, such as `Your manager, in a work chat`. Capitalise the first word and end it with no full stop.",
  "- Answer with one question per situation, in the same order as the list you are given, and with no situation left out or repeated.",
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
