import { describe, expect, it } from "vitest";
import * as z from "zod";

import type { LlmRequest } from "../src/ai/index";
import { drawSeeds, type ScenarioSeed } from "../src/core/scenarios";
import {
  buildQuestionsRequest,
  questionsOutputSchemaFor,
  type QuestionsOutput,
} from "../src/server/prompts/questions";

/** Three hand-written seeds, so the prompt's wording is pinned to fixed labels. */
const SEEDS: readonly ScenarioSeed[] = [
  {
    interlocutor: { id: "manager", label: "your manager", relationship: "distant" },
    setting: { id: "workThread", label: "a work chat thread", register: "formal" },
    topic: { id: "deadlineSlipping", label: "a deadline slipping" },
  },
  {
    interlocutor: { id: "closeFriend", label: "a close friend", relationship: "close" },
    setting: {
      id: "groupChat",
      label: "a group chat with friends",
      register: "casual",
    },
    topic: { id: "weekendPlans", label: "weekend plans" },
  },
  {
    interlocutor: { id: "client", label: "a client", relationship: "distant" },
    setting: {
      id: "supportChat",
      label: "a customer support chat",
      register: "formal",
    },
    topic: { id: "brokenThing", label: "a broken thing" },
  },
];

/** `count` well-formed generated questions. */
function questions(count: number): QuestionsOutput {
  return {
    questions: Array.from({ length: count }, (_unused, index) => ({
      question: `Question ${String(index + 1)}?`,
      scenarioLine: "Your manager, in a work chat",
    })),
  };
}

describe("questionsOutputSchemaFor", () => {
  it("accepts exactly the number of questions it was built for", () => {
    expect(questionsOutputSchemaFor(3).safeParse(questions(3)).success).toBe(true);
  });

  it.each([0, 1, 2, 4, 6])("rejects a batch of %i questions", (count) => {
    expect(questionsOutputSchemaFor(3).safeParse(questions(count)).success).toBe(false);
  });

  it("requires both fields of every question", () => {
    const schema = questionsOutputSchemaFor(1);

    expect(
      schema.safeParse({ questions: [{ question: "Free this weekend?" }] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        questions: [{ question: "Free this weekend?", scenarioLine: "" }],
      }).success,
    ).toBe(true);
  });

  it("converts to a closed JSON Schema with no count keyword in it", () => {
    // The refinement is dropped by the conversion rather than rejected by it,
    // which is the whole reason the count is enforced by the adapter's second
    // pass instead of by the API.
    const converted = z.toJSONSchema(questionsOutputSchemaFor(3)) as Record<
      string,
      unknown
    >;
    const properties = converted["properties"] as Record<string, unknown>;
    const array = properties["questions"] as Record<string, unknown>;
    const item = array["items"] as Record<string, unknown>;

    expect(converted["required"]).toStrictEqual(["questions"]);
    expect(converted["additionalProperties"]).toBe(false);
    expect(item["required"]).toStrictEqual(["question", "scenarioLine"]);
    expect(item["additionalProperties"]).toBe(false);
    expect(array["minItems"]).toBeUndefined();
    expect(array["maxItems"]).toBeUndefined();
  });
});

describe("buildQuestionsRequest", () => {
  const request = buildQuestionsRequest(SEEDS);

  it("returns the LlmRequest fields a caller adds only a signal to", () => {
    const asRequest: Omit<LlmRequest<z.ZodType<QuestionsOutput>>, "signal"> = request;

    expect(asRequest.outputLanguage).toBe("en");
  });

  it("lists every seed in the order it was drawn", () => {
    expect(request.prompt).toBe(
      [
        "Write 3 questions, one for each numbered situation below, in this order:",
        "",
        "1. your manager, in a work chat thread, about a deadline slipping",
        "2. a close friend, in a group chat with friends, about weekend plans",
        "3. a client, in a customer support chat, about a broken thing",
      ].join("\n"),
    );
  });

  it("builds a schema for exactly as many questions as there are seeds", () => {
    expect(request.schema.safeParse(questions(3)).success).toBe(true);
    expect(request.schema.safeParse(questions(2)).success).toBe(false);
  });

  it("states the question rules the schema cannot enforce", () => {
    expect(request.instructions).toContain("one or two sentences");
    expect(request.instructions).toContain("20 words or fewer");
    expect(request.instructions).toContain("no quotation marks");
    expect(request.instructions).toContain("Match the register");
    expect(request.instructions).toContain("scenarioLine");
    expect(request.instructions).toContain("Your manager, in a work chat");
  });

  it("keeps the rules out of the per-request prompt", () => {
    const other = buildQuestionsRequest(SEEDS.slice(0, 2));

    expect(other.instructions).toBe(request.instructions);
    expect(request.prompt).not.toContain("20 words or fewer");
    expect(other.prompt).toContain("Write 2 questions");
  });

  it("lists whatever drawSeeds actually produces", () => {
    const drawn = drawSeeds(4, () => 0);
    const listed = buildQuestionsRequest(drawn);

    for (const [index, seed] of drawn.entries()) {
      expect(listed.prompt).toContain(
        `${String(index + 1)}. ${seed.interlocutor.label}, in ${seed.setting.label}, about ${seed.topic.label}`,
      );
    }
  });
});
