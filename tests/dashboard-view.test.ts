import { describe, expect, it } from "vitest";

import {
  buildDashboardView,
  toDashboardRecord,
} from "../src/components/dashboard/dashboard-view";
import type { DrillRecord } from "../src/core/records";
import { ITEM_IDS, type ItemId, type Score } from "../src/core/rubric";

/** A fully populated, schema-valid record, distinguishable by `id`. */
function makeRecord(overrides: Partial<DrillRecord> = {}): DrillRecord {
  const scores = Object.fromEntries(ITEM_IDS.map((id) => [id, 3])) as Record<
    ItemId,
    Score
  >;
  const rationales = Object.fromEntries(
    ITEM_IDS.map((id) => [id, "Because it fits."]),
  ) as Record<ItemId, string>;

  return {
    id: "a",
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
    scores,
    rationales,
    comments: {
      clarity: "Clear and direct.",
      accuracy: "No grammar issues.",
      vocabulary: "Natural word choice.",
      appropriateness: "Right register for a coworker.",
    },
    modelReply: "Yes, I'm free on Friday afternoon.",
    model: { alias: "gpt-5-mini", reasoningEffort: "low" },
    rubricVersion: "2026-09.2",
    ...overrides,
  };
}

describe("buildDashboardView", () => {
  it("returns empty views for no records", () => {
    expect(buildDashboardView([], 20, 10)).toStrictEqual({
      current: [],
      older: [],
      summaryCandidates: [],
    });
  });

  it("orders by the parsed instant, not by comparing the recordedAt strings", () => {
    // Lexically, "2026-01-02..." sorts after "2026-01-01...23:00:00.000Z" — a
    // bare string comparison would call `later` the newer of the two. Parsed
    // as instants, `later`'s +02:00 offset actually names an earlier moment
    // (2026-01-01T22:30:00.000Z) than `earlier`'s UTC 23:00.
    const earlier = makeRecord({
      id: "earlier",
      recordedAt: "2026-01-01T23:00:00.000Z",
    });
    const later = makeRecord({
      id: "later",
      recordedAt: "2026-01-02T00:30:00.000+02:00",
    });

    const view = buildDashboardView([later, earlier], 20, 10);

    expect(view.current.map((record) => record.id)).toStrictEqual(["earlier", "later"]);
  });

  it("caps the table window at tableLimit but keeps summaryCandidates from the whole history", () => {
    const records = Array.from({ length: 25 }, (_unused, index) =>
      makeRecord({
        id: `r${String(index)}`,
        recordedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );

    const view = buildDashboardView(records, 20, 10);

    expect(view.current).toHaveLength(20);
    expect(view.current[0]?.id).toBe("r24");
    expect(view.summaryCandidates).toHaveLength(10);
    expect(view.summaryCandidates[0]?.id).toBe("r24");
    expect(view.summaryCandidates[9]?.id).toBe("r15");
  });

  it("splits an older rubricVersion into its own group, newest-first within it", () => {
    const current = makeRecord({
      id: "current",
      recordedAt: "2026-09-16T00:00:00.000Z",
      rubricVersion: "2026-09.2",
    });
    const olderNewer = makeRecord({
      id: "older-newer",
      recordedAt: "2026-09-10T00:00:00.000Z",
      rubricVersion: "2026-09.1",
    });
    const olderOlder = makeRecord({
      id: "older-older",
      recordedAt: "2026-09-05T00:00:00.000Z",
      rubricVersion: "2026-09.1",
    });

    const view = buildDashboardView([olderOlder, current, olderNewer], 20, 10);

    expect(view.current.map((record) => record.id)).toStrictEqual(["current"]);
    expect(view.older).toStrictEqual([
      {
        rubricVersion: "2026-09.1",
        records: [olderNewer, olderOlder],
      },
    ]);
  });

  it("groups more than one older rubricVersion separately, newest group first", () => {
    const current = makeRecord({
      id: "current",
      recordedAt: "2026-09-16T00:00:00.000Z",
      rubricVersion: "2026-09.2",
    });
    const middleVersion = makeRecord({
      id: "middle",
      recordedAt: "2026-09-10T00:00:00.000Z",
      rubricVersion: "2026-09.1",
    });
    const oldestVersion = makeRecord({
      id: "oldest",
      recordedAt: "2026-09-01T00:00:00.000Z",
      rubricVersion: "2026-08.1",
    });

    const view = buildDashboardView([oldestVersion, current, middleVersion], 20, 10);

    expect(view.older.map((group) => group.rubricVersion)).toStrictEqual([
      "2026-09.1",
      "2026-08.1",
    ]);
  });

  it("only counts the newest version's records toward summaryCandidates", () => {
    const current = makeRecord({
      id: "current",
      recordedAt: "2026-09-16T00:00:00.000Z",
      rubricVersion: "2026-09.2",
    });
    const older = makeRecord({
      id: "older",
      recordedAt: "2026-09-01T00:00:00.000Z",
      rubricVersion: "2026-09.1",
    });

    const view = buildDashboardView([older, current], 20, 10);

    expect(view.summaryCandidates).toStrictEqual([current]);
  });
});

describe("toDashboardRecord", () => {
  it("trims a DrillRecord to the wire fields POST /api/dashboard accepts", () => {
    const record = makeRecord({ id: "a" });

    expect(toDashboardRecord(record)).toStrictEqual({
      recordedAt: record.recordedAt,
      question: {
        text: record.question.text,
        scenarioLine: record.question.scenarioLine,
      },
      answer: record.answer,
      scores: record.scores,
      comments: record.comments,
      rubricVersion: record.rubricVersion,
    });
  });

  it("carries a forced-empty record's blank answer through unchanged", () => {
    const record = makeRecord({ id: "forced", answer: "", forcedSubmit: true });

    expect(toDashboardRecord(record).answer).toBe("");
  });
});
