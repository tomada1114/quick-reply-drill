import * as z from "zod";

import {
  MAX_RECORDS,
  RECORDS_STORAGE_VERSION,
  drillRecordSchema,
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
  /**
   * Adds a record, trimming to {@link MAX_RECORDS}.
   *
   * @throws {RecordsEnvelopeConflictError} When the existing value cannot be
   * fully accounted for — see that class for which values trigger this.
   */
  append(record: DrillRecord): void;
  /** Removes every stored record. */
  clear(): void;
}

/**
 * Thrown by {@link RecordsStore.append} instead of overwriting a stored value
 * it cannot fully account for.
 *
 * @remarks
 * Raised for unparsable JSON, a value that is not an envelope of the current
 * {@link RECORDS_STORAGE_VERSION}, or one written by a future version. Never
 * raised for an envelope of the current version whose individual records
 * merely fail {@link drillRecordSchema} — those are salvaged and dropped, not
 * treated as a conflict. `use-drill.ts`'s `finishRecord` already wraps every
 * `append` call in a `try`/`catch` that surfaces this through
 * `recordSaveError`, so no caller needs a new guard for it.
 */
export class RecordsEnvelopeConflictError extends Error {
  readonly code = "ERR_RECORDS_ENVELOPE_CONFLICT" as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecordsEnvelopeConflictError";
  }
}

/**
 * The shape `readRecords` trusts enough to salvage from: the exact current
 * {@link RECORDS_STORAGE_VERSION} and a `records` array whose entries are not
 * yet individually validated.
 *
 * @remarks
 * `version` is a literal, so a future version's envelope fails this schema
 * exactly like unparsable JSON does — both are conflicts, never data to
 * salvage from.
 */
const envelopeShapeSchema = z.object({
  version: z.literal(RECORDS_STORAGE_VERSION),
  records: z.array(z.unknown()),
});

/** What {@link readRecords} learned about the value stored at a key. */
interface ReadOutcome {
  /** The individually valid records found, newest first. */
  readonly records: DrillRecord[];
  /**
   * Whether {@link RecordsStore.append} may replace the raw stored value with
   * a fresh envelope built from `records` plus the new entry.
   *
   * `false` for a value this code cannot fully account for, so nothing
   * already stored — valid or not — is ever discarded underneath a write
   * this code cannot justify.
   */
  readonly overwritable: boolean;
}

/**
 * Reads the value stored at `key` and reports both what can safely be
 * salvaged from it and whether the raw value may be overwritten.
 *
 * @remarks
 * A missing key is empty and safe to write over. Unparsable JSON and an
 * envelope that fails {@link envelopeShapeSchema} — including one written by
 * a future version — are also read as empty, but are never safe to
 * overwrite: {@link RecordsStore.append} must refuse rather than erase
 * something it cannot read. An envelope of the current version salvages each
 * record that individually passes {@link drillRecordSchema} and drops only
 * the ones that do not, so one bad entry never costs the rest of the
 * history. Nothing here logs: a broken or unparsable value is silently
 * accounted for, per `no-console`. `storage.getItem` itself is left
 * unguarded — a throwing `getItem` propagates to the caller, which is what
 * lets `list()` catch it and return `[]` while `append()` lets it surface
 * as a save failure instead of guessing at a base to write over.
 */
function readRecords(storage: RecordStorage, key: string): ReadOutcome {
  const raw = storage.getItem(key);
  if (raw === null) {
    return { records: [], overwritable: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { records: [], overwritable: false };
  }

  const envelope = envelopeShapeSchema.safeParse(parsed);
  if (!envelope.success) {
    return { records: [], overwritable: false };
  }

  const records = envelope.data.records.flatMap((entry) => {
    const record = drillRecordSchema.safeParse(entry);
    return record.success ? [record.data] : [];
  });

  return { records, overwritable: true };
}

/**
 * Builds a `localStorage`-backed store of {@link DrillRecord}s.
 *
 * @remarks
 * `storage` is injected — the screen passes `window.localStorage` — so this
 * module stays pure over the interface and testable in Node with an
 * in-memory stand-in.
 */
export function createRecordsStore(
  storage: RecordStorage,
  key: string = DEFAULT_KEY,
): RecordsStore {
  return {
    list(): DrillRecord[] {
      try {
        return readRecords(storage, key).records;
      } catch {
        return [];
      }
    },

    append(record: DrillRecord): void {
      const { records, overwritable } = readRecords(storage, key);
      if (!overwritable) {
        throw new RecordsEnvelopeConflictError(
          "Refusing to overwrite a records envelope this code cannot fully read.",
        );
      }
      const next = [record, ...records].slice(0, MAX_RECORDS);
      storage.setItem(
        key,
        JSON.stringify({ version: RECORDS_STORAGE_VERSION, records: next }),
      );
    },

    clear(): void {
      storage.removeItem(key);
    },
  };
}
