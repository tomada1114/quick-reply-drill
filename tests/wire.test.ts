import { describe, expect, it } from "vitest";

import { CRITERIA, ITEM_IDS } from "../src/core/rubric";
import {
  MAX_QUESTIONS_PER_BATCH,
  questionsRequestSchema,
  questionsResponseSchema,
  scoreRequestSchema,
  scoreResponseSchema,
} from "../src/core/wire";

/**
 * The bounds a caller is promised, written out rather than imported.
 *
 * @remarks
 * Importing the constants would make every case below agree with the schema by
 * construction, and a ceiling raised by mistake would move the tests with it.
 */
const MAX_QUESTION_LENGTH = 300;
const MAX_SCENARIO_LINE_LENGTH = 200;
const MAX_ANSWER_LENGTH = 600;

/** One answer body that must parse, for a case to vary a single field of. */
function answerBody(): unknown {
  return {
    questions: [
      {
        id: "11111111-2222-3333-4444-555555555555",
        question: "Are you free to swap shifts on Friday?",
        scenarioLine: "A coworker, in a work chat",
        seed: {
          interlocutorId: "coworker",
          settingId: "workChat",
          topicId: "scheduling",
        },
      },
    ],
  };
}

describe("the POST /api/questions request body", () => {
  it.each([1, MAX_QUESTIONS_PER_BATCH])("accepts a count of %i", (count) => {
    expect(questionsRequestSchema.safeParse({ count }).success).toBe(true);
  });

  // Each row is a body a caller can actually send: the bounds on either side,
  // the two shapes JSON makes easy to send by accident (a numeric string, a
  // fractional number), and the field missing altogether.
  it.each([
    ["a count below the floor", { count: 0 }],
    ["a negative count", { count: -1 }],
    ["a count above the ceiling", { count: MAX_QUESTIONS_PER_BATCH + 1 }],
    ["a fractional count", { count: 2.5 }],
    ["a count sent as a string", { count: "3" }],
    ["no count at all", {}],
    ["a body that is not an object", 3],
  ])("rejects %s", (_case, body) => {
    expect(questionsRequestSchema.safeParse(body).success).toBe(false);
  });

  it("parses to the count it was given", () => {
    expect(questionsRequestSchema.parse({ count: 4 })).toStrictEqual({ count: 4 });
  });
});

describe("the POST /api/questions answer body", () => {
  it("accepts a well-formed batch", () => {
    expect(questionsResponseSchema.safeParse(answerBody()).success).toBe(true);
  });

  it("accepts an empty batch, which the handler never produces but the shape allows", () => {
    expect(questionsResponseSchema.safeParse({ questions: [] }).success).toBe(true);
  });

  it.each([
    ["the questions array", { id: "a" }],
    ["a question with no id", { questions: [{ question: "Hi?" }] }],
    [
      "a question whose seed is incomplete",
      {
        questions: [
          {
            id: "a",
            question: "Hi?",
            scenarioLine: "A coworker, in a work chat",
            seed: { interlocutorId: "coworker", settingId: "workChat" },
          },
        ],
      },
    ],
  ])("rejects a body missing %s", (_case, body) => {
    expect(questionsResponseSchema.safeParse(body).success).toBe(false);
  });
});

/** One well-formed score request, for a case to vary a single field of. */
const SCORE_REQUEST = {
  question: "Are you free for lunch tomorrow?",
  scenarioLine: "A coworker, in a direct message",
  answer: "Sure, tomorrow works. Where do you want to go?",
};

/** One well-formed score answer, built from the rubric it is keyed by. */
function scoreAnswerBody(): unknown {
  return {
    rubricVersion: "2026-09.1",
    model: { alias: "a-model-alias", reasoningEffort: "high" },
    items: Object.fromEntries(
      ITEM_IDS.map((id) => [id, { rationale: "Concrete reason.", score: 4 }]),
    ),
    comments: Object.fromEntries(
      CRITERIA.map((criterion) => [criterion.id, "Change this."]),
    ),
    modelReply: "Sure, tomorrow works for me. Where would you like to go?",
  };
}

