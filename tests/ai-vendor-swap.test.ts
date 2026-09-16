import path from "node:path";

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

/** This file, which necessarily spells out every needle above. */
const THIS_FILE = "tests/ai-vendor-swap.test.ts";

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
// hand; nothing else here needs that treatment.
const scanned = [...walk(repoRoot), ...FIXTURE_FILES].sort();

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

  it("is not looked for in this file, which has to name every needle", () => {
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
    const declared = ["src/app/stale.ts"];
    const actual = filesNamingANeedle([
      { relative: "src/app/stale.ts", text: "nothing vendor-shaped here" },
    ]);
    expect(actual).not.toStrictEqual(declared);
  });
});

// --- import boundaries the bound also implies --------------------------------

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

/**
 * The repo-relative module `specifier` resolves to from `module`, or `undefined` for a
 * package specifier.
 *
 * @remarks
 * Restated from `tests/boundaries.test.ts` rather than imported from it: the two suites
 * check the same bound independently, the way that file's own `LLM_SDKS` list is
 * restated from `eslint.config.mjs` rather than imported, so one of the three losing its
 * copy still leaves the other two checking it.
 */
function resolveWithin(module: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) {
    return path.posix.normalize(path.posix.join("src", specifier.slice("@/".length)));
  }
  if (!specifier.startsWith(".")) {
    return undefined;
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(module), specifier));
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

function adapterBypassOffenders(modules: readonly ScannedModule[]): string[] {
  return modules.flatMap((module) =>
    module.specifiers
      .filter((specifier) =>
        resolveWithin(module.relative, specifier)?.startsWith("src/ai/adapters/"),
      )
      .map((specifier) => `${module.relative}: ${specifier}`),
  );
}

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

const handlerAndAppModules = scanned
  .filter(
    (relative) =>
      relative.startsWith("src/server/handlers/") || relative.startsWith("src/app/"),
  )
  .flatMap((relative) => {
    const module = toModule(relative);
    return module === undefined ? [] : [module];
  });

describe("the port, the errors, the fake adapter, and everything above the AI layer stay vendor-free", () => {
  it("finds real files to check, so the rows below are not vacuous by omission", () => {
    expect(vendorNeutralAiModules.map((module) => module.relative)).toEqual(
      expect.arrayContaining(["src/ai/port.ts", "src/ai/errors.ts"]),
    );
    expect(handlerAndAppModules.length).toBeGreaterThan(0);
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

  it("src/server/handlers/** and src/app/** import nothing from src/ai/adapters/**", () => {
    expect(adapterBypassOffenders(handlerAndAppModules)).toStrictEqual([]);
  });

  it("reports a bypass when there is one, so the row above is not vacuous", () => {
    expect(
      adapterBypassOffenders([
        {
          relative: "src/server/probe.ts",
          specifiers: ["../ai/adapters/openai/index", "../ai/index"],
        },
      ]),
    ).toStrictEqual(["src/server/probe.ts: ../ai/adapters/openai/index"]);
  });
});
