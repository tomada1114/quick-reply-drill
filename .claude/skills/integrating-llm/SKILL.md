---
name: integrating-llm
description: >
  Covers the AI layer under src/ai/: what belongs on the vendor-neutral LlmPort versus
  inside an adapter, why a vendor SDK is importable only under src/ai/adapters/, what a
  structured-output schema does and does not guarantee, where a request's deadline sits,
  and which ERR_LLM_* code a failure becomes. Use when editing the port, writing the
  first provider adapter, wiring a model call in src/server/composition.ts, swapping or
  adding a provider, or when a call hangs or reaches the network in CI.
---

# Integrating an LLM

**Owns:** the AI layer under `src/ai/` — what the port promises, what an adapter may
know, how a structured answer is constrained and validated, where a request's deadline
is enforced, and which `ERR_LLM_*` code a given failure becomes. **Does not own:** the
shape of an error class or the `ERR_*` naming vocabulary (`designing-errors` — this
skill owns only what each `ERR_LLM_*` code _means_ and when an adapter produces it); the
Route Handler that calls the port and the HTTP status it answers with
(`building-app-routes`); how a test case is written (`writing-tests`) and which project
it joins (`placing-tests`).

Model ids and pricing are deliberately not written down here — they go stale faster than
a skill is reread.

## The LlmPort seam and its two adapters

Under `src/ai/` sit the vendor-neutral half — `port.ts`, `errors.ts`, `index.ts` — and
two implementations of it. `adapters/fake/` answers from a fixed configuration, and is
what `pnpm dev` and the composition root use today. `adapters/openai/` reaches OpenAI's
Responses API through the Vercel AI SDK, and is the worked example the sections below
describe: five small modules, and the `LlmPort` it returns is the only thing a caller
sees.

Two properties of that pair are worth naming before you change either:

- **The port is evidenced by the second adapter, not by the fake.** A fake agrees with
  any interface, including one no real provider could implement. What proves `LlmPort`
  is genuinely vendor-neutral is `describeLlmPortContract` running the identical
  assertions against both, at the bottom of `tests/ai-port.test.ts`.
- **A provider adapter is tested through its transport.** `adapters/openai/` takes a
  `fetch` override, and `tests/openai-stub.ts` substitutes one that answers hand-written
  bodies from `tests/fixtures/openai/` and throws for any other URL. That keeps both
  properties a replacement must also keep: CI never reaches the network, and the adapter
  under test is the real one rather than a mock of it.

## Port or adapter

`src/ai/port.ts` is the whole vendor-neutral vocabulary: a schema, optional system-level
instructions, a per-request prompt, a BCP 47 `outputLanguage`, an optional
`AbortSignal`, and a `generate` that resolves to a `Result`. Read its TSDoc first — it
states the two promises every implementation makes, never throwing for an expected
failure and always settling, and those are what a new adapter is measured against.

Everything a provider needs that the port does not name — a model id, a token ceiling, a
per-attempt timeout, a retry count, an HTTP client, a reasoning effort — is
**construction-time configuration of one adapter**, not a request field. That is the
test for where a new knob goes: on `LlmRequest` it would make the same request
un-runnable against the fake, and the fake is what the contract suite and `pnpm dev` run
on.

A language-model SDK is importable **only** under `src/ai/adapters/`. Enforced by
`eslint.config.mjs`'s `LLM_SDK` list inside its `boundaries/*` blocks, asserted again
from the module graph by `tests/boundaries.test.ts`. Those gates cover `src/core/`, the
non-adapter modules under `src/ai/`, `src/app/` and `src/server/`. The separate zone
rule still covers the adapter subtree, so an adapter may use its SDK but cannot reach up
to `src/app/` or `src/server/`. `src/ai/port.ts`, `errors.ts` and `index.ts` must stay
SDK-free, or the port stops being an interface a second vendor could implement.
`src/ai/index.ts` is the layer's whole surface, and `src/server/composition.ts` the
single line choosing a vendor.

`ai`, the Vercel AI SDK's vendor-neutral core, is included in that ban outside
`src/ai/adapters/`. It names no vendor, but it is still an implementation detail; the
port remains the application-facing seam and adapters are the only place that may use
the SDK.

