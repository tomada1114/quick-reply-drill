import { asSchema, Output } from "ai";
import type * as z from "zod";

import type { LlmRequest } from "../../port";

/**
 * How hard the model is asked to think before answering.
 *
 * @remarks
 * Written out here rather than imported from the provider package, so
 * `src/ai/index.ts` can re-export the adapter's options type while staying free
 * of any language-model SDK — which is what keeps the port an interface a
 * second vendor could implement.
 */
export type OpenAiReasoningEffort =
  "none" | "low" | "medium" | "high" | "xhigh" | "max";

/** The structured-output specification one request is made with. */
type ObjectOutput = ReturnType<typeof Output.object<unknown>>;

/** Everything {@link buildCall} needs beyond the request itself. */
export interface BuildCallOptions<TSchema extends z.ZodType> {
  /** The caller's own vendor-neutral request. */
  readonly request: LlmRequest<TSchema>;

  /** Construction-time reasoning effort for this adapter. */
  readonly reasoningEffort: OpenAiReasoningEffort;

  /** Ceiling on what one answer may cost. */
  readonly maxOutputTokens: number;

  /** The SDK's own per-attempt bound. */
  readonly attemptTimeoutMs: number;

  /** How many times the SDK may retry after the first attempt. */
  readonly maxRetries: number;

  /** The caller's deadline composed with this adapter's total one. */
  readonly signal: AbortSignal;
}

/** The argument object one `generateText` call is made with. */
export interface OpenAiCall {
  readonly output: ObjectOutput;
  readonly instructions: string;
  readonly prompt: string;
  readonly abortSignal: AbortSignal;
  readonly maxOutputTokens: number;
  readonly maxRetries: number;
  readonly timeout: { readonly stepMs: number };
  readonly providerOptions: {
    readonly openai: {
      readonly reasoningEffort: OpenAiReasoningEffort;
      readonly strictJsonSchema: true;
    };
  };
}

/**
 * Converts the caller's Zod schema into the provider's structured-output
 * specification.
 *
 * @remarks
 * Reading `jsonSchema` is what actually runs the conversion — the SDK defers it
 * behind a getter — so this is where a schema JSON Schema cannot express
 * (`transform`, `pipe`, `z.date`) throws, before anything has been sent. The
 * caller of this function is what turns that into `ERR_LLM_INVALID_OUTPUT`
 * rather than a transport failure worth retrying.
 *
 * @throws Whatever the conversion threw.
 */
export function objectOutput(schema: z.ZodType): ObjectOutput {
  const converted = asSchema(schema);
  const json: unknown = converted.jsonSchema;
  if (typeof json !== "object" || json === null) {
    throw new TypeError(
      "The requested schema did not convert to a JSON Schema object.",
    );
  }

  return Output.object({ schema: converted });
}

/**
 * Turns one {@link LlmRequest} into the call the SDK is given.
 *
 * @remarks
 * `instructions`, never `system`: the latter is the SDK's deprecated spelling
 * of the same field. `outputLanguage` is folded in here because it constrains
 * the *content* the model writes rather than the shape `schema` describes, and
 * the Responses API has nowhere else to put it.
 *
 * `timeout.stepMs` bounds a single attempt and nothing more — the whole call is
 * bounded by `signal`, which the adapter composed its own total deadline into.
 */
export function buildCall<TSchema extends z.ZodType>(
  options: BuildCallOptions<TSchema>,
): OpenAiCall {
  const { request } = options;
  const languageLine = `Write the content of your answer in the language identified by the BCP 47 tag "${request.outputLanguage}".`;

  return {
    output: objectOutput(request.schema),
    instructions:
      request.instructions === undefined
        ? languageLine
        : `${request.instructions}\n\n${languageLine}`,
    prompt: request.prompt,
    abortSignal: options.signal,
    maxOutputTokens: options.maxOutputTokens,
    maxRetries: options.maxRetries,
    timeout: { stepMs: options.attemptTimeoutMs },
    providerOptions: {
      openai: {
        reasoningEffort: options.reasoningEffort,
        // The provider derives the JSON Schema it sends from `output` above;
        // this is what makes the API enforce it strictly rather than treat it
        // as guidance.
        strictJsonSchema: true,
      },
    },
  };
}
