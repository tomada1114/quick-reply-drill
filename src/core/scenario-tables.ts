/**
 * The interlocutor / setting / topic tables a scenario is drawn from.
 *
 * @remarks
 * Every label is the exact words a prompt will see, written to read
 * naturally inside a sentence such as "a friend from a hobby group messages
 * you in a group chat about weekend plans". Kept separate from
 * `scenarios.ts` so the draw logic stays under this repository's per-file
 * line budget — the same split `rubric.ts`/`rubric-descriptors.ts` uses.
 *
 * This set of tables drills one goal: keeping a casual conversation going —
 * getting to know someone, small talk with a friend, chat as rehearsal for a
 * face-to-face conversation. Work register (a manager, a client, a support
 * thread) is out of scope for it. A future user-selectable goal — work
 * register, precise answering, and so on — belongs in a separate table set
 * paired with its own rubric, not in extra rows appended to this one.
 */

/** Someone the practising user is chatting with. */
export interface Interlocutor {
  readonly id: string;
  readonly label: string;
  readonly relationship: "justMet" | "familiar" | "close";
}

/** Where the chat is happening. */
export interface Setting {
  readonly id: string;
  readonly label: string;
  readonly register: "casual" | "neutral";
}

/** What the chat is about. */
export interface Topic {
  readonly id: string;
  readonly label: string;
}

/**
 * Who a scenario is drawn against.
 *
 * @remarks
 * At least eight, spanning all three {@link Interlocutor.relationship}
 * values so a batch of scenarios is not drawn from only one end of the
 * closeness spectrum.
 */
export const INTERLOCUTORS = [
  {
    id: "partyStranger",
    label: "someone you just met at a party",
    relationship: "justMet",
  },
  {
    id: "friendOfAFriend",
    label: "a friend of a friend",
    relationship: "justMet",
  },
  {
    id: "languageExchangePartner",
    label: "a language-exchange partner",
    relationship: "justMet",
  },
  {
    id: "hobbyGroupFriend",
    label: "a friend from a hobby group",
    relationship: "familiar",
  },
  { id: "neighbour", label: "a neighbour", relationship: "familiar" },
  {
    id: "newCoworker",
    label: "a new coworker, over lunch",
    relationship: "familiar",
  },
  { id: "closeFriend", label: "a close friend", relationship: "close" },
  { id: "familyMember", label: "a family member", relationship: "close" },
  { id: "roommate", label: "a roommate", relationship: "close" },
] as const satisfies readonly Interlocutor[];

/**
 * Where a scenario is set.
 *
 * @remarks
 * At least six, spanning both {@link Setting.register} values so a batch of
 * scenarios is not drawn from only one tone.
 */
export const SETTINGS = [
  { id: "groupChat", label: "a group chat with friends", register: "casual" },
  {
    id: "directMessage",
    label: "a one-on-one direct message",
    register: "neutral",
  },
  {
    id: "publicReply",
    label: "a reply under a public post",
    register: "casual",
  },
  {
    id: "familyThread",
    label: "a text message thread with family",
    register: "casual",
  },
  {
    id: "firstContactChat",
    label: "a first chat after exchanging contacts",
    register: "neutral",
  },
  {
    id: "hobbyGroupChat",
    label: "a hobby group's chat",
    register: "casual",
  },
  {
    id: "morningAfterMessage",
    label: "a message the morning after meeting",
    register: "neutral",
  },
] as const satisfies readonly Setting[];

/**
 * What a scenario is about.
 *
 * @remarks
 * At least twenty, so a batch large enough to cover the interlocutor and
 * setting tables still varies the subject of every question.
 */
export const TOPICS = [
  { id: "weekendPlans", label: "weekend plans" },
  { id: "lunchChoice", label: "a lunch choice" },
  { id: "trip", label: "a trip" },
  { id: "brokenThing", label: "a broken thing" },
  { id: "favour", label: "a favour" },
  { id: "apology", label: "an apology" },
  { id: "recommendation", label: "a recommendation" },
  { id: "scheduleChange", label: "a schedule change" },
  { id: "sharedBill", label: "a shared bill" },
  { id: "birthday", label: "a birthday" },
  { id: "pet", label: "a pet" },
  { id: "delayedReply", label: "a delayed reply" },
  { id: "giftIdea", label: "a gift idea" },
  { id: "planChange", label: "a change of plans" },
  { id: "nightOut", label: "a night out" },
  { id: "healthConcern", label: "a health concern" },
  { id: "movingDay", label: "a moving day" },
  { id: "lostItem", label: "a lost item" },
  { id: "noiseComplaint", label: "a noise complaint" },
  { id: "hometown", label: "where you're from" },
  { id: "occupation", label: "what you do" },
  { id: "food", label: "a favourite food" },
  { id: "music", label: "music you like" },
  { id: "film", label: "a film you watched" },
  { id: "sport", label: "a sport you follow" },
  { id: "learningLanguage", label: "learning a language" },
  { id: "sharedPlace", label: "a place you both know" },
] as const satisfies readonly Topic[];
