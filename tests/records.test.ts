import { describe, expect, expectTypeOf, it } from "vitest";

import {
  drillRecordSchema,
  MAX_RECORDS,
  RECORDS_STORAGE_VERSION,
  recordsEnvelopeSchema,
  type DrillRecord,
} from "../src/core/records";
import { ITEM_IDS, type ItemId, type Score } from "../src/core/rubric";

/** Every item mapped to the same score, keyed by {@link ITEM_IDS}. */
function makeScores(value: Score = 3): Record<ItemId, Score> {
  return Object.fromEntries(ITEM_IDS.map((id) => [id, value])) as Record<ItemId, Score>;
}

/** Every item mapped to a rationale string, keyed by {@link ITEM_IDS}. */
function makeRationales(): Record<ItemId, string> {
  return Object.fromEntries(ITEM_IDS.map((id) => [id, "Because it fits."])) as Record<
    ItemId,
    string
  >;
}

/** A fully populated, schema-valid record, as `unknown` so a test can break it. */
function makeRecord(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    recordedAt: "2026-09-16T00:00:00.000Z",
    question: {
      text: "Are you free Friday afternoon?",
      scenarioLine: "Your coworker Maya asks over chat.",
      seed: {
        interlocutorId: "coworker",
        settingId: "office-chat",
        topicId: "scheduling",
      },
    },
    answer: "Yes, I am free on Friday afternoon.",
    forcedSubmit: false,
    elapsedMs: 12_000,
    scores: makeScores(),
    rationales: makeRationales(),
    comments: {
      clarity: "Clear and direct.",
      accuracy: "No grammar issues.",
      vocabulary: "Natural word choice.",
      appropriateness: "Right register for a coworker.",
    },
    modelReply: "Yes, I'm free on Friday afternoon.",
    model: { alias: "gpt-5-mini", reasoningEffort: "low" },
    rubricVersion: "2026-09.1",
    ...overrides,
  };
}

describe("the storage constants", () => {
  it("pins the version and the retention limit the storage decision settled on", () => {
    expect(RECORDS_STORAGE_VERSION).toBe(1);
    expect(MAX_RECORDS).toBe(50);
  });
});

describe("drillRecordSchema", () => {
  it("accepts a fully populated record", () => {
    expect(drillRecordSchema.safeParse(makeRecord()).success).toBe(true);
  });

  it("rejects a record missing rubricVersion", () => {
    const record = makeRecord() as Record<string, unknown>;
    delete record["rubricVersion"];

    expect(drillRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects a score of 6", () => {
    const record = makeRecord({ scores: { ...makeScores(), answersQuestion: 6 } });

    expect(drillRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects an unknown item key in scores", () => {
    const record = makeRecord({ scores: { ...makeScores(), madeUpItem: 3 } });

    expect(drillRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects a scores object missing one of the eight items", () => {
    const scores = makeScores() as Record<string, Score>;
    delete scores["answersQuestion"];

    expect(drillRecordSchema.safeParse(makeRecord({ scores })).success).toBe(false);
  });

  it("rejects an unknown item key in rationales", () => {
    const record = makeRecord({
      rationales: { ...makeRationales(), madeUpItem: "Because." },
    });

    expect(drillRecordSchema.safeParse(record).success).toBe(false);
  });

  it.each([0, 1] as const)("accepts an elapsedMs of %d", (elapsedMs) => {
    expect(drillRecordSchema.safeParse(makeRecord({ elapsedMs })).success).toBe(true);
  });

  it.each([-1, 1.5] as const)("rejects an elapsedMs of %d", (elapsedMs) => {
    expect(drillRecordSchema.safeParse(makeRecord({ elapsedMs })).success).toBe(false);
  });

  it("does not accept, and does not require, a stored criterion score or total", () => {
    const record = makeRecord({
      criterionScores: { clarity: 10 },
      total: 90,
    }) as Record<string, unknown>;
    const result = drillRecordSchema.safeParse(record);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("criterionScores");
      expect(result.data).not.toHaveProperty("total");
    }
  });

  it("keeps scores and rationales keyed exactly by ItemId", () => {
    expectTypeOf<DrillRecord["scores"]>().toEqualTypeOf<Record<ItemId, Score>>();
    expectTypeOf<DrillRecord["rationales"]>().toEqualTypeOf<Record<ItemId, string>>();
  });

  it("accepts the exact shape the current writer produces: new Date().toISOString()", () => {
    // src/components/drill/use-submission.ts:91 and :136 are the only places
    // this application has ever written `recordedAt`, and both call
    // `new Date().toISOString()` directly. This is the regression pinning the
    // format must not cause: a record in exactly that shape must keep
    // parsing.
    const record = makeRecord({ recordedAt: new Date().toISOString() });

    expect(drillRecordSchema.safeParse(record).success).toBe(true);
  });

  it.each([
    ["a recordedAt with millisecond precision", "2026-09-01T00:00:00.000Z"],
    ["a recordedAt with no fractional seconds", "2026-09-01T00:00:00Z"],
  ])("accepts %s", (_description, recordedAt) => {
    expect(drillRecordSchema.safeParse(makeRecord({ recordedAt })).success).toBe(true);
  });

  it.each([
    ["a recordedAt with no timezone at all", "2026-09-01T00:00:00"],
    ["a recordedAt carrying a UTC offset instead of Z", "2026-09-01T10:00:00+09:00"],
    ["an empty recordedAt", ""],
    ["a recordedAt that is just a date, no time", "2026-09-01"],
  ])("rejects %s", (_description, recordedAt) => {
    expect(drillRecordSchema.safeParse(makeRecord({ recordedAt })).success).toBe(false);
  });
});

describe("recordsEnvelopeSchema", () => {
  it("accepts an envelope at the current version, empty or populated", () => {
    expect(
      recordsEnvelopeSchema.safeParse({ version: RECORDS_STORAGE_VERSION, records: [] })
        .success,
    ).toBe(true);
    expect(
      recordsEnvelopeSchema.safeParse({
        version: RECORDS_STORAGE_VERSION,
        records: [makeRecord()],
      }).success,
    ).toBe(true);
  });

  it("rejects a future envelope version", () => {
    expect(recordsEnvelopeSchema.safeParse({ version: 2, records: [] }).success).toBe(
      false,
    );
  });

  it("rejects an envelope whose records array holds an invalid record", () => {
    expect(
      recordsEnvelopeSchema.safeParse({
        version: RECORDS_STORAGE_VERSION,
        records: [{ bogus: true }],
      }).success,
    ).toBe(false);
  });
});