## Two layers of structured output, and only one is guaranteed

**The schema guarantees the _structure_. It never guarantees the _quality_.** Conflating
those is the mistake this section exists to prevent: `z.object({ answer: z.string() })`
is satisfied exactly as completely by `"yes"` as by the paragraph you wanted.
Granularity and usefulness are the prompt's job, plus a post-hoc check written into the
schema — a length floor, an enum, a `refine` — so a shortfall arrives as
`ERR_LLM_INVALID_OUTPUT` rather than as a plausible-looking answer nobody notices.

The structure half is worth guaranteeing twice, against two different things, and an
adapter owes both passes:

1. Convert the caller's Zod schema to the provider's structured-output format and send
   it, so the API validates the model's answer against the derived JSON Schema before
   returning it.
2. Validate the same answer against the Zod schema _itself_, with `safeParseAsync`.

The second pass is not belt-and-braces. The conversion to JSON Schema silently drops
what JSON Schema cannot express — a `refine`, a brand — so an answer the API accepted
can still fail the contract the caller wrote; while a construct with no JSON Schema
equivalent at all (`transform`, `pipe`, `z.date`) makes the conversion _throw_ instead,
which is why building the request is its own guarded step.

`safeParseAsync`, never the synchronous `safeParse`: the latter throws outright on a
schema carrying an async refinement, the one thing `LlmPort` promises never to do for an
expected failure. `src/ai/adapters/fake/index.ts` carries that note and is the reference
an adapter copies; the contract suite asserts it against every adapter.

## A request settles, in three parts

`LlmPort.generate` promises to settle, and a caller's `AbortSignal` is optional — so an
adapter may never assume someone else will time it out. Three bounds compose:

- **The SDK's own per-attempt `timeout`** bounds one attempt, and typically only as far
  as the response headers: an SDK that clears its timer when the `Response` resolves
  leaves a provider that answers `200` and then dribbles bytes unbounded. Pin the retry
  count in the same place, because an SDK's default multiplies against that timeout.
- **The adapter's own total deadline** covers the whole call — every attempt and the
  body read — and covers it with no caller signal at all. Derive it from the resolved
  per-attempt timeout and retry count rather than fixing it, so a caller who configures
  either still gets a total bound that fits what they asked for.
- **The caller's `AbortSignal`** is an _additional and earlier_ deadline layered on top,
  never the only one there is.

The shape to reject is a bespoke `withTimeout`: a `Promise.race` against a timer settles
the promise the adapter returns while leaving the socket open and the body still
arriving, bounding the caller's wait and nothing else. Compose the deadline _into the
signal the request is made under_, with `AbortSignal.any`, so firing it actually cancels
the transport — and so an abort between attempts ends the retry chain rather than
starting another one.

Two traps an adapter author will not reproduce on their own:

- **A backoff sleep that does not consult the signal.** A deadline firing mid-sleep is
  noticed only when that sleep ends, so the worst case is the deadline plus the longest
  sleep the chain can start. Cap what a `retry-after` may ask for, so that overshoot is
  a number you can state rather than whatever the provider named. Do not claim a tighter
  bound than that in a comment or a document.
- **An out-of-range deadline.** A delay outside `AbortSignal.timeout`'s unsigned 32-bit
  range throws, and if the signal is armed outside every `try` that becomes the rejected
  promise `LlmPort` says never happens. A delay merely above Node's _signed_ 32-bit
  timer ceiling throws nothing at all: Node clamps it and the deadline fires within a
  millisecond, so the failure arrives at completely the wrong time with no error
  anywhere. Validate against the signed ceiling, and throw a `RangeError` at
  construction — the one place this layer throws rather than answering with a `Result`.

## Which `ERR_LLM_*` code, and when

`src/ai/errors.ts` owns the union and its TSDoc groups the members by remedy; it is not
restated here. What this skill owns is the mapping a new adapter must reproduce:

- The axis is **what a caller can do about it** — never which provider produced it, and
  never the status class it arrived in. That is why a `400`/`422` becomes
  `ERR_LLM_INVALID_OUTPUT`: the only request an adapter here builds is the caller's own
  schema and prompt, so a rejected one is re-prompted, not retried or reconfigured.
