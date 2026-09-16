import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/** What {@link createOpenAiResponsesModel} needs to reach the provider. */
export interface OpenAiClientOptions {
  /** The credential every request is signed with. */
  readonly apiKey: string;

  /** The provider's own model id, chosen by whoever constructs the adapter. */
  readonly model: string;

  /**
   * The transport every request goes through.
   *
   * @remarks
   * This is the whole offline seam: substituting `fetch` leaves the adapter
   * under test the one that really builds, signs and sends the request and
   * decodes the answer, where a mock of the adapter would replace exactly what
   * a test exists to exercise. Left unset, the runtime's own `fetch` is used.
   */
  readonly fetch?: typeof fetch;
}

/**
 * Builds the language model every request is made against.
 *
 * @remarks
 * `responses`, not `chat`: the Responses API is the one that carries a
 * reasoning effort and a strict `json_schema` response format, which are the
 * two things this adapter relies on for structured output.
 */
export function createOpenAiResponsesModel(
  options: OpenAiClientOptions,
): LanguageModel {
  const provider = createOpenAI({
    apiKey: options.apiKey,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });

  return provider.responses(options.model);
}
