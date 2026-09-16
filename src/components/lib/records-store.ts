import {
  MAX_RECORDS,
  RECORDS_STORAGE_VERSION,
  recordsEnvelopeSchema,
  type DrillRecord,
} from "@/core/records";

/** The `localStorage` key a store reads and writes when none is given. */
const DEFAULT_KEY = "quick-reply-drill.records";

/** The subset of the `Storage` interface a record store needs. */
export type RecordStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** What `createRecordsStore` returns. */
export interface RecordsStore {
  /** Every stored record, newest first. */
  list(): DrillRecord[];
  /** Adds a record, trimming to {@link MAX_RECORDS}. */
  append(record: DrillRecord): void;
  /** Removes every stored record. */
  clear(): void;
}

/**
 * The stored records, newest first, or `[]` when there is nothing usable to
 * read.
 *
 * @remarks
 * A missing key, JSON that fails to parse, and an envelope that fails
 * {@link recordsEnvelopeSchema} — including one written by a future
 * version — all read as empty rather than throw. A broken store must not
 * brick the drill, and the next {@link RecordsStore.append} overwrites
 * whatever was there with a fresh, valid envelope.
 */
function readRecords(storage: RecordStorage, key: string): DrillRecord[] {
  const raw = storage.getItem(key);
  if (raw === null) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const envelope = recordsEnvelopeSchema.safeParse(parsed);
  return envelope.success ? envelope.data.records : [];
}

/**
 * Builds a `localStorage`-backed store of {@link DrillRecord}s.
 *
 * @remarks
 * `storage` is injected — the screen passes `window.localStorage` — so this
 * module stays pure over the interface and testable in Node with an
 * in-memory stand-in. Nothing here logs: a broken or unparsable value in
 * storage is silently treated as empty, per `no-console`.
 */
export function createRecordsStore(
  storage: RecordStorage,
  key: string = DEFAULT_KEY,
): RecordsStore {
  return {
    list(): DrillRecord[] {
      return readRecords(storage, key);
    },

    append(record: DrillRecord): void {
      const records = [record, ...readRecords(storage, key)].slice(0, MAX_RECORDS);
      storage.setItem(
        key,
        JSON.stringify({ version: RECORDS_STORAGE_VERSION, records }),
      );
    },

    clear(): void {
      storage.removeItem(key);
    },
  };
}
