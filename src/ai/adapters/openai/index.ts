import { generateText } from "ai";
import type * as z from "zod";

import { err, ok, type Result } from "../../../core/result";
import { abortedLlmError, type LlmError } from "../../errors";
import type { LlmPort, LlmRequest } from "../../port";
import { createOpenAiResponsesModel } from "./client";
import { deadlineSignal, totalDeadlineMs } from "./deadline";
import { llmErrorFor, toLlmError } from "./errors";
import { buildCall, type OpenAiReasoningEffort } from "./request";

export type { OpenAiReasoningEffort } from "./request";

/** Default ceiling on one answer, in output tokens. */
const DEFAULT_MAX_OUTPUT_TOKENS = 4_000;

/** Default per-attempt bound, in milliseconds. */
const DEFAULT_ATTEMPT_TIMEOUT_MS = 60_000;

/** Default number of retries after the first attempt. */
const DEFAULT_MAX_RETRIES = 1;

/**
 * How a {@link createOpenAiLlmPort} instance reaches OpenAI.
 *
 * @remarks
 * Everything here is construction-time configuration of this one adapter, not
 * part of a request: a model id or a reasoning effort on `LlmRequest` would
 * make the same request un-runnable against the fake, which is what the
 * contract suite and `pnpm dev` answer from.
 */
export interface OpenAiLlmPortOptions {
  /**
   * The credential every request is signed with.
   *
   * @remarks
   * `undefined` is a supported configuration, not a mistake: every request then
   * answers `ERR_LLM_AUTH` without touching the network, so a missing key is a
   * failure a caller sees and can act on rather than a server that refuses to
   * start.
   */
  readonly apiKey: string | undefined;

  /** The provider's own model id; the composition root names it. */
  readonly model: string;

  /** How hard the model is asked to think before answering. */
  readonly reasoningEffort: OpenAiReasoningEffort;

  /** Ceiling on one answer, in output tokens. Defaults to 4000. */
  readonly maxOutputTokens?: number;

  /** Per-attempt bound in milliseconds. Defaults to 60000. */
  readonly attemptTimeoutMs?: number;

  /** Retries after the first attempt. Defaults to 1. */
  readonly maxRetries?: number;

  /**
   * The transport, substituted in a test. Defaults to the runtime's `fetch`.
   *
   * @remarks
   * `| undefined` is explicit because `exactOptionalPropertyTypes` is on:
   * without it, a caller that builds several ports from one table could not
   * write `fetch: undefined` to say "the runtime's own", which is what
   * `src/server/composition.ts` does.
   */
  readonly fetch?: typeof fetch | undefined;
}

/**
 * Builds an {@link LlmPort} that answers from OpenAI's Responses API.
 *
 * @remarks
 * The whole vendor surface — the SDK, the model id, the reasoning effort, the
 * status mapping — is bounded by this directory. A caller sees only `LlmPort`,
 * and the same contract suite that measures the fake measures this.
 *
 * @throws A `RangeError` when the timeout and retry configuration does not
 * produce a usable total deadline. See `deadline.ts` for why that is the one
 * thing this adapter throws rather than reporting as a `Result`.
 */
export function createOpenAiLlmPort(options: OpenAiLlmPortOptions): LlmPort {
  const {
    apiKey,
    maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
    attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const totalMs = totalDeadlineMs({ attemptTimeoutMs, maxRetries });
  const model =
    apiKey === undefined
      ? undefined
      : createOpenAiResponsesModel({
          apiKey,
          model: options.model,
          ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        });

  return {
    async generate<TSchema extends z.ZodType>(
      request: LlmRequest<TSchema>,
    ): Promise<Result<z.infer<TSchema>, LlmError>> {
      if (model === undefined) {
        return err(
          llmErrorFor(
            "ERR_LLM_AUTH",
            new Error("No OpenAI API key was configured for this adapter."),
          ),
        );
      }

      const signal = deadlineSignal(totalMs, request.signal);

      // Its own guarded step, and its own code. Converting the caller's schema
      // to JSON Schema throws for a construct JSON Schema cannot express, and
      // nothing has reached the provider when it does — so it is the caller's
      // schema to fix, not a transport failure worth retrying.
      let call;
      try {
        call = buildCall({
          request,
          reasoningEffort: options.reasoningEffort,
          maxOutputTokens,
          attemptTimeoutMs,
          maxRetries,
          signal,
        });
      } catch (error) {
        return err(llmErrorFor("ERR_LLM_INVALID_OUTPUT", error));
      }

      let raw: unknown;
      try {
        const generated = await generateText({ model, ...call });
        raw = generated.output;
      } catch (error) {
        return err(toLlmError(error, signal));
      }

      // The second of the two structure passes. The first one is the API's,
      // against the JSON Schema derived from this same schema — which silently
      // drops what JSON Schema cannot express, such as a `refine` or a brand.
      // `safeParseAsync`, never `safeParse`: the synchronous form throws on a
      // schema carrying an async refinement, the one thing `LlmPort` promises
      // never to do for an expected failure.
      const parsed = await request.schema.safeParseAsync(raw);
      if (!parsed.success) {
        return err(llmErrorFor("ERR_LLM_INVALID_OUTPUT", parsed.error));
      }

      // Validation is async, so a deadline can fire while it is still running.
      // See `LlmPort.generate`'s TSDoc for why a successful parse does not
      // override that.
      if (signal.aborted) {
        return err(abortedLlmError(signal.reason));
      }

      return ok(parsed.data);
    },
  };
}
