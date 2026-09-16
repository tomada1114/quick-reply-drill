# quick-reply-drill

[![CI](https://github.com/tomada1114/quick-reply-drill/actions/workflows/ci.yml/badge.svg)](https://github.com/tomada1114/quick-reply-drill/actions/workflows/ci.yml)

Answer a one-line English question in thirty seconds, and get it scored the same way
every time.

## What this is

A Next.js application on the App Router: a page tree, two JSON endpoints, and every
language-model call kept behind an interface rather than made directly. ESM-only
TypeScript throughout.

Two things follow from that last part. A missing credential is not a start-up failure —
`pnpm dev` runs and every page renders with nothing configured, and an endpoint that
needs the model says so, per request, as `ERR_LLM_AUTH`. And the provider-specific
implementation stays behind the same port, so callers do not depend on an SDK.

It grew out of a template. The template's locale-prefixed page tree and its `next-intl`
catalogs are gone — this application renders one language, English — and so are its
Anthropic adapter and the echo endpoint it shipped to demonstrate the handler seam.

`AGENTS.md` describes the architecture and the rules; this file is the tour.

## Quick start

```sh
pnpm install
pnpm dev
```

Then open <http://127.0.0.1:3000>. The page it renders is `src/app/page.tsx`.

There are two API routes. `POST /api/questions` takes `{ "count": 3 }` and answers with
that many drilled questions, each with the scenario it was drawn for. `POST /api/score`
takes `{ "question", "scenarioLine", "answer" }` and answers with the eight rubric
items, one comment per criterion, a corrected version of the reply, and the rubric
version and model that produced them. Both ask the model to write in English, which is
the one language this application deals in.

Both call a model, so both need `OPENAI_API_KEY`: copy `.env.example` to `.env` and fill
it in. Without one, the pages still render and each endpoint answers `500 ERR_LLM_AUTH`
without opening a socket. `src/server/composition.ts` is the single place that decides
which adapter is behind them, and `src/server/llm-profiles.ts` the single place that
names a model.

The endpoints accept only browser requests whose `Sec-Fetch-Site` is `same-origin`; a
missing or cross-site header gets `403 ERR_FORBIDDEN_ORIGIN` before the body is read.
The `dev` and `start` commands bind to `127.0.0.1`, so another machine cannot reach the
local server. The header is a CSRF-grade guard rather than authentication; when this is
deployed, put access control in front of the app or use a one-time passphrase cookie.

What a route does bound is the size of a request. Every field is trimmed and bounded by
the schema in `src/core/wire.ts` — a reply to grade is 1 to 600 characters — and the
body is refused with `413` once it crosses 64 KiB while it is being read, before the
model is asked, on either path. That last ceiling is `MAX_REQUEST_BODY_BYTES` in
`src/server/request-body.ts`.

## Development

This package is private: nothing here is packed, published, or consumed as a tarball.

```sh
corepack pnpm@11.18.0 install --frozen-lockfile
pnpm check:quick
```

The install puts the Git hooks in place on its own — lefthook's `postinstall` does it,
on every non-CI install — and `package.json`'s `prepare` script then runs
`scripts/verify-hooks.mjs`, which fails the install if the pre-commit hook did not
actually land. So there is no setup step for the hooks; `pnpm hooks:install` is the
repair when that check reports one is needed.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete workflow, and
[AGENTS.md](AGENTS.md) for the architecture, the command index, and the rules every
change is held to.

## License

[MIT](LICENSE) © tomada
