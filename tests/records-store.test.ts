import { describe, expect, it, vi } from "vitest";

import {
  createRecordsStore,
  RecordsEnvelopeConflictError,
  type RecordStorage,
} from "../src/components/lib/records-store";
import { MAX_RECORDS, RECORDS_STORAGE_VERSION } from "../src/core/records";
import { ITEM_IDS, type ItemId, type Score } from "../src/core/rubric";

/** An in-memory `Storage` stand-in, so the store is tested without a DOM. */
class MapStorage implements RecordStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** A fully populated, schema-valid record, distinguishable by `id`. */
function makeRecord(id: string) {
  const scores = Object.fromEntries(ITEM_IDS.map((itemId) => [itemId, 3])) as Record<
    ItemId,
    Score
  >;
  const rationales = Object.fromEntries(
    ITEM_IDS.map((itemId) => [itemId, "Because it fits."]),
  ) as Record<ItemId, string>;

  return {
    id,
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
      conversation: "Keeps the conversation moving.",
      accuracy: "No grammar issues.",
      vocabulary: "Natural word choice.",
      appropriateness: "Right register for a coworker.",
    },
    modelReply: "Yes, I'm free on Friday afternoon.",
    model: { alias: "gpt-5-mini", reasoningEffort: "low" },
    rubricVersion: "2026-09.1",
  };
}

