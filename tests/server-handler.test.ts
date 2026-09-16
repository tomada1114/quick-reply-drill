import { describe, expect, it, vi } from "vitest";
import type * as z from "zod";

import {
  createFakeLlmPort,
  type LlmError,
  type LlmErrorCode,
  type LlmPort,
  type LlmRequest,
} from "../src/ai/index";
import { POST } from "../src/app/api/ask/route";
import type { Result } from "../src/core/result";
import { askHandler } from "../src/server/composition";
import { createAskHandler } from "../src/server/handlers/ask";

/**
 * The origin a `Request` needs to be constructible.
 *
 * @remarks
 * Nothing in the handler reads it — the route's path is Next.js's business, not
 * the handler's — but `new Request()` rejects a relative URL.
 */
const ENDPOINT = "http://localhost/api/ask";

/** What the port was asked, as the handler passed it on. */
interface CapturedRequest {
  readonly prompt: string;
  readonly outputLanguage: string;
  readonly signal: AbortSignal | undefined;
}

/**
 * Wraps a port so a test can assert on what the handler asked it.
 *
 * @remarks
 * A recording wrapper rather than a mock: the request still reaches a real
 * fake port and comes back through the same code path, so the assertions below
 * are about behavior rather than about how many times something was called.
 */
function capturing(inner: LlmPort, seen: CapturedRequest[]): LlmPort {
  return {
    generate<TSchema extends z.ZodType>(
      request: LlmRequest<TSchema>,
    ): Promise<Result<z.infer<TSchema>, LlmError>> {
      seen.push({
        prompt: request.prompt,
        outputLanguage: request.outputLanguage,
        signal: request.signal,
      });
      return inner.generate(request);
    },
  };
}

/** A `POST` carrying `body` verbatim, however malformed it is. */
function postRequest(body: string, init: RequestInit = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
    },
    body,
    ...init,
  });
}

/**
 * `RequestInit` with the field Node requires alongside a streaming body.
 *
 * @remarks
 * `undici` refuses a `ReadableStream` body without `duplex: "half"`, and
 * TypeScript's DOM `RequestInit` does not declare the field, so an inline
 * object literal would not compile. Named here rather than cast at the call
 * site.
 */
type StreamingRequestInit = RequestInit & { readonly duplex: "half" };

/**
 * A `POST` whose body stream fails partway through, as a dropped upload does.
 *
 * @remarks
 * The one shape `new Request(url, { body: "..." })` cannot express: a body that
 * begins to arrive and then stops because the connection died. Everything below
 * the handler sees exactly what a client hanging up mid-upload produces.
 */
function postRequestThatFailsMidBody(): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"prompt":"Which cit'));
      controller.error(new Error("connection reset"));
    },
  });
  const init: StreamingRequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
    },
    body: stream,
    duplex: "half",
  };
  return new Request(ENDPOINT, init);
}

/** The answer the fake port is configured to give unless a test says otherwise. */
const ANSWER = { answer: "Kyoto is the old capital." };

/**
 * The two ceilings the handler enforces, written out rather than imported.
 *
 * @remarks
 * Importing `MAX_PROMPT_LENGTH` or `MAX_REQUEST_BODY_BYTES` would make every
 * boundary case below agree with the implementation by construction — a
 * ceiling raised by mistake would move the tests with it and nothing would
 * fail. These are the numbers a caller is promised, so they are typed here.
 * The body ceiling is stated in bytes and exercised with ASCII JSON, where a
 * character is one byte.
 */
const MAX_PROMPT_LENGTH = 8_000;
const MAX_REQUEST_BODY_BYTES = 65_536;

/**
 * A well-formed request body padded out to exactly `bytes` bytes.
 *
 * @remarks
 * The padding goes in a property the schema does not declare — `zod` strips an
 * unknown key rather than rejecting it — because the `prompt` has a ceiling of
 * its own far below the body's, so no legal prompt can fill a body on its own.
 */
function bodyOfBytes(bytes: number): string {
  const envelope = JSON.stringify({ prompt: "Which city?", padding: "" });
  return JSON.stringify({
    prompt: "Which city?",
    padding: "a".repeat(bytes - envelope.length),
  });
}

