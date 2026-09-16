# Adding a provider adapter

Read `src/ai/adapters/openai/` first: it is the shape this procedure produces, and the
one a second provider reproduces. Five small modules — the client, the request builder,
the error mapping, the deadline, and the `generate` that joins them — which is what
keeps any one of them under the per-file budget `eslint.config.mjs` sets.

The design keeps `LlmPort` as the vendor-neutral seam. The Vercel AI SDK core and a
provider SDK are implementation details of the adapter under `src/ai/adapters/`, so the
adapter must implement the existing port rather than replacing it.

## Before you start

**REQUIRED:** `managing-dependencies` — a vendor SDK is a runtime dependency, and the
review record it owes is settled before the code, not after. **REQUIRED:**
`writing-tests` for the contract suite's own conventions.

The adapter itself is the smaller half of this work. The larger half is the gate and
boundary files that assert against the AI layer's shape, listed under "The gates that
know the vendor" below.

## The adapter

1. `src/ai/adapters/<vendor>/` — a new directory. Nothing outside `src/ai/` may import
   from it, and nothing inside it may import another adapter.
2. Implement `LlmPort` from `src/ai/port.ts`, exactly as it is written: `generate`
   resolves to a `Result` for every expected failure, and settles whether or not the
   caller passed a signal. Both promises are asserted by the contract suite, so an
   adapter that breaks one fails rather than degrading quietly.
3. Take construction-time configuration as an options interface — credential, model,
   token ceiling, per-attempt timeout, retry count, deadline, and a `fetch` override.
   The `fetch` override is not optional in practice: it is the whole record/replay seam,
   and without it the adapter cannot be tested without a network.
4. Map the vendor's failures onto `LlmErrorCode` in its own module. Copy the axis, not
   the status numbers: the code is chosen by what a caller can _do_, and an unrecognised
   failure falls to `ERR_LLM_UNAVAILABLE`.
5. Compose a total deadline into the request's signal — see `integrating-llm`'s "A
   request settles, in three parts". A vendor SDK that offers a per-attempt timeout does
   not thereby bound the whole call.
6. Publish it from `src/ai/index.ts`. That file is the layer's whole surface; the
   adapter's own modules stay private to it.

## The contract suite

Add one call at the bottom of `tests/ai-port.test.ts`:

```ts
describeLlmPortContract("createMyAdapter", {
  // A fixture whose answer is CONTRACT_ANSWER.
  succeeds: () => replaying("success"),
  // A fixture whose answer does not match CONTRACT_SCHEMA.
  returnsInvalidOutput: () => replaying("invalid-output"),
  // One port per LlmErrorCode, provoked however that vendor produces it — a
  // timeout is a property of the connection rather than of a response, so it
  // has no fixture and is arranged with `neverAnswering()` and a short timeout.
  failsWith: (code) => portFor(code),
  // A fetch that never resolves, under a timeout longer than the suite budget.
  neverAnswers: () => neverAnswering(),
});
```

`replaying`, `portFor` and `neverAnswering` above are yours to write, one set per
vendor; `tests/openai-stub.ts` is the worked version, where `stubFetch` answers a
fixture body at one URL and throws at every other. The harness is the only thing that
differs between adapters; the assertions do not, and that is the point — the same cases
run against the fake and against yours. `failsWith` must be able to produce **every**
member of `LlmErrorCode`; if one of them cannot be provoked from your vendor, that is a
finding about the mapping, not a case to skip.

Adapter-specific behaviour — the status table, a vendor quirk, the request body it
builds — goes in its own suite, `tests/ai-<vendor>.test.ts`, not into the shared
contract.

## The gates that know the vendor

- `eslint.config.mjs` — the SDK ban is `LLM_SDK`, a named constant used by five
  `boundaries/*` blocks covering the core, non-adapter AI modules, port, app and server.
  Add the new package to it; keep the blocks' file sets disjoint, as the comment above
  them requires.
- `tests/boundaries.test.ts` — its own `LLM_SDKS` list, restated rather than imported so
  the two layers stay independently checkable. The scanner walks every `.ts`/`.tsx` file
  under `src/`; `SCAN_ANCHORS` only proves that the recursive walk reaches
  representative depths and zones, rather than serving as an exhaustive file list.
- `tests/ai-vendor-swap.test.ts` — re-create it. It was deleted with the Anthropic
  adapter because every assertion in it named a vendor that no longer appears anywhere;
  the first adapter is what gives it a subject again.
- `src/server/env.ts` and `.env.example` — a credential is a name in the schema and a
  matching line in the example. `tests/server-env.test.ts` asserts the correspondence.
- `vitest.config.ts` — a suite that reads fixtures from disk joins `automationTests`.
  **REQUIRED:** `placing-tests`.
- `src/server/composition.ts` — the one-line vendor choice. It is a line edit, not a
  runtime switch: no environment variable selects between adapters, because that moves
  the choice out of the file whose whole job is to hold it.

## What not to do

- Do not make the adapter selectable at runtime. Two adapters wired behind an
  environment variable means the composition root no longer answers "which vendor does
  this application call".
- Do not widen `LlmRequest` to carry something only your vendor needs. If the port has
  to change, that is a change to what _every_ adapter promises, and it is argued for on
  its own rather than smuggled in with an adapter.
- Do not add a mocking or HTTP-recording dependency. The `fetch` override already
  substitutes the transport, and a library that intercepts at a different layer stops
  testing the code that actually runs.
