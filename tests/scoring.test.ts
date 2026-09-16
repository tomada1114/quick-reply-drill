import { describe, expect, it } from "vitest";

import {
  criterionScores,
  type CriterionWeights,
  scoreDelta,
  type ScoreSheet,
  totalScore,
} from "../src/core/scoring";
import { ITEM_IDS, type Score } from "../src/core/rubric";

function sheetWith(score: Score): ScoreSheet {
  return {
    respondsToPartner: score,
    keepsItGoing: score,
    grammar: score,
    spellingPunctuation: score,
    wordChoice: score,
    collocation: score,
    toneRegister: score,
    chatForm: score,
  };
}

function sheetWithOverrides(overrides: Partial<ScoreSheet>): ScoreSheet {
  return {
    ...sheetWith(0),
    ...overrides,
  };
}

describe("criterionScores", () => {
  it("sums each criterion's two item scores on a 0–10 scale", () => {
    const sheet: ScoreSheet = {
      respondsToPartner: 5,
      keepsItGoing: 2,
      grammar: 4,
      spellingPunctuation: 1,
      wordChoice: 3,
      collocation: 0,
      toneRegister: 2,
      chatForm: 5,
    };

    expect(criterionScores(sheet)).toStrictEqual({
      conversation: 7,
      accuracy: 5,
      vocabulary: 3,
      appropriateness: 7,
    });
  });
});

describe("totalScore", () => {
  it("scores an all-five sheet as 100", () => {
    expect(totalScore(sheetWith(5))).toBe(100);
  });

  it("scores an all-zero sheet as 0", () => {
    expect(totalScore(sheetWith(0))).toBe(0);
  });

  it("rounds a single five-point item to 13 under equal weights", () => {
    expect(totalScore(sheetWithOverrides({ respondsToPartner: 5 }))).toBe(13);
  });

  it("respects custom criterion weights", () => {
    const weights: CriterionWeights = {
      conversation: 0,
      accuracy: 100,
      vocabulary: 0,
      appropriateness: 0,
    };

    expect(
      totalScore(sheetWithOverrides({ grammar: 5, spellingPunctuation: 5 }), weights),
    ).toBe(100);
  });

  it("accepts the complete fixed item sheet", () => {
    expect(Object.keys(sheetWith(3))).toStrictEqual([...ITEM_IDS]);
  });
});

describe("scoreDelta", () => {
  it.each([
    ["positive", sheetWith(5), sheetWith(0), 100],
    ["negative", sheetWith(0), sheetWith(5), -100],
    ["unchanged", sheetWith(3), sheetWith(3), 0],
  ] as const)("reports a %s change", (_label, current, previous, expected) => {
    expect(scoreDelta(current, previous)).toBe(expected);
  });
});