describe("the ask handler", () => {
  it("answers a well-formed request with the model's structured output", async () => {
    const handler = createAskHandler({ llm: createFakeLlmPort({ response: ANSWER }) });

    const response = await handler(
      postRequest(JSON.stringify({ prompt: "Which city was the old capital?" })),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toStrictEqual(ANSWER);
  });

  it("passes the prompt to the port with its surrounding whitespace trimmed", async () => {
    const seen: CapturedRequest[] = [];
    const handler = createAskHandler({
      llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
    });

    await handler(postRequest(JSON.stringify({ prompt: "  Which city? " })));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.prompt).toBe("Which city?");
  });

  // The endpoint answers in English whatever it is sent: practising English is
  // what this application is for, so the language is the handler's constant
  // rather than a field a caller may name.
  it("always asks the model to answer in English", async () => {
    const seen: CapturedRequest[] = [];
    const handler = createAskHandler({
      llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
    });

    await handler(postRequest(JSON.stringify({ prompt: "Which city?" })));

    expect(seen[0]?.outputLanguage).toBe("en");
  });

  it("forwards the caller's cancellation to the port", async () => {
    const seen: CapturedRequest[] = [];
    const handler = createAskHandler({
      llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
    });
    const controller = new AbortController();

    const request = postRequest(JSON.stringify({ prompt: "Which city?" }), {
      signal: controller.signal,
    });
    await handler(request);
    const forwarded = seen[0]?.signal;
    expect(forwarded?.aborted).toBe(false);

    controller.abort();

    expect(forwarded?.aborted).toBe(true);
  });

  it("rejects a body that is not JSON", async () => {
    const handler = createAskHandler({ llm: createFakeLlmPort({ response: ANSWER }) });

    const response = await handler(postRequest("not json at all"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_BAD_REQUEST",
        message: "The request body is not valid JSON.",
      },
    });
  });

  it.each([
    ["an object with no prompt", JSON.stringify({ question: "Hi" })],
    ["an empty prompt", JSON.stringify({ prompt: "" })],
    ["a whitespace-only prompt", JSON.stringify({ prompt: "   " })],
    ["a prompt of tabs and newlines", JSON.stringify({ prompt: "\t\n \r\n" })],
    [
      "a prompt one character over the ceiling",
      JSON.stringify({ prompt: "a".repeat(MAX_PROMPT_LENGTH + 1) }),
    ],
    [
      "a prompt still over the ceiling once its whitespace is trimmed",
      JSON.stringify({ prompt: ` ${"a".repeat(MAX_PROMPT_LENGTH + 1)} ` }),
    ],
    ["a non-string prompt", JSON.stringify({ prompt: 42 })],
    ["a JSON array", JSON.stringify([{ prompt: "Hi" }])],
    ["a bare JSON string", JSON.stringify("Hi")],
  ])("rejects %s with ERR_BAD_REQUEST", async (_label, body) => {
    const handler = createAskHandler({ llm: createFakeLlmPort({ response: ANSWER }) });

    const response = await handler(postRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  // A connection that dies mid-upload is an ordinary event, not a defect in
  // this process: the handler owes the caller a `Response`, the same 400 a body
  // read with `request.json()` produced, rather than a rejection that reaches
  // the route boundary as a 500 carrying no `error.code` at all.
  it("rejects a body whose stream fails mid-read without reaching the port", async () => {
    const seen: CapturedRequest[] = [];
    const handler = createAskHandler({
      llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
    });

    const response = await handler(postRequestThatFailsMidBody());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
    expect(seen).toStrictEqual([]);
  });

  it("rejects a request that carries no body at all", async () => {
    const handler = createAskHandler({ llm: createFakeLlmPort({ response: ANSWER }) });

    const response = await handler(
      new Request(ENDPOINT, {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  it.each([
    ["at the ceiling", "a".repeat(MAX_PROMPT_LENGTH)],
    ["at the ceiling once trimmed", `  ${"a".repeat(MAX_PROMPT_LENGTH)}  `],
    ["at the floor", "a"],
  ])("answers a prompt %s", async (_label, prompt) => {
    const seen: CapturedRequest[] = [];
    const handler = createAskHandler({
      llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
    });

    const response = await handler(postRequest(JSON.stringify({ prompt })));

    expect(response.status).toBe(200);
    expect(seen[0]?.prompt).toBe(prompt.trim());
  });

  // The endpoint's own promise, and the one place message text is asserted on:
  // a caller learns which constraint it broke and never reads its own input
  // back out of the answer, which is what would copy a prompt into every log
  // that records a 400. See the `designing-errors` skill.
  it("names the prompt constraint without echoing the prompt that broke it", async () => {
    const handler = createAskHandler({ llm: createFakeLlmPort({ response: ANSWER }) });
    const rejected = "hunter2-".repeat(MAX_PROMPT_LENGTH);

    const response = await handler(postRequest(JSON.stringify({ prompt: rejected })));
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain("ERR_BAD_REQUEST");
    expect(body).toContain(String(MAX_PROMPT_LENGTH));
    expect(body).not.toContain("hunter2");
  });

  it("answers a body of exactly the byte ceiling", async () => {
    const handler = createAskHandler({ llm: createFakeLlmPort({ response: ANSWER }) });

    const response = await handler(postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES)));

    expect(response.status).toBe(200);
  });

  // The point is not only the status: a body this endpoint refuses must be
  // refused *before* the port is reached, or the request has already cost
  // money by the time it is rejected.
  it("rejects a body over the byte ceiling without reaching the port", async () => {
    const seen: CapturedRequest[] = [];
    const handler = createAskHandler({
      llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
    });

    const response = await handler(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES + 1)),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_PAYLOAD_TOO_LARGE",
        message: `The request body must be at most ${String(MAX_REQUEST_BODY_BYTES)} bytes.`,
      },
    });
    expect(seen).toStrictEqual([]);
  });

  // A ceiling enforced by reading is a ceiling a lying client cannot move; one
  // read off `Content-Length` would be exactly as wrong as the header is.
  it("rejects an oversized body that declares a small Content-Length", async () => {
    const seen: CapturedRequest[] = [];
    const handler = createAskHandler({
      llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
    });

    const response = await handler(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES + 1), {
        headers: {
          "content-type": "application/json",
          "content-length": "12",
          "sec-fetch-site": "same-origin",
        },
      }),
    );

    expect(response.status).toBe(413);
    expect(seen).toStrictEqual([]);
  });

  it.each([
    ["ERR_LLM_AUTH", 500],
    ["ERR_LLM_RATE_LIMIT", 429],
    ["ERR_LLM_TIMEOUT", 504],
    ["ERR_LLM_INVALID_OUTPUT", 502],
    ["ERR_LLM_UNAVAILABLE", 503],
  ] as const satisfies readonly (readonly [LlmErrorCode, number])[])(
    "reports %s as HTTP %i",
    async (code, status) => {
      const handler = createAskHandler({ llm: createFakeLlmPort({ failWith: code }) });

      const response = await handler(postRequest(JSON.stringify({ prompt: "Hi" })));

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toStrictEqual({
        error: {
          code,
          message: "The language model could not answer this request.",
        },
      });
    },
  );

  it("reports an answer that does not match the schema as ERR_LLM_INVALID_OUTPUT", async () => {
    const handler = createAskHandler({
      llm: createFakeLlmPort({ response: { answer: 42 } }),
    });

    const response = await handler(postRequest(JSON.stringify({ prompt: "Hi" })));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_LLM_INVALID_OUTPUT" },
    });
  });
});

