/**
 * The interlocutor / setting / topic tables a scenario is drawn from.
 *
 * @remarks
 * Every label is the exact words a prompt will see, written to read
 * naturally inside a sentence such as "your manager messages you in a group
 * chat with friends about a deadline slipping". Kept separate from
 * `scenarios.ts` so the draw logic stays under this repository's per-file
 * line budget — the same split `rubric.ts`/`rubric-descriptors.ts` uses.
 */

/** Someone the practising user is chatting with. */
export interface Interlocutor {
  readonly id: string;
  readonly label: string;
  readonly relationship: "close" | "familiar" | "distant";
}

/** Where the chat is happening. */
export interface Setting {
  readonly id: string;
  readonly label: string;
  readonly register: "casual" | "neutral" | "formal";
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
  { id: "closeFriend", label: "a close friend", relationship: "close" },
  {
    id: "hobbyGroupFriend",
    label: "a friend from a hobby group",
    relationship: "familiar",
  },
  { id: "coworker", label: "a coworker", relationship: "familiar" },
  { id: "manager", label: "your manager", relationship: "distant" },
  { id: "client", label: "a client", relationship: "distant" },
  { id: "neighbour", label: "a neighbour", relationship: "familiar" },
  { id: "familyMember", label: "a family member", relationship: "close" },
  {
    id: "onlineStranger",
    label: "a stranger in an online community",
    relationship: "distant",
  },
  { id: "roommate", label: "a roommate", relationship: "close" },
] as const satisfies readonly Interlocutor[];

/**
 * Where a scenario is set.
 *
 * @remarks
 * At least six, spanning all three {@link Setting.register} values so a
 * batch of scenarios is not drawn from only one tone.
 */
export const SETTINGS = [
  { id: "groupChat", label: "a group chat with friends", register: "casual" },
  {
    id: "directMessage",
    label: "a one-on-one direct message",
    register: "neutral",
  },
  { id: "workThread", label: "a work chat thread", register: "formal" },
  {
    id: "publicReply",
    label: "a reply under a public post",
    register: "casual",
  },
  {
    id: "marketplaceChat",
    label: "a marketplace chat with a seller",
    register: "neutral",
  },
  { id: "supportChat", label: "a customer support chat", register: "formal" },
  {
    id: "familyThread",
    label: "a text message thread with family",
    register: "casual",
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
  { id: "deadlineSlipping", label: "a deadline slipping" },
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
  { id: "workMistake", label: "a mistake at work" },
  { id: "giftIdea", label: "a gift idea" },
  { id: "planChange", label: "a change of plans" },
  { id: "nightOut", label: "a night out" },
  { id: "healthConcern", label: "a health concern" },
  { id: "movingDay", label: "a moving day" },
  { id: "lostItem", label: "a lost item" },
  { id: "groupProject", label: "a group project" },
  { id: "subscriptionRenewal", label: "a subscription renewal" },
  { id: "noiseComplaint", label: "a noise complaint" },
] as const satisfies readonly Topic[];
