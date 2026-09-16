import "server-only";

import * as z from "zod";

/**
 * A setting that may be absent, where a blank value means the same as absent.
 *
 * @remarks
 * `.env.example` ships every name with an empty value, so copying it to `.env`
 * — the first thing anyone does with this template — leaves `KEY=` in the
 * environment. Node reports that as `""`, not as a missing key, and treating
 * the two differently would make a copied example file a configuration error.
 * The value is trimmed because surrounding whitespace is never part of a
 * setting copied from a credential manager.
 */
const optionalSetting = z
  .string()
  .transform((raw) => {
    const value = raw.trim();
    return value === "" ? undefined : value;
  })
  .optional();

/**
 * Every environment variable this application reads.
 *
 * @remarks
 * Adding a name here obliges a matching line in `.env.example`;
 * `tests/server-env.test.ts` asserts that correspondence rather than trusting
 * it.
 */
const serverEnvShape = z.object({
  /**
   * Credential for the OpenAI models this application will call.
   *
   * @remarks
   * Optional although every endpoint needs it, so that a missing key is a
   * failure the request that needed it reports rather than one that stops the
   * process from starting: the adapter answers `ERR_LLM_AUTH` without opening
   * a socket, which is a failure a caller can see and act on, and which keeps
   * `pnpm dev`, the smoke suite and every test off the network with nothing
   * configured. A server that refuses to boot tells nobody which name was
   * absent.
   *
   * Its presence is validated here but its use belongs to the adapter that
   * receives the environment from the composition root.
   */
  OPENAI_API_KEY: optionalSetting,
});

/** The validated environment, as the rest of `src/server/` sees it. */
export type ServerEnv = z.infer<typeof serverEnvShape>;

/** Every name {@link serverEnvShape} declares, for the `.env.example` check. */
export const SERVER_ENV_NAMES: readonly string[] = Object.keys(serverEnvShape.shape);

/**
 * Reads and validates `process.env`.
 *
 * @remarks
 * This is the only place in `src/` that touches `process.env`; every other
 * module receives what it needs as an argument. Keeping the read here is what
 * makes "where does this secret enter the process" a question a reader answers
 * by opening one file.
 *
 * It throws rather than returning a `Result`: a malformed environment is a
 * deployment mistake with no caller-side recovery, so failing where it is read
 * is more useful than threading an error through code that cannot act on it.
 *
 * @returns The validated environment.
 * @throws A `ZodError` naming every variable that did not match its shape.
 */
export function readServerEnv(): ServerEnv {
  return serverEnvShape.parse(process.env);
}
