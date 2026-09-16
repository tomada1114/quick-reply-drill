import { describe, expect, it } from "vitest";
import type * as z from "zod";

import {
  createFakeLlmPort,
  type LlmError,
  type LlmPort,
  type LlmRequest,
} from "../src/ai/index";
import { POST } from "../src/app/api/score/route";
import { CRITERIA, ITEM_IDS } from "../src/core/rubric";
import type { Result } from "../src/core/result";
import { scoreResponseSchema } from "../src/core/wire";
import { scoreHandler } from "../src/server/composition";
import { createScoreHandler } from "../src/server/handlers/score";
import type { LlmProfile } from "../src/server/llm-profiles";

/** The origin a `Request` needs to be constructible; nothing reads the path. */
const ENDPOINT = "http://localhost/api/score";

/**
 * The bounds a caller is promised, written out rather than imported.
 *
 * @remarks
 * Importing them from `src/core/wire.ts` would make every boundary case below
 * agree with the schema by construction — a ceiling raised by mistake would
 * move the tests with it and nothing would fail. The body ceiling is stated in
 * bytes and exercised with ASCII JSON, where a character is one byte.
 */
const MAX_ANSWER_LENGTH = 600;
const MAX_REQUEST_BODY_BYTES = 65_536;

/**
 * The ceiling the grader's own rationale and comments are truncated to,
 * written out rather than imported from `src/server/prompts/scoring.ts` —
 * see the module comment above for why.
 */
const MAX_GRADER_PROSE_LENGTH = 300;

/** A profile of this suite's own, so no case depends on the shipped table. */
const PROFILE: LlmProfile = { model: "a-model-alias", reasoningEffort: "high" };

/** One well-formed request body, for a case to vary a single field of. */
const INPUT = {
  question: "Are you free for lunch tomorrow?",
  scenarioLine: "A coworker, in a direct message",
  answer: "Sure, tomorrow works. Where do you want to go?",
};

/** A full sheet, as the grader is asked to answer: eight items, four comments. */
const GRADED = {
  items: Object.fromEntries(
    ITEM_IDS.map((id) => [id, { rationale: "Concrete reason.", score: 4 }]),
  ),
  comments: Object.fromEntries(
    CRITERIA.map((criterion) => [criterion.id, "Change this."]),
  ),
  modelReply: "Sure, tomorrow works for me. Where would you like to go?",
};

/** What the port was asked, as the handler passed it on. */
interface CapturedRequest {
  readonly instructions: string | undefined;
  readonly prompt: string;
  readonly signal: AbortSignal | undefined;
}

/**
 * Wraps a port so a test can assert on what the handler asked it.
 *
 * @remarks
 * A recording wrapper rather than a mock: the request still reaches a real
 * fake port and comes back through the same code path, so the assertions are
 * about behavior rather than about how many times something was called.
 */
function capturing(inner: LlmPort, seen: CapturedRequest[]): LlmPort {
  return {
    generate<TSchema extends z.ZodType>(
      request: LlmRequest<TSchema>,
    ): Promise<Result<z.infer<TSchema>, LlmError>> {
      seen.push({
        instructions: request.instructions,
        prompt: request.prompt,
        signal: request.signal,
      });
      return inner.generate(request);
    },
  };
}

/** A port that fails the test if anything reaches it. */
function unreachablePort(): LlmPort {
  return {
    generate(): never {
      throw new Error(
        "the port was asked for an answer the handler should have refused",
      );
    },
  };
}

