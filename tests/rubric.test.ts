import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CRITERIA,
  ITEM_IDS,
  RUBRIC_VERSION,
  SCORE_LEVELS,
  type ItemId,
} from "../src/core/rubric";
import { RUBRIC_DESCRIPTORS } from "../src/core/rubric-descriptors";

const EXPECTED_ITEM_IDS = [
  "respondsToPartner",
  "keepsItGoing",
  "grammar",
  "spellingPunctuation",
  "wordChoice",
  "collocation",
  "toneRegister",
  "chatForm",
] as const;

type ExpectedItemId = (typeof EXPECTED_ITEM_IDS)[number];

describe("the fixed rubric", () => {
  it("defines four criteria with two unique items each", () => {
    expect(CRITERIA.map((criterion) => criterion.id)).toStrictEqual([
      "conversation",
      "accuracy",
      "vocabulary",
      "appropriateness",
    ]);
    expect(CRITERIA.map((criterion) => criterion.items.length)).toStrictEqual([
      2, 2, 2, 2,
    ]);
    expect(CRITERIA[0]).toStrictEqual({
      id: "conversation",
      label: "Keeps the conversation going",
      items: [
        { id: "respondsToPartner", label: "Responds to the partner" },
        { id: "keepsItGoing", label: "Keeps it going" },
      ],
    });
    expect(new Set(ITEM_IDS).size).toBe(8);
  });

  it("keeps ITEM_IDS equal to the criteria table's order", () => {
    const flattened = CRITERIA.flatMap((criterion) =>
      criterion.items.map((item) => item.id),
    );

    expect(ITEM_IDS).toStrictEqual(EXPECTED_ITEM_IDS);
    expect(ITEM_IDS).toStrictEqual(flattened);
  });

  it("provides six distinct non-empty descriptors for every item", () => {
    for (const itemId of ITEM_IDS) {
      const descriptors = RUBRIC_DESCRIPTORS[itemId];
      const values = SCORE_LEVELS.map((level) => descriptors[level]);

      expect(values.every((descriptor) => descriptor.trim() !== "")).toBe(true);
      expect(new Set(values).size).toBe(6);
      expect(descriptors[0]).toContain("No reply");
      expect(descriptors[0]).toContain("not in English");
      expect(descriptors[0]).toContain("unrelated");
    }
  });

  it("pins the version that makes stored scores comparable", () => {
    expect(RUBRIC_VERSION).toBe("2026-09.4");
  });

  it("keeps ItemId closed over the eight table items", () => {
    expectTypeOf<ItemId>().toEqualTypeOf<ExpectedItemId>();
    expectTypeOf<(typeof ITEM_IDS)[number]>().toEqualTypeOf<ItemId>();
  });
});