describe("the ask handler's same-origin guard", () => {
  function guarded(): {
    handler: (request: Request) => Promise<Response>;
    seen: CapturedRequest[];
  } {
    const seen: CapturedRequest[] = [];
    return {
      handler: createAskHandler({
        llm: capturing(createFakeLlmPort({ response: ANSWER }), seen),
      }),
      seen,
    };
  }

  function withoutFetchMetadata(value?: string): Request {
    return postRequest(JSON.stringify({ prompt: "Which city was the old capital?" }), {
      headers:
        value === undefined
          ? { "content-type": "application/json" }
          : { "content-type": "application/json", "sec-fetch-site": value },
    });
  }

  it("rejects a request with no Sec-Fetch-Site header", async () => {
    const { handler, seen } = guarded();

    const response = await handler(withoutFetchMetadata());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_FORBIDDEN_ORIGIN",
        message: "This endpoint answers same-origin browser requests only.",
      },
    });
    expect(seen).toStrictEqual([]);
  });

  it.each(["cross-site", "same-site"] as const)(
    "rejects a %s request",
    async (site) => {
      const { handler, seen } = guarded();

      const response = await handler(withoutFetchMetadata(site));

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "ERR_FORBIDDEN_ORIGIN" },
      });
      expect(seen).toStrictEqual([]);
    },
  );

  it("accepts same-origin case-insensitively", async () => {
    const { handler, seen } = guarded();

    const response = await handler(withoutFetchMetadata("SaMe-OrIgIn"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual(ANSWER);
    expect(seen).toHaveLength(1);
  });

  // The guard has to run before body parsing: a request that would otherwise
  // be refused as too large is an origin failure when the caller is not the
  // page this server serves.
  it("rejects before reading an oversized body", async () => {
    const { handler, seen } = guarded();

    const response = await handler(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES + 1), {
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_FORBIDDEN_ORIGIN" },
    });
    expect(seen).toStrictEqual([]);
  });
});