describe("the POST /api/score request body", () => {
  it("accepts a well-formed reply to grade", () => {
    expect(scoreRequestSchema.safeParse(SCORE_REQUEST).success).toBe(true);
  });

  it.each([
    ["a question at its ceiling", { question: "a".repeat(MAX_QUESTION_LENGTH) }],
    [
      "a scenarioLine at its ceiling",
      { scenarioLine: "a".repeat(MAX_SCENARIO_LINE_LENGTH) },
    ],
    ["an answer at its ceiling", { answer: "a".repeat(MAX_ANSWER_LENGTH) }],
    // A caption is optional prose; the question and the reply are not.
    ["an empty scenarioLine", { scenarioLine: "" }],
    ["a scenarioLine of whitespace only", { scenarioLine: "   " }],
  ])("accepts %s", (_case, overrides) => {
    expect(
      scoreRequestSchema.safeParse({ ...SCORE_REQUEST, ...overrides }).success,
    ).toBe(true);
  });

  it.each([
    ["an empty question", { question: "" }],
    ["a whitespace-only question", { question: "  \t " }],
    ["a question over its ceiling", { question: "a".repeat(MAX_QUESTION_LENGTH + 1) }],
    [
      "a scenarioLine over its ceiling",
      { scenarioLine: "a".repeat(MAX_SCENARIO_LINE_LENGTH + 1) },
    ],
    ["an empty answer", { answer: "" }],
    ["an answer over its ceiling", { answer: "a".repeat(MAX_ANSWER_LENGTH + 1) }],
    [
      "an answer still over its ceiling once trimmed",
      { answer: ` ${"a".repeat(MAX_ANSWER_LENGTH + 1)} ` },
    ],
    ["a non-string answer", { answer: 42 }],
  ])("rejects %s", (_case, overrides) => {
    expect(
      scoreRequestSchema.safeParse({ ...SCORE_REQUEST, ...overrides }).success,
    ).toBe(false);
  });

  it("parses to the fields with their surrounding whitespace trimmed", () => {
    expect(
      scoreRequestSchema.parse({ ...SCORE_REQUEST, answer: "  Sure.  " }),
    ).toStrictEqual({ ...SCORE_REQUEST, answer: "Sure." });
  });

  // Timing never reaches the grader, so it is not on the wire at all: an
  // unknown key is stripped rather than rejected, which is what keeps a client
  // that records its own timing from being refused for it.
  it("strips a field the grader must not be told, rather than refusing it", () => {
    expect(
      scoreRequestSchema.parse({ ...SCORE_REQUEST, elapsedMs: 27_000 }),
    ).toStrictEqual(SCORE_REQUEST);
  });
});

/** `source` without one of its keys, for a case about a field that is missing. */
function without(source: unknown, key: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>).filter(([name]) => name !== key),
  );
}

describe("the POST /api/score answer body", () => {
  it("accepts a full sheet", () => {
    expect(scoreResponseSchema.safeParse(scoreAnswerBody()).success).toBe(true);
  });

  it.each([
    ["the rubric version", "rubricVersion"],
    ["the model that graded it", "model"],
    ["the corrected reply", "modelReply"],
  ])("rejects a sheet missing %s", (_case, field) => {
    expect(
      scoreResponseSchema.safeParse(without(scoreAnswerBody(), field)).success,
    ).toBe(false);
  });

  it("rejects a sheet missing one rubric item", () => {
    const sheet = scoreAnswerBody() as { items: unknown };
    const body = { ...sheet, items: without(sheet.items, "grammar") };
    expect(scoreResponseSchema.safeParse(body).success).toBe(false);
  });

  it("rejects a score outside the six rubric levels", () => {
    const body = scoreAnswerBody() as { items: Record<string, unknown> };
    body.items["grammar"] = { rationale: "Concrete reason.", score: 6 };
    expect(scoreResponseSchema.safeParse(body).success).toBe(false);
  });
});
