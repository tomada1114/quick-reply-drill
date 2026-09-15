# my-package

[![CI](https://github.com/tomada1114/nextjs-app-template/actions/workflows/ci.yml/badge.svg)](https://github.com/tomada1114/nextjs-app-template/actions/workflows/ci.yml)

A short description.

## What this is

A Next.js application on the App Router: a page tree, one JSON endpoint, and one
language-model call kept behind an interface rather than called directly. ESM-only
TypeScript throughout.

Two things follow from that last part. A fake adapter is wired in by default, so
`pnpm dev` answers a request before any credential exists — the first thing you do with
a checkout is run it, not go and find an API key. And the model layer can be deleted in
one piece instead of unpicked, which a test keeps true rather than a convention.

It grew out of a template. The template's locale-prefixed page tree and its `next-intl`
catalogs are gone — this application renders one language, English — and so is its
Anthropic adapter, leaving the fake as the only one wired today.

`AGENTS.md` describes the architecture and the rules; this file is the tour.

## Quick start

```sh
pnpm install
pnpm dev
```

Then open <http://localhost:3000>. The page it renders is `src/app/page.tsx`.

There is one API route, `POST /api/ask`, which takes `{ "prompt": "..." }` and answers
`{ "answer": "..." }`. It asks the model to write in English, which is the one language
this application deals in. The route runs against a fake language-model adapter, so it
needs no credentials; `src/server/composition.ts` is the single place that decides which
adapter is behind it. Copy `.env.example` to `.env` when you swap in one that needs a
key.

Swapping one in also closes the endpoint. `src/server/composition.ts` declares that the
adapter it wires bills a provider, and `readServerEnv` then requires `API_ACCESS_KEY` —
a deployment that pays for its answers refuses to start rather than serving anyone who
finds the URL — after which the route answers `401` unless the request carries that key
as `Authorization: Bearer <value>`. Exporting a provider credential does not on its own
close anything: while the fake adapter answers, nothing is billed and nothing is
required. That is authentication and nothing more: this template ships no rate limit.

What the route does bound is the size of a request. The `prompt` is trimmed and must be
1 to 8000 characters, and the body is refused with `413` once it crosses 64 KiB while it
is being read — before the model is asked, on either path. Both ceilings are constants:
`MAX_PROMPT_LENGTH` in `src/server/handlers/ask.ts` and `MAX_REQUEST_BODY_BYTES` in
`src/server/http.ts`.

## Starting a new app from this template

Copy the tree, then work through
[`starting-an-app`](.agents/skills/starting-an-app/SKILL.md), which owns the procedure
and the order it runs in: rename first, then decide whether to keep the language-model
layer or remove it whole, then decide the locales, then run `pnpm check:source` once.

The rename is what the title, the description and the author above are waiting for —
they are this template's own identity strings, deliberately left as placeholders.
`tests/placeholders.test.ts` holds the complete list of where one still stands, and a
new app is finished renaming when that list is empty and the test is green.

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

[MIT](LICENSE) © Your Name
