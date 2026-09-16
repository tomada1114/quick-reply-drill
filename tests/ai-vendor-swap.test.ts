import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readText, repoRoot, walk } from "./repo-tree";

// `.agents/skills/integrating-llm/SKILL.md`'s "Swapping the vendor" section states a
// bound: a vendor is named only in the composition root, the adapter directory, the env
// schema and the gate configs, and nowhere else. This suite is what used to check that
// bound, deleted along with the Anthropic adapter because every assertion in it was
// keyed to a vendor no longer named anywhere. #8 named one again (OpenAI), so the bound
// is a gate again rather than prose a reviewer applies by eye.

/**
 * Every string that names a specific vendor rather than the port's own vocabulary.
 *
 * @remarks
 * `reasoningEffort` is deliberately not a needle: since #11, #12 and #15 it is the
 * vendor-neutral field name on `LlmProfile`, on the `/api/score` answer
 * (`src/core/wire.ts`) and on `DrillRecord` (`src/core/records.ts`) — the app's own
 * vocabulary, not a vendor's.
 */
const VENDOR_NEEDLES = [
  "@ai-sdk/openai",
  "createOpenAI",
  "createOpenAiLlmPort",
  "gpt-5.6",
  "OPENAI_API_KEY",
] as const;

/**
 * `tests/fixtures/**` is excluded from {@link walk} by directory name, on purpose, so a
 * suite like this one is not tripped by data that is odd deliberately. `success.json` and
 * `invalid-output.json` carry the model alias as a literal response field
 * (`tests/ai-openai.test.ts` and `tests/openai-stub.ts` read them), so they are named
 * here by hand instead of reaching them through the walk.
 */
const FIXTURE_FILES = [
  "tests/fixtures/openai/invalid-output.json",
  "tests/fixtures/openai/success.json",
] as const;

/**
 * Non-prose files a vendor needle may legitimately appear in.
 *
 * @remarks
 * Re-derived with `grep -rlF` for each needle in {@link VENDOR_NEEDLES} over the whole
 * checkout rather than copied from the issue that asked for this file: #8 through #15
 * moved the vendor's footprint since it was written, and the assertion below is exact,
 * so a stale entry fails exactly as loudly as an unlisted one. `eslint.config.mjs` and
 * `vitest.config.ts` carry no needle today — their SDK allowlist is `ai`/`@ai-sdk`, not
 * the provider package — and are deliberately absent. `pnpm-lock.yaml` also carries
 * `@ai-sdk/openai`, but {@link walk} treats it as generated rather than hand-written
 * (`tests/repo-tree.ts`'s `SKIPPED_FILES`) the same way it skips `.eslintcache`, so it
 * never reaches `scanned` and is absent here too rather than special-cased back in.
 */
const VENDOR_CODE_FILES = [
  ".env.example",
  "package.json",
  "src/ai/adapters/openai/client.ts",
  "src/ai/adapters/openai/index.ts",
  "src/ai/index.ts",
  "src/server/composition.ts",
  "src/server/env.ts",
  "src/server/llm-profiles.ts",
  "tests/ai-openai.test.ts",
  "tests/ai-port.test.ts",
  "tests/ai-vendor-swap.test.ts",
  "tests/boundaries.test.ts",
  ...FIXTURE_FILES,
  "tests/llm-profiles.test.ts",
  "tests/openai-stub.ts",
  "tests/server-env.test.ts",
  "tests/server-smoke.test.ts",
] as const;

/**
 * Prose that may name the vendor.
 *
 * @remarks
 * `AGENTS.md` and `.agents/skills/integrating-llm/**` (+ its `.claude/` mirror) name
 * OpenAI in words today but carry none of {@link VENDOR_NEEDLES}, so they are not listed
 * here — an exact match means a listed file that stopped carrying a needle fails too,
 * the same as one that started carrying one without being listed.
 */
const VENDOR_DOCUMENT_FILES = [
  ".agents/skills/managing-dependencies/SKILL.md",
  ".claude/skills/managing-dependencies/SKILL.md",
  "README.md",
] as const;

