import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createOpenAiLlmPort,
  type LlmPort,
  type OpenAiLlmPortOptions,
} from "../src/ai/index";

/**
 * The offline transport the OpenAI adapter is measured through.
 *
 * @remarks
 * Not a test file: `tests/ai-openai.test.ts` and `tests/ai-port.test.ts` both
 * drive the adapter, and a helper exported from one suite into the other would
 * make the exporting file's cases run twice.
 *
 * Substituting `fetch` is what keeps the adapter under test the real one — the
 * request is built, signed and serialised by the SDK, and the response decoded
 * by it — while nothing reaches a socket. `stubFetch` answers the Responses
 * endpoint and *throws* for every other URL, so a call this repository did not
 * intend fails loudly instead of quietly going out to the network.
 */
const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "openai",
);

/** The one URL {@link stubFetch} answers. */
export const RESPONSES_URL = "https://api.openai.com/v1/responses";

/**
 * A stand-in credential.
 *
 * @remarks
 * Deliberately not `sk-`-shaped: `scripts/lib/guard/credentials.mjs` matches
 * that shape in staged content, and a fixture or a test carrying one would
 * block a commit — correctly.
 */
export const TEST_API_KEY = "test-key-not-a-credential";

/** Reads a hand-written Responses API body from `tests/fixtures/openai/`. */
export function readFixture(name: string): string {
  return readFileSync(path.join(FIXTURES, `${name}.json`), "utf8");
}

/** One request the stub saw, as the SDK sent it. */
export interface CapturedRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: Record<string, unknown>;
}

/** A substituted transport plus what it was asked for. */
export interface FetchStub {
  readonly fetch: typeof fetch;
  readonly calls: readonly CapturedRequest[];
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Answers {@link RESPONSES_URL} with `body` and `status`, and nothing else. */
export function stubFetch(options: { body: string; status?: number }): FetchStub {
  const calls: CapturedRequest[] = [];

  const stub: typeof fetch = (input, init) => {
    const url = urlOf(input);
    if (url !== RESPONSES_URL) {
      throw new Error(
        `The fetch stub answers only ${RESPONSES_URL}, so no test reaches the network; got ${url}.`,
      );
    }
    calls.push({
      url,
      headers: new Headers(init?.headers),
      body: JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<
        string,
        unknown
      >,
    });

    return Promise.resolve(
      new Response(options.body, {
        status: options.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };

  return { fetch: stub, calls };
}

/**
 * A transport that never answers, so only a deadline can end a request.
 *
 * @remarks
 * It still honours `init.signal`, exactly as a real `fetch` does — rejecting
 * with the signal's own `reason`. A stub that ignored the signal would leave
 * every abort case hanging on a promise nothing can settle, and would be
 * testing something no real transport behaves like.
 */
export function neverAnsweringFetch(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal == null) return;

      const fail = (): void => {
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException("The operation was aborted.", "AbortError"),
        );
      };
      if (signal.aborted) {
        fail();
        return;
      }
      signal.addEventListener("abort", fail, { once: true });
    });
}

/** A transport that fails the way an unreachable host does. */
export function unreachableFetch(): typeof fetch {
  return () => Promise.reject(new TypeError("fetch failed"));
}

/** Builds the adapter over `fetchImpl`, with room to override one option. */
export function openAiPort(
  fetchImpl: typeof fetch,
  overrides: Partial<OpenAiLlmPortOptions> = {},
): LlmPort {
  return createOpenAiLlmPort({
    apiKey: TEST_API_KEY,
    model: "gpt-5.6-luna",
    reasoningEffort: "low",
    // Pinned at 0 so no case pays for the SDK's backoff sleep; the retry count
    // a test actually cares about is set per case.
    maxRetries: 0,
    fetch: fetchImpl,
    ...overrides,
  });
}
