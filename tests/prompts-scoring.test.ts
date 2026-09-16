import { describe, expect, expectTypeOf, it } from "vitest";
import * as z from "zod";

import type { LlmRequest } from "../src/ai/index";
import {
  CRITERIA,
  ITEM_IDS,
  RUBRIC_VERSION as CORE_RUBRIC_VERSION,
  SCORE_LEVELS,
  type ItemId,
  type Score,
} from "../src/core/rubric";
import { RUBRIC_DESCRIPTORS } from "../src/core/rubric-descriptors";
import {
  buildScoringRequest,
  RUBRIC_VERSION,
  scoringOutputSchema,
} from "../src/server/prompts/scoring";

/** Every level descriptor the rubric ships, as one flat list. */
const ALL_DESCRIPTORS = ITEM_IDS.flatMap((id) =>
  SCORE_LEVELS.map((level) => RUBRIC_DESCRIPTORS[id][level]),
);

const INPUT = {
  question: "Can you get the draft over before Friday?",
  scenarioLine: "Your manager, in a work chat",
  answer: "Yes I send it tomorrow morning.",
} as const;

/** A JSON Schema node, walked without knowing which keywords it carries. */
type JsonNode = Record<string, unknown>;

/** Every `"type": "object"` node in a converted schema, the root included. */
function objectNodes(node: unknown): JsonNode[] {
  if (typeof node !== "object" || node === null) {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(objectNodes);
  }
  const record = node as JsonNode;
  const children = Object.values(record).flatMap(objectNodes);
  return record["type"] === "object" ? [record, ...children] : children;
}

/** Every value any `type` keyword in the converted schema carries. */
function declaredTypes(node: unknown): unknown[] {
  if (typeof node !== "object" || node === null) {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(declaredTypes);
  }
  const record = node as JsonNode;
  const own = "type" in record ? [record["type"]] : [];
  return [...own, ...Object.values(record).flatMap(declaredTypes)];
}

describe("scoringOutputSchema", () => {
  it("writes its keys in the order the grading decision is made", () => {
    expect(Object.keys(scoringOutputSchema.shape)).toStrictEqual([
      "items",
      "comments",
      "modelReply",
    ]);
  });

  it("asks for one result per rubric item, in rubric order", () => {
    expect(Object.keys(scoringOutputSchema.shape.items.shape)).toStrictEqual([
      ...ITEM_IDS,
    ]);
  });

  it("asks for one comment per criterion, in rubric order", () => {
    expect(Object.keys(scoringOutputSchema.shape.comments.shape)).toStrictEqual(
      CRITERIA.map((criterion) => criterion.id),
    );
  });

  it("puts the rationale before the score it justifies", () => {
    expect(
      Object.keys(scoringOutputSchema.shape.items.shape.grammar.shape),
    ).toStrictEqual(["rationale", "score"]);
  });

  it("keys the items object by exactly the ItemId union", () => {
    expectTypeOf<
      keyof typeof scoringOutputSchema.shape.items.shape
    >().toEqualTypeOf<ItemId>();
  });

  it("types a score as the closed Score union rather than a number", () => {
    type Parsed = z.infer<typeof scoringOutputSchema>;
    expectTypeOf<Parsed["items"]["grammar"]["score"]>().toEqualTypeOf<Score>();
    expectTypeOf<Parsed["modelReply"]>().toEqualTypeOf<string>();
  });

  it("parses a complete answer and rejects one missing a field", () => {
    const items = Object.fromEntries(
      ITEM_IDS.map((id) => [id, { rationale: "Concrete reason.", score: 4 }]),
    );
    const comments = Object.fromEntries(
      CRITERIA.map((criterion) => [criterion.id, "Change this."]),
    );
    const answer = { items, comments, modelReply: "I'll send it tomorrow morning." };

    expect(scoringOutputSchema.safeParse(answer).success).toBe(true);
    expect(
      scoringOutputSchema.safeParse({ ...answer, modelReply: undefined }).success,
    ).toBe(false);
  });

  it("rejects a score outside the six rubric levels", () => {
    const one = scoringOutputSchema.shape.items.shape.chatForm;

    expect(one.safeParse({ rationale: "Fits chat.", score: 5 }).success).toBe(true);
    expect(one.safeParse({ rationale: "Fits chat.", score: 6 }).success).toBe(false);
    expect(one.safeParse({ rationale: "Fits chat.", score: 4.5 }).success).toBe(false);
  });
});

