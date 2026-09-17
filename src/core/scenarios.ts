/**
 * The seed draw for a generated question.
 *
 * @remarks
 * A question is not authored by hand: it is an app-side combination of who is
 * asking, where, and about what, handed to the model as the seed for one
 * generated question. `INTERLOCUTORS` × `SETTINGS` covers casual and neutral
 * registers against justMet, familiar and close relationships, which is what
 * spreads the rubric's "fit for the situation" criterion across reps rather
 * than letting every rep land on the same register. The tables themselves
 * live in `./scenario-tables` and are re-exported here so this file stays the
 * one surface a caller imports.
 */
export {
  INTERLOCUTORS,
  SETTINGS,
  TOPICS,
  type Interlocutor,
  type Setting,
  type Topic,
} from "./scenario-tables";
import { INTERLOCUTORS, SETTINGS, TOPICS } from "./scenario-tables";
import type { Interlocutor, Setting, Topic } from "./scenario-tables";

/** One drawn combination of interlocutor, setting and topic. */
export interface ScenarioSeed {
  readonly interlocutor: Interlocutor;
  readonly setting: Setting;
  readonly topic: Topic;
}

/** Every distinct interlocutor/setting/topic triple, in table order. */
function allTriples(): ScenarioSeed[] {
  const triples: ScenarioSeed[] = [];

  for (const interlocutor of INTERLOCUTORS) {
    for (const setting of SETTINGS) {
      for (const topic of TOPICS) {
        triples.push({ interlocutor, setting, topic });
      }
    }
  }

  return triples;
}

/**
 * Draws `count` distinct triples without replacement from `pool`.
 *
 * @remarks
 * `index` is always within `remaining`'s current bounds because the loop
 * runs at most `pool.length` times and removes exactly one element per
 * iteration, so `splice` always returns the removed element. The
 * `undefined` check below satisfies `noUncheckedIndexedAccess` rather than
 * guarding against a reachable case.
 */
function drawWithoutReplacement<T>(
  pool: readonly T[],
  count: number,
  random: () => number,
): T[] {
  const remaining = [...pool];
  const drawn: T[] = [];

  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(random() * remaining.length);
    const [picked] = remaining.splice(index, 1);

    if (picked === undefined) {
      throw new Error("drawWithoutReplacement: pool exhausted unexpectedly");
    }

    drawn.push(picked);
  }

  return drawn;
}

/**
 * Draws `count` distinct scenario seeds.
 *
 * @remarks
 * A seed is never shown to the user as the app-side draw it is (see the
 * module remarks); it only decides what the generated question is about.
 * The draw is over every distinct `(interlocutor, setting, topic)` triple,
 * so two seeds in the same batch never repeat all three fields together.
 * `random` defaults to `Math.random` and is otherwise called only through
 * it, so passing a seeded generator makes the returned sequence
 * reproducible.
 *
 * @throws {RangeError} When `count` is negative, not an integer, or greater
 * than the number of distinct triples the tables can produce.
 */
export function drawSeeds(
  count: number,
  random: () => number = Math.random,
): ScenarioSeed[] {
  const triples = allTriples();

  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(
      `drawSeeds: count must be a non-negative integer, got ${String(count)}`,
    );
  }

  if (count > triples.length) {
    throw new RangeError(
      `drawSeeds: count (${String(count)}) exceeds the number of distinct triples (${String(triples.length)})`,
    );
  }

  return drawWithoutReplacement(triples, count, random);
}
