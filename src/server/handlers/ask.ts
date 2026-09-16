import * as z from "zod";

import type { LlmErrorCode, LlmPort } from "../../ai/index";
import { failure, readJsonBody, rejectCrossOrigin } from "../http";

/**
 * What the handler needs from the outside world.
 *
 * @remarks
 * Everything crossing this boundary is an interface, never a concrete adapter:
 * that is what lets a test drive the handler with a fake and lets
 * `src/server/composition.ts` — and only it — decide which vendor is behind
 * the port.
 */
export interface AskHandlerDependencies {
  /** The model this endpoint asks. */
  readonly llm: LlmPort;
}

/**
 * The BCP 47 tag this endpoint asks the model to write its content in.
 *
 * @remarks
 * A constant rather than a request field. The port's `outputLanguage` is an
 * open BCP 47 tag naming a language a model can write, and this application
 * answers in English only — practising English is what it is for, so letting a
 * caller ask for another language would be a different product, not an option.
 */
const OUTPUT_LANGUAGE = "en";

/**
 * The longest `prompt` this endpoint accepts, in characters once trimmed.
 *
 * @remarks
 * The port's `maxOutputTokens` bounds what comes back from a model; nothing
 * bounded what went out. A prompt here is a question, not a document, and 8000
 * characters leaves room to paste an error message or a paragraph of context
 * while staying a few thousand input tokens — far below any model's context
 * window. The number is a ceiling on what one caller can spend per request, so
 * raising it is a cost decision rather than a formality.
 */
const MAX_PROMPT_LENGTH = 8_000;

/** The JSON body `POST /api/ask` accepts. */
const askRequestSchema = z.object({
  /** The question put to the model, trimmed and bounded at both ends. */
  prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
});

/** The JSON body `POST /api/ask` answers with, and the shape asked of the model. */
const askAnswerSchema = z.object({
  answer: z.string(),
});

/**
 * The HTTP status each port failure is reported as.
 *
 * @remarks
 * `satisfies` rather than an annotation: it keeps the literal keys, so adding a
 * member to `LlmErrorCode` fails this object to compile instead of silently
 * falling through to a default status. `ERR_LLM_AUTH` maps to 500 on purpose —
 * the credential that failed is the server's, so the caller did nothing wrong
 * and has nothing to fix by retrying with different input.
 */
const STATUS_BY_LLM_CODE = {
  ERR_LLM_AUTH: 500,
  ERR_LLM_RATE_LIMIT: 429,
  ERR_LLM_TIMEOUT: 504,
  ERR_LLM_INVALID_OUTPUT: 502,
  ERR_LLM_UNAVAILABLE: 503,
} as const satisfies Record<LlmErrorCode, number>;

/**
 * Builds the `POST /api/ask` handler over the port it is given.
 *
 * @remarks
 * Web standards only: a `Request` in, a `Response` out, and no import from
 * `next`. That is what makes it testable with a plain `new Request(...)` — and
 * what keeps the Route Handler under `src/app/` a re-export with no logic of
 * its own to test separately.
 *
 * @returns The handler `src/app/api/ask/route.ts` exports as `POST`.
 */
export function createAskHandler(
  dependencies: AskHandlerDependencies,
): (request: Request) => Promise<Response> {
  const { llm } = dependencies;

  return async function handleAsk(request: Request): Promise<Response> {
    // Before the body is read: a cross-origin caller learns nothing about what
    // this endpoint accepts, and nothing reaches the port, which is what costs
    // money.
    const originFailure = rejectCrossOrigin(request);
    if (originFailure !== undefined) {
      return originFailure;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.error;
    }

    const parsed = askRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      return failure(
        400,
        "ERR_BAD_REQUEST",
        `The request body must be an object with a \`prompt\` of 1 to ${String(MAX_PROMPT_LENGTH)} characters once trimmed.`,
      );
    }

    const result = await llm.generate({
      schema: askAnswerSchema,
      prompt: parsed.data.prompt,
      outputLanguage: OUTPUT_LANGUAGE,
      // A client that hangs up aborts this signal, which the port forwards to
      // the provider instead of paying for an answer nobody will read.
      signal: request.signal,
    });

    if (!result.ok) {
      return failure(
        STATUS_BY_LLM_CODE[result.error.code],
        result.error.code,
        "The language model could not answer this request.",
      );
    }

    return Response.json(result.value, { status: 200 });
  };
}
