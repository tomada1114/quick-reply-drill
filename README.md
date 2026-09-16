# quick-reply-drill

[![CI](https://github.com/tomada1114/quick-reply-drill/actions/workflows/ci.yml/badge.svg)](https://github.com/tomada1114/quick-reply-drill/actions/workflows/ci.yml)

Answer a one-line English question in sixty seconds, and get it scored the same way
every time.

## What this is

The drill asks a one-line English question, gives you sixty seconds to answer it, and
grades the reply against a fixed eight-item rubric — a score and a rationale per item,
one comment per criterion, and a corrected version of what you wrote — before drawing
the next question. Every finished rep is saved to the browser's own storage, and the
dashboard reads that history back as a table of recent runs, a sparkline of the total,
and (on request) an AI-written paragraph about the trend across your newest attempts.

It is a Next.js application on the App Router: a page tree, three JSON endpoints, and
every language-model call kept behind an interface rather than made directly. ESM-only
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

Copy the environment file and put your key in it:

```sh
cp .env.example .env
```

Then:

```sh
pnpm install
pnpm dev
```

Open <http://127.0.0.1:3000> for the drill, or <http://127.0.0.1:3000/dashboard> for the
history and the summary. `src/app/page.tsx` renders the first;
`src/app/dashboard/page.tsx` the second.

## The API

There are three API routes, all `POST`, all same-origin only (see below), and all ask
the model to write in English, the one language this application deals in.

`POST /api/questions` takes `{ "count": 3 }` (1 to 10) and answers with that many
drilled questions, each with the scenario it was drawn for.

`POST /api/score` takes `{ "question", "scenarioLine", "answer" }` and answers with the
eight rubric items, one comment per criterion, a corrected version of the reply, and the
rubric version and model that produced them.

`POST /api/dashboard` takes `{ "records": [...] }` — up to ten of the dashboard's own
newest records that share one rubric version — and answers with one AI-written paragraph
naming the trend across them.

A reply and a grader's own rationale or comment are never interpolated into a prompt
unescaped: each is fenced between a boundary line carrying a random per-request token
minted after the text already exists, so nothing a caller sent could have anticipated
it, and text inside the fence that looks like an instruction or another boundary line is
treated as part of the reply, never as one. A grader's own rationale and comments are
also truncated to a fixed length budget before they are answered back, as a safety net
under the same limit the prompt already asks for.

Every endpoint calls a model, so every one needs `OPENAI_API_KEY`: copy `.env.example`
to `.env` and fill it in. Without one, the pages still render and each endpoint answers
`500 ERR_LLM_AUTH` without opening a socket. `src/server/composition.ts` is the single
place that decides which adapter is behind them, and `src/server/llm-profiles.ts` the
single place that names a model — one profile (a model id and a reasoning effort) per
use. Neither file is configurable through the environment; the only thing there is the
credential.

The endpoints accept only browser requests whose `Sec-Fetch-Site` is `same-origin`; a
missing or cross-site header gets `403 ERR_FORBIDDEN_ORIGIN` before the body is read.
The `dev` and `start` commands bind to `127.0.0.1`, so another machine cannot reach the
local server. The header is a CSRF-grade guard rather than authentication; when this is
deployed, put access control in front of the app — Vercel's own Deployment Protection,
or a one-time passphrase cookie of your own — before it is reachable from outside your
machine.

What a route does bound is the size of a request. Every field is trimmed and bounded by
the schema in `src/core/wire.ts` — a reply to grade is 1 to 600 characters — and the
body is refused with `413` once it crosses 64 KiB while it is being read, before the
model is asked, on any of the three. That last ceiling is `MAX_REQUEST_BODY_BYTES` in
`src/server/request-body.ts`.

## Records

Every finished rep is written to the browser's own `localStorage`, under the key
`quick-reply-drill.records`, as a versioned envelope that `src/core/records.ts`
validates on read — a value this code cannot parse, or one written by an envelope
version it has never seen, is read as empty rather than misread. The store keeps the 50
most recent records and drops the rest on append. Each record carries the rubric version
it was graded under (and the model alias, for reference); the dashboard groups by rubric
version alone, and `POST /api/dashboard` refuses a request that mixes rubric versions.

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

Two things a fresh checkout trips on: `pnpm build` fetches this application's Google
Fonts at build time (`src/app/layout.tsx`'s `next/font/google` calls), so it needs
network access the first time it runs; and `pnpm dlx shadcn@latest add <name>` cannot be
run from this repository's root under its supply-chain policy — see the `designing-ui`
skill (`.agents/skills/designing-ui/SKILL.md`) for the workaround.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete workflow, and
[AGENTS.md](AGENTS.md) for the architecture, the command index, and the rules every
change is held to.

## License

[MIT](LICENSE) © tomada
