import { describe, expect, it } from "vitest";

import {
  drawSeeds,
  INTERLOCUTORS,
  SETTINGS,
  TOPICS,
  type Interlocutor,
  type Setting,
} from "../src/core/scenarios";

const RELATIONSHIPS = [
  "justMet",
  "familiar",
  "close",
] as const satisfies readonly Interlocutor["relationship"][];
const REGISTERS = [
  "casual",
  "neutral",
] as const satisfies readonly Setting["register"][];

/** Interlocutor ids that named a work relationship in the template's tables. */
const WORK_INTERLOCUTOR_IDS = ["manager", "client"];
/** Setting ids that named a work or support register in the template's tables. */
const WORK_SETTING_IDS = ["workThread", "marketplaceChat", "supportChat"];

/**
 * A deterministic mulberry32 generator, used only so `drawSeeds`'s injected
 * `random` can be exercised without depending on `Math.random`'s sequence.
 */
function seededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tripleKey(seed: {
  interlocutor: { id: string };
  setting: { id: string };
  topic: { id: string };
}): string {
  return `${seed.interlocutor.id}|${seed.setting.id}|${seed.topic.id}`;
}

describe("INTERLOCUTORS", () => {
  it("has at least eight entries with unique ids", () => {
    expect(INTERLOCUTORS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(INTERLOCUTORS.map((entry) => entry.id)).size).toBe(
      INTERLOCUTORS.length,
    );
  });

  it.each(RELATIONSHIPS)("includes a %s relationship", (relationship) => {
    expect(INTERLOCUTORS.some((entry) => entry.relationship === relationship)).toBe(
      true,
    );
  });

  it("names no work-register interlocutor from the template's tables", () => {
    for (const id of WORK_INTERLOCUTOR_IDS) {
      expect(INTERLOCUTORS.some((entry) => entry.id === id)).toBe(false);
    }
  });
});

describe("SETTINGS", () => {
  it("has at least six entries with unique ids", () => {
    expect(SETTINGS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(SETTINGS.map((entry) => entry.id)).size).toBe(SETTINGS.length);
  });

  it.each(REGISTERS)("includes a %s register", (register) => {
    expect(SETTINGS.some((entry) => entry.register === register)).toBe(true);
  });

  it("has no formal register left in the table", () => {
    expect(SETTINGS.some((entry) => (entry.register as string) === "formal")).toBe(
      false,
    );
  });

  it("names no work or support setting from the template's tables", () => {
    for (const id of WORK_SETTING_IDS) {
      expect(SETTINGS.some((entry) => entry.id === id)).toBe(false);
    }
  });
});

describe("TOPICS", () => {
  it("has at least twenty entries with unique ids", () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TOPICS.map((entry) => entry.id)).size).toBe(TOPICS.length);
  });
});

describe("drawSeeds", () => {
  const maxTriples = INTERLOCUTORS.length * SETTINGS.length * TOPICS.length;

  it("draws the requested number of distinct triples", () => {
    const seeds = drawSeeds(5, seededRandom(1));

    expect(seeds).toHaveLength(5);
    expect(new Set(seeds.map(tripleKey)).size).toBe(5);
  });

  it("is deterministic for the same injected random sequence", () => {
    const first = drawSeeds(5, seededRandom(42));
    const second = drawSeeds(5, seededRandom(42));

    expect(second).toStrictEqual(first);
  });

  it("draws a different sequence for a different seed", () => {
    const first = drawSeeds(5, seededRandom(1));
    const second = drawSeeds(5, seededRandom(2));

    expect(second.map(tripleKey)).not.toStrictEqual(first.map(tripleKey));
  });

  it("returns an empty array for a count of zero", () => {
    expect(drawSeeds(0, seededRandom(1))).toStrictEqual([]);
  });

  it("returns exactly one seed for a count of one", () => {
    expect(drawSeeds(1, seededRandom(1))).toHaveLength(1);
  });

  it("draws every distinct triple when count equals the maximum", () => {
    const seeds = drawSeeds(maxTriples, seededRandom(7));

    expect(seeds).toHaveLength(maxTriples);
    expect(new Set(seeds.map(tripleKey)).size).toBe(maxTriples);
  });

  it("throws a RangeError past the number of distinct triples", () => {
    expect(() => drawSeeds(maxTriples + 1, seededRandom(1))).toThrow(RangeError);
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
  ])("throws a RangeError for a %s count", (_, count) => {
    expect(() => drawSeeds(count, seededRandom(1))).toThrow(RangeError);
  });

  it("uses Math.random by default", () => {
    const seeds = drawSeeds(3);

    expect(seeds).toHaveLength(3);
    expect(new Set(seeds.map(tripleKey)).size).toBe(3);
  });
});
