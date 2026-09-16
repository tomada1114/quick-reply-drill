import { describe, expect, it } from "vitest";
import * as z from "zod";

import { createOpenAiLlmPort, LlmError, type LlmErrorCode } from "../src/ai/index";
import type { Result } from "../src/core/result";
import {
  neverAnsweringFetch,
  openAiPort,
  readFixture,
  RESPONSES_URL,
  stubFetch,
  TEST_API_KEY,
  unreachableFetch,
} from "./openai-stub";

const SCHEMA = z.object({ answer: z.string(), confidence: z.number() });

function failureOf<T>(result: Result<T, LlmError>): LlmError {
  if (result.ok) {
    throw new Error(`expected a failure, got ${JSON.stringify(result.value)}`);
  }
  return result.error;
}

describe("createOpenAiLlmPort builds the Responses API request", () => {
  it("sends the model, the reasoning effort and a strict JSON schema format", async () => {
    const stub = stubFetch({ body: readFixture("success") });

    await openAiPort(stub.fetch, { reasoningEffort: "high" }).generate({
      schema: SCHEMA,
      instructions: "Answer as a concise English tutor.",
      prompt: "What is the answer?",
      outputLanguage: "en",
    });

    expect(stub.calls).toHaveLength(1);
    const [call] = stub.calls;
    expect(call?.url).toBe(RESPONSES_URL);
    expect(call?.body).toMatchObject({
      model: "gpt-5.6-luna",
      max_output_tokens: 4_000,
      reasoning: { effort: "high" },
      text: { format: { type: "json_schema", strict: true } },
    });
  });

  it("carries the caller's instructions and output language into the prompt", async () => {
    const stub = stubFetch({ body: readFixture("success") });

    await openAiPort(stub.fetch).generate({
      schema: SCHEMA,
      instructions: "Answer as a concise English tutor.",
      prompt: "What is the answer?",
      outputLanguage: "ja",
    });

    // The SDK sends `instructions` as the leading developer turn rather than as
    // a top-level field; asserting on the serialised body is what keeps this
    // honest about where it actually lands.
    const instructions = JSON.stringify(stub.calls[0]?.body["input"]);
    expect(instructions).toContain("Answer as a concise English tutor.");
    expect(instructions).toContain("ja");
  });

  it("signs the request without any test asserting or logging the credential", async () => {
    const stub = stubFetch({ body: readFixture("success") });

    await openAiPort(stub.fetch).generate({
      schema: SCHEMA,
      prompt: "What is the answer?",
      outputLanguage: "en",
    });

    // Presence only. The value is never asserted, printed, or written to a
    // fixture — a recorded request is where a credential leaks.
    expect(stub.calls[0]?.headers.has("authorization")).toBe(true);
  });

  it("throws rather than reaching the network for any URL but the Responses endpoint", () => {
    const stub = stubFetch({ body: readFixture("success") });

    expect(() => stub.fetch("https://example.invalid/v1/chat")).toThrow(RESPONSES_URL);
  });
});

