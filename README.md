# my-package

[![CI](https://github.com/tomada1114/nextjs-app-template/actions/workflows/ci.yml/badge.svg)](https://github.com/tomada1114/nextjs-app-template/actions/workflows/ci.yml)

A short description.

## What this is

A Next.js application on the App Router: a page tree, one JSON endpoint, and one
language-model call kept behind an interface rather than called directly. ESM-only
TypeScript throughout.

Two things follow from that last part. A fake adapter is wired in by default, so
`pnpm dev` answers a request before any credential exists — the first thing you do with
a checkout is run it, not go and find an API key. The provider-specific implementation
stays behind the same port, so callers do not depend on an SDK.

It grew out of a template. The template's locale-prefixed page tree and its `next-intl`
catalogs are gone — this application renders one language, English — and so is its
Anthropic adapter, leaving the fake as the only one wired today.

`AGENTS.md` describes the architecture and the rules; this file is the tour.

## Quick start

```sh
pnpm install
pnpm dev
```

Then open <http://127.0.0.1:3000>. The page it renders is `src/app/page.tsx`.

There is one API route, `POST /api/ask`, which takes `{ "prompt": "..." }` and answers
`{ "answer": "..." }`. It asks the model to write in English, which is the one language
this application deals in. The route runs against a fake language-model adapter, so it
needs no credentials; `src/server/composition.ts` is the single place that decides which
adapter is behind it. Copy `.env.example` to `.env` when you swap in one that needs a
key.

The endpoint accepts only browser requests whose `Sec-Fetch-Site` is `same-origin`; a
missing or cross-site header gets `403 ERR_FORBIDDEN_ORIGIN` before the body is read.
The `dev` and `start` commands bind to `127.0.0.1`, so another machine cannot reach the
local server. The header is a CSRF-grade guard rather than authentication; when this is
deployed, put access control in front of the app or use a one-time passphrase cookie.

What the route does bound is the size of a request. The `prompt` is trimmed and must be
1 to 8000 characters, and the body is refused with `413` once it crosses 64 KiB while it
is being read — before the model is asked, on either path. Both ceilings are constants:
`MAX_PROMPT_LENGTH` in `src/server/handlers/ask.ts` and `MAX_REQUEST_BODY_BYTES` in
`src/server/http.ts`.

## Starting a new app from this template

Copy the tree, then work through
[`starting-an-app`](.agents/skills/starting-an-app/SKILL.md), which owns the procedure
and the order it runs in: rename first, then adapt the language-model seam, then decide
the locales, then run `pnpm check:source` once.

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