describe("the JSON Schema scoringOutputSchema converts to", () => {
  const converted: unknown = z.toJSONSchema(scoringOutputSchema);

  it("requires every key of every object, so nothing comes back absent", () => {
    const nodes = objectNodes(converted);

    // The root, `items`, its eight item results, and `comments`.
    expect(nodes.length).toBe(11);
    for (const node of nodes) {
      const properties = node["properties"] as JsonNode;
      expect(node["required"]).toStrictEqual(Object.keys(properties));
    }
  });

  it("closes every object to additional properties", () => {
    for (const node of objectNodes(converted)) {
      expect(node["additionalProperties"]).toBe(false);
    }
  });

  it("states a score as the numeric enum strict mode accepts", () => {
    const items = (converted as JsonNode)["properties"] as JsonNode;
    const grammar = ((items["items"] as JsonNode)["properties"] as JsonNode)[
      "grammar"
    ] as JsonNode;
    const score = (grammar["properties"] as JsonNode)["score"] as JsonNode;

    expect(score["enum"]).toStrictEqual([0, 1, 2, 3, 4, 5]);
    expect(score["minimum"]).toBeUndefined();
    expect(score["maximum"]).toBeUndefined();
  });

  it("carries no nullable or alternative branch anywhere", () => {
    const serialised = JSON.stringify(converted);

    expect(serialised).not.toContain("anyOf");
    expect(serialised).not.toContain("oneOf");
    expect(declaredTypes(converted)).not.toContain("null");
  });
});

describe("buildScoringRequest", () => {
  const request = buildScoringRequest(INPUT);

  it("returns the LlmRequest fields a caller adds only a signal to", () => {
    // The annotation is the assertion: a prompt module states its return type
    // structurally rather than importing the AI layer, so this is where the
    // two shapes are held together.
    const asRequest: Omit<LlmRequest<typeof scoringOutputSchema>, "signal"> = request;

    expect(asRequest.schema).toBe(scoringOutputSchema);
    expect(asRequest.outputLanguage).toBe("en");
  });

  it.each(ALL_DESCRIPTORS)("puts the descriptor %s in the instructions", (text) => {
    expect(request.instructions).toContain(text);
  });

  it("names every criterion and every item it is grading", () => {
    for (const criterion of CRITERIA) {
      expect(request.instructions).toContain(criterion.label);
      for (const item of criterion.items) {
        expect(request.instructions).toContain(item.label);
      }
    }
  });

  it("states the grading rules the schema cannot enforce", () => {
    expect(request.instructions).toContain("rationale before the score");
    expect(request.instructions).toContain("one or two sentences at the same register");
    expect(request.instructions).toContain("never a new answer");
    expect(request.instructions).toContain("Judge only this reply");
  });

  it("labels the scenario, the question and the reply in the prompt", () => {
    expect(request.prompt).toBe(
      [
        "Scenario: Your manager, in a work chat",
        "Question: Can you get the draft over before Friday?",
        "Reply: Yes I send it tomorrow morning.",
      ].join("\n"),
    );
  });

  it("keeps the rubric out of the per-request prompt", () => {
    for (const descriptor of ALL_DESCRIPTORS) {
      expect(request.prompt).not.toContain(descriptor);
    }
  });

  it("varies nothing but the three labelled fields between requests", () => {
    const other = buildScoringRequest({ ...INPUT, answer: "Sure, tomorrow morning." });

    expect(other.instructions).toBe(request.instructions);
    expect(other.prompt).not.toBe(request.prompt);
  });
});

describe("the rubric version a scored reply is stamped with", () => {
  it("is the one src/core/rubric.ts declares", () => {
    expect(RUBRIC_VERSION).toBe(CORE_RUBRIC_VERSION);
  });
});