/**
 * This file's own repo-relative path, which necessarily spells out every needle above.
 *
 * @remarks
 * Derived from `import.meta.url` rather than typed as a literal, so it cannot drift out
 * of step with the identical literal `tests/ai-vendor-swap.test.ts` in
 * {@link VENDOR_CODE_FILES}.
 */
const THIS_FILE = path.relative(repoRoot, fileURLToPath(import.meta.url));

function namesANeedle(text: string): boolean {
  return VENDOR_NEEDLES.some((needle) => text.includes(needle));
}

interface ScannedFile {
  readonly relative: string;
  readonly text: string;
}

/** The sorted, de-duplicated set of files among `files` that name a needle. */
function filesNamingANeedle(files: readonly ScannedFile[]): string[] {
  return [
    ...new Set(
      files.filter((file) => namesANeedle(file.text)).map((file) => file.relative),
    ),
  ].sort();
}

// `walk` skips whole directories named `fixtures`, so the two fixture files are added by
// hand; nothing else here needs that treatment. The existence check is what keeps a
// renamed or deleted `FIXTURE_FILES` entry out of `scanned` rather than crashing
// `scannedFiles` below with an ENOENT at module scope: dropped from `scanned`, it instead
// fails loudly and specifically, through the "is scanned" case for that exact file.
const scanned = [
  ...walk(repoRoot),
  ...FIXTURE_FILES.filter((relative) => existsSync(path.join(repoRoot, relative))),
].sort();

const scannedFiles: ScannedFile[] = scanned.flatMap((relative) => {
  const text = readText(relative);
  return text === undefined ? [] : [{ relative, text }];
});

const expectedVendorFiles = [...VENDOR_CODE_FILES, ...VENDOR_DOCUMENT_FILES].sort();

describe("the vendor is named only where integrating-llm's 'Swapping the vendor' bound allows", () => {
  // An inventory test is only as good as the tree it walked, so each declared file is
  // pinned first: a rename or deletion that dropped one out of `scanned` would otherwise
  // read as "no longer names a needle" instead of "moved", which is the wrong diagnosis.
  it.each(expectedVendorFiles)(
    "is scanned, so a stale entry fails loudly (%s)",
    (relative) => {
      expect(scanned).toContain(relative);
    },
  );

  it("lists itself among the files allowed to name every needle", () => {
    expect(expectedVendorFiles).toContain(THIS_FILE);
  });

  it("names the vendor in exactly the files the bound allows, and nowhere else", () => {
    expect(filesNamingANeedle(scannedFiles)).toStrictEqual(expectedVendorFiles);
  });

  it("reports a file naming a needle when there is one, so the check above is not vacuous", () => {
    expect(
      filesNamingANeedle([
        {
          relative: "src/app/probe.ts",
          text: 'import { createOpenAI } from "@ai-sdk/openai";',
        },
        { relative: "src/app/clean.ts", text: "export const clean = true;" },
      ]),
    ).toStrictEqual(["src/app/probe.ts"]);
  });

  it("flags a listed file that stopped naming a needle, not only an unlisted one that started", () => {
    // `actual` (what still names a needle) no longer includes the stale file, while
    // `declared` (what the bound still expects) does. Asserting that comparing the two
    // with `toStrictEqual` — the same comparison the exactness check above makes — throws
    // is what proves that direction actually fails; `not.toStrictEqual` on its own would
    // hold for any two different arrays and assert nothing about exactness at all.
    const declared = ["src/app/stale.ts"];
    const actual = filesNamingANeedle([
      { relative: "src/app/stale.ts", text: "nothing vendor-shaped here" },
    ]);
    expect(() => expect(actual).toStrictEqual(declared)).toThrow();
  });
});