describe("the composed /api/ask route", () => {
  it("is the handler composition.ts builds, re-exported as POST", () => {
    expect(POST).toBe(askHandler);
  });

  // Pins the answer envelope the route replies with, against the real
  // composition rather than against a handler this test builds itself, and
  // with the environment stubbed rather than read: what `askHandler` does
  // reads the environment at module load, so a case that used the static import
  // would be asserting on the ambient environment. The body is matched by shape,
  // not by wording --
  // which adapter composition.ts wires is its own decision to change, but
  // that the reply is `{answer: <string>}` and not an error envelope is not.
  it("answers a well-formed request with the answer envelope", async () => {
    const composed = await composedWith({
      OPENAI_API_KEY: undefined,
    });

    const response = await composed(
      postRequest(JSON.stringify({ prompt: "Which city was the old capital?" })),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toBeTypeOf("object");
    expect(body).not.toBeNull();
    if (typeof body !== "object" || body === null || !("answer" in body)) {
      throw new Error(`not an answer envelope: ${JSON.stringify(body)}`);
    }
    expect(Object.keys(body)).toStrictEqual(["answer"]);
    expect(body.answer).toBeTypeOf("string");
  });

  /**
   * The composition root rebuilt against `env`, module registry and all.
   *
   * @remarks
   * `src/server/composition.ts` reads the environment once at module load, so
   * a test about what a given environment composes has to load the module
   * again rather than reuse the instance the static import above already
   * built.
   */
  async function composedWith(
    env: Readonly<Record<string, string | undefined>>,
  ): Promise<(request: Request) => Promise<Response>> {
    for (const [name, value] of Object.entries(env)) {
      vi.stubEnv(name, value);
    }
    vi.resetModules();
    return (await import("../src/server/composition")).askHandler;
  }

  // Pins the promise README.md and AGENTS.md both make: a fresh checkout with
  // no OPENAI_API_KEY still answers instead of surfacing ERR_LLM_AUTH as a 500
  // (#77).
  it("answers 200 with no provider credential configured", async () => {
    const composed = await composedWith({
      OPENAI_API_KEY: undefined,
    });

    const response = await composed(
      postRequest(JSON.stringify({ prompt: "Which city was the old capital?" })),
    );

    expect(response.status).toBe(200);
  });

  // What closes the endpoint is the adapter composition.ts wires, not what the
  // machine exports: a developer who has OPENAI_API_KEY set for something
  // else -- another project on the same machine -- still runs the fake
  // adapter, which bills nothing, so nothing is required and the
  // quick start still answers (#82).
  it("answers 200 while the fake adapter is wired, whatever provider credential is exported", async () => {
    const composed = await composedWith({
      OPENAI_API_KEY: "an-example-value",
    });

    const response = await composed(
      postRequest(JSON.stringify({ prompt: "Which city was the old capital?" })),
    );

    expect(response.status).toBe(200);
  });
});
