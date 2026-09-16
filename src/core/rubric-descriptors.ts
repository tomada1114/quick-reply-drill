import type { ItemId, Score } from "./rubric";

/**
 * The six level descriptors for every fixed rubric item.
 *
 * @remarks
 * Each sentence is written for a one- or two-sentence English chat reply.
 * Level 0 covers no reply, non-English content, or an unrelated response;
 * levels 1 through 5 describe the observable quality that separates adjacent
 * scores. Changes to these sentences require a `RUBRIC_VERSION` bump.
 */
export const RUBRIC_DESCRIPTORS = {
  respondsToPartner: {
    0: "No reply, or the response is not in English or unrelated to what the partner sent.",
    1: "The English reply ignores the partner's question or share, or contradicts it.",
    2: "The reply reacts to only a small part of what the partner sent, leaving the main point unaddressed.",
    3: "The reply responds to the main point but misses an important part or needs interpretation.",
    4: "The reply responds to what the partner sent and misses only a minor detail.",
    5: "The reply responds directly and accurately to every part of what the partner sent.",
  },
  keepsItGoing: {
    0: "No reply, or the response is not in English or unrelated, so it gives the partner nothing to continue.",
    1: "The reply is a dead end, such as `Good.` or `Yes, I can.`, and gives the partner no opening.",
    2: "The reply gives a minimal reaction, but the partner has little to pick up or answer.",
    3: "The reply gives the partner one usable detail, reason, question, or related share to pick up.",
    4: "The reply gives a clear, natural opening that invites the partner to respond.",
    5: "The reply responds to the partner and gives a native speaker an easy, natural next turn.",
  },
  grammar: {
    0: "No reply, or the response is not in English or unrelated, so there is no useful grammar to assess.",
    1: "The English reply contains frequent grammar errors that obscure relationships between words or clauses.",
    2: "Several grammar errors are noticeable, but the basic meaning remains recoverable.",
    3: "The grammar is mostly correct; a few errors in tense, articles, agreement, or word order remain.",
    4: "With a full content clause, the grammar is correct apart from one minor slip that does not affect natural reading.",
    5: "With a full content clause, the grammar is fully correct for a concise chat reply, including tense, agreement, articles, and word order.",
  },
  spellingPunctuation: {
    0: "No reply, or the response is not in English or unrelated, so spelling and punctuation cannot support an answer.",
    1: "Frequent misspellings and punctuation errors make the English reply difficult to read.",
    2: "Several spelling or punctuation errors remain, but the reply is still readable.",
    3: "Spelling and punctuation are mostly correct, with a few noticeable errors.",
    4: "With a full content clause, spelling and punctuation are correct apart from one minor typo or misplaced mark.",
    5: "With a full content clause, spelling and punctuation are consistently correct and suit a concise chat reply.",
  },
  wordChoice: {
    0: "No reply, or the response is not in English or unrelated, so its word choice cannot answer the prompt.",
    1: "Words are frequently wrong or too vague, making the intended meaning inaccurate.",
    2: "Basic words convey the gist, but several choices are noticeably inexact or unnatural.",
    3: "Word choices are mostly appropriate, with one or two generic or slightly inaccurate terms.",
    4: "With a full content clause, the reply uses precise, natural words, with only a minor mismatch in nuance.",
    5: "With a full content clause, every word is precise, natural, and concise for the intended chat situation.",
  },
  collocation: {
    0: "No reply, or the response is not in English or unrelated, so there are no useful word combinations to assess.",
    1: "Most word combinations look directly translated or clash, making the reply sound unnatural.",
    2: "Several translated-sounding combinations are understandable but not natural English.",
    3: "Common combinations are mostly natural, but a few literal pairings still sound translated.",
    4: "With a full content clause, word combinations sound natural except for one mildly literal phrase.",
    5: "With a full content clause, all word combinations are idiomatic for a short chat reply; none sounds translated.",
  },
  toneRegister: {
    0: "No reply, or the response is not in English or unrelated, so its tone cannot fit the situation.",
    1: "The tone is clearly inappropriate for the relationship, such as hostile, dismissive, or wrongly formal.",
    2: "The tone is partly suitable but noticeably too blunt, formal, casual, or familiar.",
    3: "The tone is acceptable for the relationship, though warmth or politeness is uneven.",
    4: "Tone and politeness fit the relationship, with only a minor mismatch in directness or formality.",
    5: "Tone, politeness, and directness precisely fit the relationship and situation.",
  },
  chatForm: {
    0: "No reply, or the response is not in English or unrelated, so it has no usable chat form.",
    1: "The reply is far too long, fragmented, or shaped like an essay instead of a chat response.",
    2: "The reply is usable but includes unnecessary detail or an awkward structure for chat.",
    3: "The reply is one or two sentences and readable, but its length or shape could be tighter.",
    4: "The reply is concise and chat-shaped, with only a small excess or missing connective.",
    5: "The reply is one or two well-shaped sentences, concise and easy to send as chat.",
  },
} as const satisfies Record<ItemId, Record<Score, string>>;