// --- import boundaries the bound also implies --------------------------------
//
// The adapter-bypass check this section used to run (`src/server/handlers/**` and
// `src/app/**` import nothing from `src/ai/adapters/**`) duplicated
// `tests/boundaries.test.ts`'s "names no module but its surface" case at strictly
// narrower scope — same specifier-resolution logic, a subset of the files. It was
// removed rather than kept in step with a second copy; that existing suite is what
// enforces it. The fake-adapter SDK check below is not a duplicate — nothing else in the
// suite asserts that the fake adapter itself never reaches the real SDK — so it stays.

/** Every module specifier `source` imports, re-exports, or `import()`s. */
function importSpecifiers(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const pattern =
    /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"'\n]+)["']/g;
  return [...withoutComments.matchAll(pattern)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/** Whether `specifier` reaches the Vercel AI SDK core or an `@ai-sdk/*` provider package. */
function isLlmSdkSpecifier(specifier: string): boolean {
  return (
    specifier === "ai" ||
    specifier.startsWith("ai/") ||
    specifier.startsWith("@ai-sdk/")
  );
}

interface ScannedModule {
  readonly relative: string;
  readonly specifiers: readonly string[];
}

function toModule(relative: string): ScannedModule | undefined {
  const text = readText(relative);
  return text === undefined
    ? undefined
    : { relative, specifiers: importSpecifiers(text) };
}

function sdkOffenders(modules: readonly ScannedModule[]): string[] {
  return modules.flatMap((module) =>
    module.specifiers
      .filter(isLlmSdkSpecifier)
      .map((specifier) => `${module.relative}: ${specifier}`),
  );
}

// Pins `importSpecifiers` directly, the same way `tests/boundaries.test.ts` pins its own
// copy with `SCANNER_CONTROL`: stubbing this function to always return `[]` would
// otherwise leave every SDK-import check below green while enforcing nothing.
const IMPORT_SCANNER_CONTROL = `
import { createOpenAI } from "@ai-sdk/openai";
import { named } from "./errors";
export { re } from "../../port";
const lazy = await import("ai");
// import { commented } from "@ai-sdk/anthropic";
/* import { blocked } from "@ai-sdk/blocked"; */
const message = "not from \\"@ai-sdk/fake-string\\"";
`;

describe("the import scanner the SDK checks below run on", () => {
  it("finds every spelling of an import and nothing that only looks like one", () => {
    expect(importSpecifiers(IMPORT_SCANNER_CONTROL)).toStrictEqual([
      "@ai-sdk/openai",
      "./errors",
      "../../port",
      "ai",
    ]);
  });
});

const vendorNeutralAiModules = scanned
  .filter(
    (relative) =>
      relative === "src/ai/port.ts" ||
      relative === "src/ai/errors.ts" ||
      relative.startsWith("src/ai/adapters/fake/"),
  )
  .flatMap((relative) => {
    const module = toModule(relative);
    return module === undefined ? [] : [module];
  });

describe("the port, the errors, and the fake adapter stay vendor-free", () => {
  it("finds real files to check, so the row below is not vacuous by omission", () => {
    const relatives = vendorNeutralAiModules.map((module) => module.relative);
    expect(relatives).toEqual(
      expect.arrayContaining(["src/ai/port.ts", "src/ai/errors.ts"]),
    );
    // `arrayContaining` above only pins the two single files; a renamed
    // `src/ai/adapters/fake/` would drop out of `vendorNeutralAiModules` without either
    // of them noticing, and the SDK check below would then pass over an empty set.
    expect(
      relatives.some((relative) => relative.startsWith("src/ai/adapters/fake/")),
    ).toBe(true);
  });

  it("src/ai/port.ts, src/ai/errors.ts and the fake adapter import no LLM SDK", () => {
    expect(sdkOffenders(vendorNeutralAiModules)).toStrictEqual([]);
  });

  it("reports an SDK import when there is one, so the row above is not vacuous", () => {
    expect(
      sdkOffenders([
        {
          relative: "src/ai/adapters/fake/index.ts",
          specifiers: ["@ai-sdk/openai", "../../port"],
        },
      ]),
    ).toStrictEqual(["src/ai/adapters/fake/index.ts: @ai-sdk/openai"]);
  });
});
