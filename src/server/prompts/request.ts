import type * as z from "zod";

/**
 * The fields a prompt builder owns: one `LlmRequest` minus its `signal`.
 *
 * @remarks
 * Stated structurally rather than as `Omit<LlmRequest<T>, "signal">`, because
 * the modules under this directory are pure prompt construction and import
 * only `zod` and `src/core/**` — importing the AI layer's surface for a type
 * would make a prompt's shape depend on the seam that happens to consume it.
 * The two are held together by a type assertion in the prompt suites instead,
 * which is where a drift between them fails.
 *
 * `signal` is deliberately absent: a deadline belongs to the caller making the
 * call, never to the text it is making the call with.
 */
export interface PromptRequest<TSchema extends z.ZodType> {
  /** The shape the model's answer must match. */
  readonly schema: TSchema;

  /** The instruction block the model treats as its system-level guidance. */
  readonly instructions: string;

  /** The per-request turn sent to the model. */
  readonly prompt: string;

  /** BCP 47 tag for the language the model writes its content in. */
  readonly outputLanguage: string;
}

/**
 * The language every prompt in this directory asks for.
 *
 * @remarks
 * A constant rather than a parameter: this application exists to practise
 * English, so a prompt written to grade or generate English chat has no other
 * answer to ask for.
 */
export const PROMPT_OUTPUT_LANGUAGE = "en";