describe("createOpenAiLlmPort maps a provider failure onto the port's vocabulary", () => {
  const cases: readonly (readonly [number, string, LlmErrorCode])[] = [
    [400, "error-400", "ERR_LLM_INVALID_OUTPUT"],
    [401, "error-401", "ERR_LLM_AUTH"],
    [403, "error-403", "ERR_LLM_AUTH"],
    [422, "error-422", "ERR_LLM_INVALID_OUTPUT"],
    [429, "error-429", "ERR_LLM_RATE_LIMIT"],
    [500, "error-500", "ERR_LLM_UNAVAILABLE"],
  ];

  it.each(cases)("reports %i as %s → %s", async (status, fixture, code) => {
    const stub = stubFetch({ body: readFixture(fixture), status });

    const error = failureOf(
      await openAiPort(stub.fetch).generate({
        schema: SCHEMA,
        prompt: "What is the answer?",
        outputLanguage: "en",
      }),
    );

    expect(error).toBeInstanceOf(LlmError);
    expect(error.code).toBe(code);
  });

  it("reports a transport failure as ERR_LLM_UNAVAILABLE", async () => {
    const error = failureOf(
      await openAiPort(unreachableFetch()).generate({
        schema: SCHEMA,
        prompt: "What is the answer?",
        outputLanguage: "en",
      }),
    );

    expect(error.code).toBe("ERR_LLM_UNAVAILABLE");
  });

  it("keeps the provider's own error off message and on cause", async () => {
    const stub = stubFetch({ body: readFixture("error-401"), status: 401 });

    const error = failureOf(
      await openAiPort(stub.fetch).generate({
        schema: SCHEMA,
        prompt: "What is the answer?",
        outputLanguage: "en",
      }),
    );

    // "Incorrect API key provided." is the fixture's own wording; an adapter
    // that folded a provider message into `message` would eventually fold a
    // quoted prompt into a log line too.
    expect(error.message).not.toContain("Incorrect API key");
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("reports ERR_LLM_INVALID_OUTPUT when the answer does not match the schema", async () => {
    // Both structure passes produce this code — the SDK validates the decoded
    // answer against the same schema before `generate`'s own second pass does.
    const stub = stubFetch({ body: readFixture("invalid-output") });

    const error = failureOf(
      await openAiPort(stub.fetch).generate({
        schema: SCHEMA,
        prompt: "What is the answer?",
        outputLanguage: "en",
      }),
    );

    expect(error.code).toBe("ERR_LLM_INVALID_OUTPUT");
  });

  it("reports a schema JSON Schema cannot express before anything is sent", async () => {
    const stub = stubFetch({ body: readFixture("success") });

    const error = failureOf(
      await openAiPort(stub.fetch).generate({
        // `z.date()` has no JSON Schema equivalent, so the conversion throws.
        schema: z.object({ at: z.date() }),
        prompt: "What is the answer?",
        outputLanguage: "en",
      }),
    );

    expect(error.code).toBe("ERR_LLM_INVALID_OUTPUT");
    expect(stub.calls).toHaveLength(0);
  });
});

describe("createOpenAiLlmPort without a credential", () => {
  it("answers ERR_LLM_AUTH without touching the transport", async () => {
    const stub = stubFetch({ body: readFixture("success") });

    const error = failureOf(
      await createOpenAiLlmPort({
        apiKey: undefined,
        model: "gpt-5.6-luna",
        reasoningEffort: "low",
        fetch: stub.fetch,
      }).generate({
        schema: SCHEMA,
        prompt: "What is the answer?",
        outputLanguage: "en",
      }),
    );

    expect(error.code).toBe("ERR_LLM_AUTH");
    expect(stub.calls).toHaveLength(0);
  });
});

describe("createOpenAiLlmPort bounds the whole call", () => {
  it("reports ERR_LLM_TIMEOUT when the per-attempt bound fires", async () => {
    const error = failureOf(
      await openAiPort(neverAnsweringFetch(), {
        attemptTimeoutMs: 10,
        maxRetries: 0,
      }).generate({
        schema: SCHEMA,
        prompt: "What is the answer?",
        outputLanguage: "en",
      }),
    );

    expect(error.code).toBe("ERR_LLM_TIMEOUT");
  });

  it("refuses a configuration whose total deadline exceeds the timer ceiling", () => {
    expect(() =>
      createOpenAiLlmPort({
        apiKey: TEST_API_KEY,
        model: "gpt-5.6-luna",
        reasoningEffort: "low",
        attemptTimeoutMs: 2_000_000_000,
        maxRetries: 1,
      }),
    ).toThrow(RangeError);
  });

  it.each([
    ["attemptTimeoutMs", { attemptTimeoutMs: 0 }],
    ["maxRetries", { maxRetries: -1 }],
  ])("refuses a non-usable %s at construction", (_name, overrides) => {
    expect(() =>
      createOpenAiLlmPort({
        apiKey: TEST_API_KEY,
        model: "gpt-5.6-luna",
        reasoningEffort: "low",
        ...overrides,
      }),
    ).toThrow(RangeError);
  });
});