describe("createRecordsStore", () => {
  it("uses the documented default key when none is given", () => {
    const storage = new MapStorage();
    const store = createRecordsStore(storage);

    store.append(makeRecord("a"));

    expect(storage.getItem("quick-reply-drill.records")).not.toBeNull();
  });

  it("starts empty against a key that has never been written", () => {
    const store = createRecordsStore(new MapStorage(), "test.records");

    expect(store.list()).toStrictEqual([]);
  });

  it("round-trips a single appended record", () => {
    const store = createRecordsStore(new MapStorage(), "test.records");
    const record = makeRecord("a");

    store.append(record);

    expect(store.list()).toStrictEqual([record]);
  });

  it("lists records newest first", () => {
    const store = createRecordsStore(new MapStorage(), "test.records");

    store.append(makeRecord("a"));
    store.append(makeRecord("b"));

    expect(store.list().map((record) => record.id)).toStrictEqual(["b", "a"]);
  });

  it("drops the oldest record once more than MAX_RECORDS have been appended", () => {
    const store = createRecordsStore(new MapStorage(), "test.records");

    for (let index = 0; index < MAX_RECORDS + 1; index += 1) {
      store.append(makeRecord(String(index)));
    }

    const ids = store.list().map((record) => record.id);
    expect(ids).toHaveLength(MAX_RECORDS);
    // The newest is the last one appended; the very first appended ("0") is
    // the one 51st append pushed out.
    expect(ids[0]).toBe(String(MAX_RECORDS));
    expect(ids).not.toContain("0");
  });

  it("clears every stored record", () => {
    const store = createRecordsStore(new MapStorage(), "test.records");
    store.append(makeRecord("a"));

    store.clear();

    expect(store.list()).toStrictEqual([]);
  });

  it("keeps two stores under different keys independent", () => {
    const storage = new MapStorage();
    const first = createRecordsStore(storage, "first.records");
    const second = createRecordsStore(storage, "second.records");

    first.append(makeRecord("a"));

    expect(first.list().map((record) => record.id)).toStrictEqual(["a"]);
    expect(second.list()).toStrictEqual([]);
  });

  it.each([
    ["a recordedAt with millisecond precision", "2026-09-01T00:00:00.000Z"],
    ["a recordedAt with no fractional seconds", "2026-09-01T00:00:00Z"],
    // src/components/drill/use-submission.ts:91 and :136 are the only places
    // this application has ever written `recordedAt`, and both call
    // `new Date().toISOString()` directly — this is the regression pinning
    // the format must not cause.
    ["the exact shape new Date().toISOString() produces", new Date().toISOString()],
  ])("round-trips a record whose recordedAt is %s", (_description, recordedAt) => {
    const store = createRecordsStore(new MapStorage(), "test.records");
    const record = { ...makeRecord("a"), recordedAt };

    store.append(record);

    expect(store.list()).toStrictEqual([record]);
  });

  describe("a broken store never bricks the drill", () => {
    it.each([
      ["a value that is not JSON at all", "{not json"],
      ["JSON that is not an object", "42"],
      ["an envelope missing version", JSON.stringify({ records: [] })],
      [
        "an envelope with a future version",
        JSON.stringify({ version: RECORDS_STORAGE_VERSION + 1, records: [] }),
      ],
      [
        "an envelope whose records array holds only an invalid record",
        JSON.stringify({
          version: RECORDS_STORAGE_VERSION,
          records: [{ bogus: true }],
        }),
      ],
    ])("reads %s as an empty list", (_description, raw) => {
      const storage = new MapStorage();
      storage.setItem("test.records", raw);
      const store = createRecordsStore(storage, "test.records");

      expect(store.list()).toStrictEqual([]);
    });

    it.each([
      ["a recordedAt with no timezone at all", "2026-09-01T00:00:00"],
      ["a recordedAt carrying a UTC offset instead of Z", "2026-09-01T10:00:00+09:00"],
      ["an empty recordedAt", ""],
      ["a recordedAt that is just a date, no time", "2026-09-01"],
    ])(
      "reads an envelope whose one record has %s as an empty list",
      (_description, recordedAt) => {
        const storage = new MapStorage();
        storage.setItem(
          "test.records",
          JSON.stringify({
            version: RECORDS_STORAGE_VERSION,
            records: [{ ...makeRecord("a"), recordedAt }],
          }),
        );
        const store = createRecordsStore(storage, "test.records");

        expect(store.list()).toStrictEqual([]);
      },
    );

    it("returns an empty list when storage.getItem throws", () => {
      const storage = new MapStorage();
      storage.setItem(
        "test.records",
        JSON.stringify({
          version: RECORDS_STORAGE_VERSION,
          records: [makeRecord("a")],
        }),
      );
      vi.spyOn(storage, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      const store = createRecordsStore(storage, "test.records");

      expect(store.list()).toStrictEqual([]);
    });

    it("salvages the individually valid records in a same-version envelope and keeps them on append", () => {
      const storage = new MapStorage();
      const valid = makeRecord("valid");
      storage.setItem(
        "test.records",
        JSON.stringify({
          version: RECORDS_STORAGE_VERSION,
          records: [valid, { bogus: true }],
        }),
      );
      const store = createRecordsStore(storage, "test.records");

      expect(store.list()).toStrictEqual([valid]);

      const appended = makeRecord("appended");
      store.append(appended);

      expect(store.list()).toStrictEqual([appended, valid]);
      const written: unknown = JSON.parse(storage.getItem("test.records") ?? "null");
      expect(written).toStrictEqual({
        version: RECORDS_STORAGE_VERSION,
        records: [appended, valid],
      });
    });

    it.each([
      ["a value that is not JSON at all", "{not json"],
      ["JSON that is not an object", "42"],
      ["an envelope missing version", JSON.stringify({ records: [] })],
      [
        "an envelope with a future version",
        JSON.stringify({ version: RECORDS_STORAGE_VERSION + 1, records: [] }),
      ],
    ])("append() refuses to overwrite %s", (_description, raw) => {
      const storage = new MapStorage();
      storage.setItem("test.records", raw);
      const store = createRecordsStore(storage, "test.records");

      let caught: unknown;
      try {
        store.append(makeRecord("a"));
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(RecordsEnvelopeConflictError);
      expect((caught as RecordsEnvelopeConflictError).code).toBe(
        "ERR_RECORDS_ENVELOPE_CONFLICT",
      );
      // The raw value must be left exactly as it was — append() never wrote.
      expect(storage.getItem("test.records")).toBe(raw);
    });
  });
});
