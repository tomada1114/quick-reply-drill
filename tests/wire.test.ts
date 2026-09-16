import { describe, expect, it } from "vitest";

import {
  MAX_QUESTIONS_PER_BATCH,
  questionsRequestSchema,
  questionsResponseSchema,
} from "../src/core/wire";

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
