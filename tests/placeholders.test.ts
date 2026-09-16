import { describe, expect, it } from "vitest";

import { readText, repoRoot, walk } from "./repo-tree";

// This suite guards against the former template's identity strings — a
// package name, a repository slug, an author, a one-line description —
// leaking back into this repository. It pins the complete inventory of where
// each PLACEHOLDERS entry appears rather than merely forbidding them: a file
// that picks one up fails, and so does an inventory entry that has gone
// stale. `scripts/bootstrap.mjs` used to hold both the rewrite and this
// check; issue #26 removed the rewrite (it was profile-driven machinery that
// self-deleted), leaving this test as the only thing that still notices a
// placeholder appearing where it has no business being.

/**
 * Every string that names *this template* rather than a project built from it.
 *
 * @remarks
 * `you@example.com` and `your-name` are listed although nothing carries them
 * today: they are identity strings the template has used, and a field
 * reintroducing either should fail here rather than ship. A token that
 * matches nothing simply contributes no rows to the inventory below.
 *
 * `tomada1114/nextjs-app-template` is not a blank like the others — it is the
 * former template's real repository slug, kept here so a leaked identity
 * string is caught if it ever reappears in this repository. Only the full
 * slug is listed: a bare `tomada1114` would match
 * `tests/sync-labels.test.ts`'s `tomada1114/typescript-template` fixture
 * data, and a bare `nextjs-app-template` would produce a duplicate row per
 * file that carries the full slug.
 *
 * The reader-facing strings the template used to carry — its display name and
 * one-line description, each written once per message catalog — are gone from
 * this list along with `messages/` itself. What the visitor now reads is
 * written directly in `src/app/layout.tsx` and `src/app/page.tsx`, and it names
 * this application rather than the template, so there is no placeholder left to
 * look for there.
 */
const PLACEHOLDERS = [
  "my-package",
  "your-name",
  "Your Name",
  "you@example.com",
  "A short description.",
  "tomada1114/nextjs-app-template",
] as const;

/**
 * The complete inventory of where a placeholder still stands, as
 * `<file>: <placeholder>` rows.
 *
 * @remarks
 * Empty because the rename is complete: nothing in the tree still carries the
 * template's identity. Any row this array gained back would be a regression —
 * PLACEHOLDERS above is what would catch it.
 */
const EXPECTED_INVENTORY: readonly string[] = [];

/**
 * This file, which necessarily spells out every placeholder it looks for.
 *
 * @remarks
 * Excluded by path rather than by some marker in the text, so the exclusion
 * cannot be copied into another file by accident.
 */
const THIS_FILE = "tests/placeholders.test.ts";

const scanned = walk(repoRoot).filter((relative) => relative !== THIS_FILE);

const inventory = scanned
  .flatMap((relative) => {
    const text = readText(relative);
    return text === undefined
      ? []
      : PLACEHOLDERS.filter((placeholder) => text.includes(placeholder)).map(
          (placeholder) => `${relative}: ${placeholder}`,
        );
  })
  .sort();

describe("the template's own identity strings", () => {
  // An inventory test is only as good as the tree it walked, so the walk is
  // pinned first: a skip list that grew too broad would otherwise turn this
  // file into a test that scans almost nothing and passes.
  it.each([
    "README.md",
    "package.json",
    "CONTRIBUTING.md",
    "AGENTS.md",
    "src/app/page.tsx",
    "src/core/result.ts",
    "scripts/check-staged.mjs",
    ".github/workflows/ci.yml",
    ".agents/skills/changing-gates/SKILL.md",
    ".claude/skills/changing-gates/SKILL.md",
  ])("are looked for in %s", (relative) => {
    expect(scanned).toContain(relative);
  });

  it("are not looked for in this file, which has to name every one of them", () => {
    expect(scanned).not.toContain(THIS_FILE);
  });

  it("survive only in the files that carry the template's identity", () => {
    expect(inventory).toStrictEqual(EXPECTED_INVENTORY);
  });
});

describe("the badge and advisory URLs", () => {
  // The inventory above only proves the slug appears *somewhere* in each file;
  // it would pass on a badge URL missing its workflow filename. This pins both
  // URLs by their shape *and* by this repository's own slug — the rename is
  // complete, so nothing here is meant to resolve against any other
  // owner/repository.
  it.each([
    [
      "README.md",
      /https:\/\/github\.com\/tomada1114\/quick-reply-drill\/actions\/workflows\/ci\.yml/,
    ],
    [
      ".github/ISSUE_TEMPLATE/config.yml",
      /https:\/\/github\.com\/tomada1114\/quick-reply-drill\/security\/advisories\/new/,
    ],
  ])("%s carries a well-formed repository URL", (relative, pattern) => {
    expect(readText(relative)).toMatch(pattern);
  });
});
