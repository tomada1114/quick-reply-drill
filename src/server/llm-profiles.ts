import type { OpenAiLlmPortOptions } from "../ai/index";

/**
 * What a model call in this application is for.
 *
 * @remarks
 * One member per call site, not per screen: each names a decision about how
 * hard the model should think, and two call sites that would answer that
 * question the same way are the same use.
 */
export type LlmUse = "questions" | "scoring" | "dashboard";

/** The model, and how hard it is asked to think, for one use. */
export interface LlmProfile {
  /** The provider's own model id or alias. */
  readonly model: string;

  /** How hard the model is asked to think before answering. */
  readonly reasoningEffort: OpenAiLlmPortOptions["reasoningEffort"];
}

/**
 * The model each use is answered by, and with how much reasoning.
 *
 * @remarks
 * This file and `src/server/composition.ts` are the only two modules in this
 * repository that name a model. A third one joining them is the moment the
 * choice has escaped the composition root — see the `integrating-llm` skill's
 * "Swapping the vendor".
 *
 * It is a Git-managed table rather than an environment variable on purpose: a
 * model and a reasoning effort are product decisions that change what an
 * answer costs and how good it is, so changing one belongs in a reviewed diff,
 * not in a deployment's settings where nothing records why it moved.
 *
 * Generating a question is near-mechanical once the seed has been drawn, so it
 * asks for no reasoning at all and stays fast enough to sit in front of a
 * learner waiting to start. Scoring and the dashboard are judgments over a
 * rubric, which is what `high` is being paid for.
 *
 * The model is named by its alias because it has no dated snapshot to pin to;
 * an alias is what the provider offers here.
 */
export const LLM_PROFILES = {
  questions: { model: "gpt-5.6-luna", reasoningEffort: "none" },
  scoring: { model: "gpt-5.6-luna", reasoningEffort: "high" },
  dashboard: { model: "gpt-5.6-luna", reasoningEffort: "high" },
} as const satisfies Record<LlmUse, LlmProfile>;
