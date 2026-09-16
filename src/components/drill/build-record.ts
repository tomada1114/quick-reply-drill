import { CRITERIA, ITEM_IDS, RUBRIC_VERSION, type Score } from "@/core/rubric";
import type { DrillRecord } from "@/core/records";
import type { ScoreResponse, WireQuestion } from "@/core/wire";

/** The profile a forced-empty record carries when no reply has ever been scored yet. */
const UNSCORED_MODEL = { alias: "unscored", reasoningEffort: "unscored" } as const;

/** The rationale every item carries on a reply that was never sent. */
const FORCED_EMPTY_RATIONALE = "No reply was sent before the clock ran out.";

/** The question shape a `DrillRecord` stores, built once and shared by both builders below. */
function recordQuestion(question: WireQuestion): DrillRecord["question"] {
  return {
    text: question.question,
    scenarioLine: question.scenarioLine,
    seed: question.seed,
  };
}

/** What both builders below need to identify and place one record. */
interface RecordIdentity {
  readonly id: string;
  readonly recordedAt: string;
  readonly question: WireQuestion;
  readonly answer: string;
  readonly forcedSubmit: boolean;
  readonly elapsedMs: number;
}

/** Builds the `DrillRecord` for a reply the model actually graded. */
export function buildScoredRecord(
  identity: RecordIdentity & { readonly response: ScoreResponse },
): DrillRecord {
  const { response, ...rest } = identity;
  return {
    ...rest,
    question: recordQuestion(identity.question),
    scores: Object.fromEntries(
      ITEM_IDS.map((itemId) => [itemId, response.items[itemId].score]),
    ) as Record<(typeof ITEM_IDS)[number], Score>,
    rationales: Object.fromEntries(
      ITEM_IDS.map((itemId) => [itemId, response.items[itemId].rationale]),
    ) as Record<(typeof ITEM_IDS)[number], string>,
    comments: {
      clarity: response.comments.clarity,
      accuracy: response.comments.accuracy,
      vocabulary: response.comments.vocabulary,
      appropriateness: response.comments.appropriateness,
    },
    modelReply: response.modelReply,
    model: response.model,
    rubricVersion: response.rubricVersion,
  };
}

/**
 * Builds the zero-score `DrillRecord` for a reply the clock forced through
 * empty: every item at 0, one shared rationale, empty comments and model
 * reply, and never sent to the model.
 */
export function buildForcedEmptyRecord(
  identity: Omit<RecordIdentity, "forcedSubmit"> & {
    readonly lastModel:
      { readonly alias: string; readonly reasoningEffort: string } | undefined;
  },
): DrillRecord {
  const { lastModel, ...rest } = identity;
  return {
    ...rest,
    question: recordQuestion(identity.question),
    forcedSubmit: true,
    scores: Object.fromEntries(ITEM_IDS.map((itemId) => [itemId, 0])) as Record<
      (typeof ITEM_IDS)[number],
      Score
    >,
    rationales: Object.fromEntries(
      ITEM_IDS.map((itemId) => [itemId, FORCED_EMPTY_RATIONALE]),
    ) as Record<(typeof ITEM_IDS)[number], string>,
    comments: Object.fromEntries(
      CRITERIA.map((criterion) => [criterion.id, ""]),
    ) as DrillRecord["comments"],
    modelReply: "",
    model: lastModel ?? UNSCORED_MODEL,
    rubricVersion: RUBRIC_VERSION,
  };
}
