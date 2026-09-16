/**
 * The fixed criteria and items used to score a quick chat reply.
 *
 * @remarks
 * Four criteria contain two items each. Every item is scored from 0 to 5, so
 * the table is the domain vocabulary shared by descriptors, scoring, and the
 * records that will store a result. Keep item order stable: it is the order
 * shown in the feedback UI and in {@link ITEM_IDS}.
 */
export const CRITERIA = [
  {
    id: "clarity",
    label: "Gets the message across",
    items: [
      { id: "answersQuestion", label: "Answers the question" },
      { id: "intentClear", label: "Intent is clear on one read" },
    ],
  },
  {
    id: "accuracy",
    label: "Accuracy",
    items: [
      { id: "grammar", label: "Grammar" },
      { id: "spellingPunctuation", label: "Spelling and punctuation" },
    ],
  },
  {
    id: "vocabulary",
    label: "Vocabulary and naturalness",
    items: [
      { id: "wordChoice", label: "Word choice" },
      {
        id: "collocation",
        label: "Collocation, no translated-sounding phrasing",
      },
    ],
  },
  {
    id: "appropriateness",
    label: "Fit for the situation",
    items: [
      {
        id: "toneRegister",
        label: "Tone and politeness for the relationship",
      },
      { id: "chatForm", label: "Length and shape for a chat reply" },
    ],
  },
] as const;

/** The four fixed criterion identifiers. */
export type CriterionId = (typeof CRITERIA)[number]["id"];

/** The eight fixed item identifiers. */
export type ItemId = (typeof CRITERIA)[number]["items"][number]["id"];

/** The item identifiers in the order the rubric presents them. */
export const ITEM_IDS = [
  "answersQuestion",
  "intentClear",
  "grammar",
  "spellingPunctuation",
  "wordChoice",
  "collocation",
  "toneRegister",
  "chatForm",
] as const satisfies readonly ItemId[];

/** The closed set of scores an item may receive. */
export const SCORE_LEVELS = [0, 1, 2, 3, 4, 5] as const;

/** A score for one rubric item. */
export type Score = (typeof SCORE_LEVELS)[number];

/**
 * The version of the rubric used to produce a score.
 *
 * @remarks
 * Any edit to the rubric descriptors or to the scoring prompt's wording must
 * bump this value. A stored score is comparable to another only when both
 * records carry the same rubric version.
 */
export const RUBRIC_VERSION = "2026-09.1";