/** A handler over `llm` and this suite's own profile. */
function handlerOver(llm: LlmPort): (request: Request) => Promise<Response> {
  return createScoreHandler({ llm, model: PROFILE });
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
 * object literal would not compile.
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
      controller.enqueue(new TextEncoder().encode('{"question":"Are you fr'));
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

/**
 * A well-formed request body padded out to exactly `bytes` bytes.
 *
 * @remarks
 * The padding goes in a property the schema does not declare — `zod` strips an
 * unknown key rather than rejecting it — because every field has a ceiling of
 * its own far below the body's, so no legal request can fill a body on its own.
 */
function bodyOfBytes(bytes: number): string {
  const envelope = JSON.stringify({ ...INPUT, padding: "" });
  return JSON.stringify({
    ...INPUT,
    padding: "a".repeat(bytes - envelope.length),
  });
}

describe("POST /api/score", () => {
  it("is what the Route Handler publishes, so the composed handler is the one served", () => {
    expect(POST).toBe(scoreHandler);
  });

  it("answers a full sheet with the rubric version and the model that graded it", async () => {
    const response = await handlerOver(createFakeLlmPort({ response: GRADED }))(
      postRequest(JSON.stringify(INPUT)),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const answer = scoreResponseSchema.parse(await response.json());

    expect(answer.model).toStrictEqual({
      alias: PROFILE.model,
      reasoningEffort: PROFILE.reasoningEffort,
    });
    // The rubric the descriptors were written for, not one the caller named.
    expect(answer.rubricVersion).toMatch(/^\d{4}-\d{2}\./u);
    expect(Object.keys(answer.items)).toStrictEqual([...ITEM_IDS]);
    expect(Object.keys(answer.comments)).toStrictEqual(
      CRITERIA.map((criterion) => criterion.id),
    );
    expect(answer.modelReply).toBe(GRADED.modelReply);
  });

  // The rubric belongs in the instruction block, which is identical across
  // requests; only the three labelled fields a learner controls vary.
  it("hands the port the rubric as instructions and the reply as the prompt", async () => {
    const seen: CapturedRequest[] = [];
    await handlerOver(capturing(createFakeLlmPort({ response: GRADED }), seen))(
      postRequest(JSON.stringify(INPUT)),
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.instructions).toContain("Answers the question");
    expect(seen[0]?.prompt).toContain(INPUT.answer);
    expect(seen[0]?.instructions).not.toContain(INPUT.answer);
  });

  // Timing is the client's to keep, never the grader's to know: a reply graded
  // more harshly for having taken longer is graded on something other than
  // what it says.
  it("sends the grader nothing the request schema does not declare", async () => {
    const seen: CapturedRequest[] = [];
    await handlerOver(capturing(createFakeLlmPort({ response: GRADED }), seen))(
      postRequest(JSON.stringify({ ...INPUT, elapsedMs: 27_000, forcedSubmit: true })),
    );

    expect(seen[0]?.prompt).not.toContain("27000");
    expect(seen[0]?.prompt).not.toContain("forcedSubmit");
  });

  it("forwards the caller's cancellation to the port", async () => {
    const seen: CapturedRequest[] = [];
    const controller = new AbortController();

    await handlerOver(capturing(createFakeLlmPort({ response: GRADED }), seen))(
      postRequest(JSON.stringify(INPUT), { signal: controller.signal }),
    );
    const forwarded = seen[0]?.signal;
    expect(forwarded?.aborted).toBe(false);

    controller.abort();

    expect(forwarded?.aborted).toBe(true);
  });

  it("refuses a request that does not identify itself as same-origin", async () => {
    const response = await handlerOver(unreachablePort())(
      new Request(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(INPUT),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_FORBIDDEN_ORIGIN",
        message: "This endpoint answers same-origin browser requests only.",
      },
    });
  });

  it.each(["cross-site", "same-site"] as const)(
    "refuses a %s request",
    async (site) => {
      const response = await handlerOver(unreachablePort())(
        postRequest(JSON.stringify(INPUT), {
          headers: { "content-type": "application/json", "sec-fetch-site": site },
        }),
      );

      expect(response.status).toBe(403);
    },
  );

  it("accepts same-origin case-insensitively", async () => {
    const response = await handlerOver(createFakeLlmPort({ response: GRADED }))(
      postRequest(JSON.stringify(INPUT), {
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "SaMe-OrIgIn",
        },
      }),
    );

    expect(response.status).toBe(200);
  });

  // The guard has to run before the body is read: a request that would
  // otherwise be refused as too large is an origin failure when the caller is
  // not the page this server serves.
  it("refuses a cross-origin request before reading an oversized body", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES + 1), {
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
  });

  it.each([
    ["no question", { ...INPUT, question: undefined }],
    ["an empty question", { ...INPUT, question: "" }],
    ["a whitespace-only answer", { ...INPUT, answer: "   " }],
    ["a non-string answer", { ...INPUT, answer: 42 }],
    ["no scenarioLine", { ...INPUT, scenarioLine: undefined }],
    ["a JSON array", [INPUT]],
    ["a bare JSON string", "grade this"],
  ])("refuses %s without reaching the port", async (_case, body) => {
    const response = await handlerOver(unreachablePort())(
      postRequest(JSON.stringify(body)),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  // A caption is optional prose, a reply is the thing being graded: the
  // schema's one asymmetry, asserted rather than assumed.
  it("accepts an empty scenarioLine", async () => {
    const response = await handlerOver(createFakeLlmPort({ response: GRADED }))(
      postRequest(JSON.stringify({ ...INPUT, scenarioLine: "" })),
    );

    expect(response.status).toBe(200);
  });

  it("answers an answer of exactly the ceiling", async () => {
    const response = await handlerOver(createFakeLlmPort({ response: GRADED }))(
      postRequest(JSON.stringify({ ...INPUT, answer: "a".repeat(MAX_ANSWER_LENGTH) })),
    );

    expect(response.status).toBe(200);
  });

  it("refuses an answer one character over the ceiling without reaching the port", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequest(
        JSON.stringify({ ...INPUT, answer: "a".repeat(MAX_ANSWER_LENGTH + 1) }),
      ),
    );

    expect(response.status).toBe(400);
  });

  // The endpoint's own promise, and the one place message text is asserted on:
  // a caller learns which constraint it broke and never reads its own input
  // back out of the answer, which is what would copy a reply into every log
  // that records a 400. See the `designing-errors` skill.
  it("names the answer constraint without echoing the answer that broke it", async () => {
    const rejected = "hunter2-".repeat(MAX_ANSWER_LENGTH);

    const response = await handlerOver(unreachablePort())(
      postRequest(JSON.stringify({ ...INPUT, answer: rejected })),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain("ERR_BAD_REQUEST");
    expect(body).toContain(String(MAX_ANSWER_LENGTH));
    expect(body).not.toContain("hunter2");
  });

  it("rejects a body that is not JSON", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequest("not json at all"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_BAD_REQUEST",
        message: "The request body is not valid JSON.",
      },
    });
  });

  it("rejects a request that carries no body at all", async () => {
    const response = await handlerOver(unreachablePort())(
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

  // A connection that dies mid-upload is an ordinary event, not a defect in
  // this process: the handler owes the caller a `Response`, the same 400 a body
  // read with `request.json()` produced, rather than a rejection that reaches
  // the route boundary as a 500 carrying no `error.code` at all.
  it("rejects a body whose stream fails mid-read without reaching the port", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequestThatFailsMidBody(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  it("answers a body of exactly the byte ceiling", async () => {
    const response = await handlerOver(createFakeLlmPort({ response: GRADED }))(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES)),
    );

    expect(response.status).toBe(200);
  });

  // The point is not only the status: a body this endpoint refuses must be
  // refused *before* the port is reached, or the request has already cost
  // money by the time it is rejected.
  it("rejects a body over the byte ceiling without reaching the port", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES + 1)),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_PAYLOAD_TOO_LARGE",
        message: `The request body must be at most ${String(MAX_REQUEST_BODY_BYTES)} bytes.`,
      },
    });
  });

  // A ceiling enforced by reading is a ceiling a lying client cannot move; one
  // read off `Content-Length` would be exactly as wrong as the header is.
  it("rejects an oversized body that declares a small Content-Length", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequest(bodyOfBytes(MAX_REQUEST_BODY_BYTES + 1), {
        headers: {
          "content-type": "application/json",
          "content-length": "12",
          "sec-fetch-site": "same-origin",
        },
      }),
    );

    expect(response.status).toBe(413);
  });

  it("reports a sheet that does not match the schema as 502", async () => {
    const response = await handlerOver(
      createFakeLlmPort({ response: { ...GRADED, modelReply: 42 } }),
    )(postRequest(JSON.stringify(INPUT)));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_LLM_INVALID_OUTPUT",
        message: "The language model could not answer this request.",
      },
    });
  });

  // The grader's own field, not a caller's: a model that ignores the brevity
  // `GRADING_RULES` asks for is truncated at the point the answer is
  // produced, rather than refused, so the request still succeeds and the
  // `DrillRecord` a caller stores from it stays within what `POST
  // /api/dashboard` will later accept back.
  it("truncates an over-long rationale and comment instead of refusing the answer", async () => {
    const response = await handlerOver(
      createFakeLlmPort({
        response: {
          ...GRADED,
          items: {
            ...GRADED.items,
            grammar: {
              rationale: "a".repeat(MAX_GRADER_PROSE_LENGTH + 50),
              score: 4,
            },
          },
          comments: {
            ...GRADED.comments,
            clarity: "a".repeat(MAX_GRADER_PROSE_LENGTH + 50),
          },
        },
      }),
    )(postRequest(JSON.stringify(INPUT)));

    expect(response.status).toBe(200);
    const answer = scoreResponseSchema.parse(await response.json());

    expect(answer.items.grammar.rationale).toHaveLength(MAX_GRADER_PROSE_LENGTH);
    expect(answer.comments.clarity).toHaveLength(MAX_GRADER_PROSE_LENGTH);
    // Every other field is passed through unchanged, not merely the two cut —
    // both are `GRADED`'s own values, shared by every item and every comment.
    expect(answer.items.chatForm.rationale).toBe("Concrete reason.");
    expect(answer.comments.accuracy).toBe("Change this.");
  });

  it.each([
    ["ERR_LLM_AUTH", 500],
    ["ERR_LLM_RATE_LIMIT", 429],
    ["ERR_LLM_TIMEOUT", 504],
    ["ERR_LLM_UNAVAILABLE", 503],
  ] as const)("reports %s as %i", async (code, status) => {
    const response = await handlerOver(createFakeLlmPort({ failWith: code }))(
      postRequest(JSON.stringify(INPUT)),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });
});
