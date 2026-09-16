---
name: starting-an-app
description: >
  Covers turning this template into a new application: the copy-and-rename procedure
  driven by tests/placeholders.test.ts, what a new project keeps untouched, and how its
  AI seam is documented. Use when starting an app from this repository, replacing the
  package name, the app's display name or the repository slug in a badge or advisory
  link.
---

# Starting an App

**Owns:** turning this repository into a new application — the rename and what the new
app keeps. **Does not own:** how a skill is authored or mirrored (`authoring-skills`);
the README's own prose (`updating-docs`); what a gate file may contain
(`changing-gates`); working inside the App Router tree (`building-app-routes`); the
port, its adapters, and swapping one provider for another (`integrating-llm`).

There is deliberately no bootstrap script. The one this repository used to ship was
profile-driven machinery that rewrote the tree and then deleted itself, so the only
record of what it did was a file that no longer existed. What replaced it is this
procedure plus two tests holding the lists a script would have hard-coded. Do not
reintroduce a script, a profile, or a self-deleting block.

## The order

Rename first, so nothing downstream is written against the template's identity. Keep the
AI layer's `LlmPort` seam and adapter boundary intact while writing code of your own.
Then run `pnpm check:source` once. Each step below names the narrower check to run while
you are inside it.

## The rename

`tests/placeholders.test.ts` owns the inventory: `PLACEHOLDERS` is every string that
names _this template_ rather than a project built from it, and `EXPECTED_INVENTORY` is
the complete list of `<file>: <placeholder>` sites where one still stands. That list is
the checklist, and it is machine-checked, so this skill does not restate its rows —
holding them in two places is how one of them goes stale.

Work through it:

```bash
pnpm exec vitest run tests/placeholders.test.ts
```

The inventory is pinned with an exact comparison, so a failure prints the sites that
remain against the sites the list expects. Replace one site, delete its row from
`EXPECTED_INVENTORY`, run again. You are finished when the list is empty and the suite
is green: an empty inventory means no identity string of this template survived anywhere
in the tree, not merely in the files someone remembered to open.

The suite's second block, over the CI badge and the security-advisory link, checks those
two URLs by their _shape_ — the path segments and the workflow filename — and leaves the
owner and the repository unconstrained. It passes on your slug exactly as it did on the
template's, so it needs no edit during the rename; what pins the slug itself is the
inventory row for each of those files.

What goes into each site:

- **The package identity** — `package.json`'s `name` and `description`. `private: true`
  stays: nothing here is published, so the name only has to be one you recognise, not
  one that is free on the registry.
- **The repository slug**, wherever a URL names a GitHub repository — the README's CI
  badge and the security-advisory contact link in `.github/ISSUE_TEMPLATE/`. A slug left
  behind renders a broken badge and sends a vulnerability reporter to a stranger's
  advisory form.
- **The copyright holder** in `LICENSE`, and the same name wherever the README repeats
  it. Every fork inherits `LICENSE` verbatim, which is why the template ships a blank.

Those three are the whole inventory now. The app's display name and its one-line
description are not in it: `src/app/layout.tsx`'s `metadata` and the heading in
`src/app/page.tsx` already name this application rather than the template, one
hard-coded string apiece with no catalog and no per-locale half behind either. Pinning
them would pin strings that may not survive your first day of writing the real page —
review the home page's copy by hand once it is yours, the same way you review anything
else this suite leaves unpinned. `tests/home-page.test.tsx` asserts the heading and the
description as literals, so rewriting either turns that test red; update the assertion
in the same edit.

Emptying `EXPECTED_INVENTORY` is the intended edit and is not weakening a gate. Widening
`SKIPPED_DIRECTORIES` or `SKIPPED_FILES`, or dropping an entry from `PLACEHOLDERS`, to
make a row disappear is — the row would stop being reported without the string being
gone. AGENTS.md's "never weaken a gate to make a run pass" covers that.

## What the new app keeps

Everything below is about the repository rather than the application, so it survives the
rename unchanged and is most of what starting from this template buys:

- **The gate set** — `package.json`'s `check:quick` / `check:source` and the scripts
  they call, `lefthook.yml`, and `.github/workflows/`. A red run early in a new project
  is an argument for fixing the code, never for deleting the check that found it.
- **The guard engine** — `scripts/lib/guard/` and `scripts/check-staged.mjs`, the one
  mechanical layer this repository ships and the only thing standing between a secret
  and the commit history. It is language-agnostic; keep it whatever the app becomes.
- **The skills** under `.agents/skills/` and their generated mirror. Drop one only when
  the subject it owns actually leaves the repository. **REQUIRED:** `authoring-skills`
  for the loop that keeps the two trees identical, and for the AGENTS.md Skills table
  row that `tests/skills-frontmatter.test.ts` requires in both directions.
- **The label workflow** — `.github/labels.yml`, `scripts/sync-labels.mjs` behind
  `pnpm repo:labels`, and `.github/workflows/pr-label.yml`. Run `pnpm repo:labels`
  against the new repository early: the workflow only ever _applies_ a label, and when
  one does not exist yet it emits a notice instead of failing, so a missing taxonomy is
  silent. **BACKGROUND:** `triaging-issues` for what the labels mean.
- **`.env.example`**, even when the app reads nothing yet. `src/server/env.ts` is the
  only module that touches `process.env`, and `tests/server-env.test.ts` asserts the two
  stay in step; the example file is half of that check.