- Anything unrecognised falls to `ERR_LLM_UNAVAILABLE`, whose remedy — try again later —
  is the safe suggestion for a failure nobody has classified yet.
- Every abort is `ERR_LLM_TIMEOUT`, whichever deadline fired, with the reason carried
  through on `cause` by identity. **REQUIRED:** `designing-errors` for why that identity
  matters and how `asError`/`abortedLlmError` keep it.
- A caller's schema that cannot become JSON Schema is `ERR_LLM_INVALID_OUTPUT` too,
  raised before anything is sent — nothing reached the provider, so it must not be
  reported as a transport failure worth retrying.
- An error never carries the prompt, the model's output, or a credential.
  `designing-errors` owns that rule; it binds hardest here, because a provider's own
  error message can quote the request straight back.

Adding a member to the union changes what _every_ adapter promises, so it is declared in
`src/ai/errors.ts` once and then implemented per adapter. Two compile-time backstops
catch a half-done addition: `ALL_CODES` in `tests/ai-port.test.ts` and
`STATUS_BY_LLM_CODE` in `src/server/http.ts`.

## An adapter never reaches the network in a test

CI must never pay for a test run or fail because a provider was slow, and a credential
in `.env` is a real one — `pnpm test` and `pnpm test:smoke` both answer from the fake
for that reason. Whatever seam a provider adapter is tested through, hold three
properties:

- **Substitute the transport, not the adapter.** Replacing the SDK's `fetch` keeps the
  adapter under test the one that talks to the provider — request built, signed and
  sent, response decoded by the real SDK. A recording or mocking library replaces the
  very thing the test exists to exercise.
- **Record nothing that can carry a credential.** Write down the status and the response
  body only; the request, where the SDK puts the key, is never recorded at all.
  `scripts/lib/guard/credentials.mjs` matches both `sk-ant-` and OpenAI's `sk-` shapes,
  and `scripts/check-staged.mjs` inspects staged blob content whatever the extension, so
  a fixture directory excluded from the formatters is not excluded from the guard. When
  a commit is blocked the answer is to scrub and record again — never `--no-verify`,
  which disables the secret check along with everything else.
- **Recording is a deliberate local run**, never something CI or a dependency bump does
  on its way through.

## A second adapter

The contract suite is the deliverable, not the adapter. `describeLlmPortContract` in
`tests/ai-port.test.ts` is exported so it is called once per implementation against a
four-method harness, and an adapter that cannot fill that harness is one whose failures
no caller can handle uniformly. Procedure:
[references/adding-an-adapter.md](references/adding-an-adapter.md).

Streaming responses are out of scope by decision; a drill that scores a finished answer
has nothing to stream. Revisit that with the design, not with a speculative adapter.

## Swapping the vendor

Keeping the port and replacing what answers behind it is the **common** path, and it is
a bounded edit rather than a rewrite. Two lines of application code decide it.
`src/server/composition.ts` chooses the adapter; `src/ai/index.ts` republishes whichever
adapter the layer is willing to expose. `src/server/env.ts` names the credential, and
`src/server/llm-profiles.ts` holds the model and the reasoning effort each use is
answered with — a Git-managed table rather than an environment variable, because a model
and an effort are product decisions that belong in a reviewed diff. The rest is
manifests and gate configs — the dependency, the import restriction, the environment
example, the automation-test list. A fifth module joining them is the moment the choice
of vendor has escaped the composition root.

Untouched: `src/ai/port.ts`, `src/ai/errors.ts` and the fake adapter — the whole
vendor-neutral vocabulary, and the reason the edit is bounded at all — plus the handler,
which only ever sees an `LlmPort`, and everything above it.

`tests/ai-vendor-swap.test.ts` writes that bound down again and checks it: an exact
match between every file that names a vendor-shaped needle and the list above of where
one may legitimately appear, so a vendor spilling into a sixth module and a listed file
that stopped naming one both fail it. It was deleted once already, when the Anthropic
adapter left and every assertion in it was keyed to a vendor no longer named anywhere —
re-run it before trusting this section again after the next vendor swap.
