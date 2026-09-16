import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// `eslint.config.mjs` states the zone edges as `no-restricted-imports`
// patterns; this file asserts the same edges from the module graph itself, so
// a rule deleted from that config still fails the suite. The two are checked
// independently on purpose — a boundary that only one layer holds is a
// boundary one edit removes.
//
// The scanner below is deliberately not a TypeScript parser, for the same
// reason `tests/workflows.test.ts` does not parse YAML: a parser would be a new
// dependency for a repository whose point is a small, reviewable dependency
// surface, and what is asserted here is the specifier *as written*, which is
// exactly what survives comment-stripping and nothing more.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// --- scanning ----------------------------------------------------------------

/**
 * Remove every comment, so a path named in TSDoc prose is not read as an
 * import.
 *
 * @remarks
 * Block comments go first: a `//` inside one would otherwise be treated as the
 * start of a line comment and swallow the rest of that line only, leaving the
 * comment's closing delimiter behind. Nothing under `src/` contains a `//`
 * inside a string literal today, and {@link SCANNER_CONTROL} pins the scanner's
 * output against a hand-written expectation so a source that did would show up
 * as a failure here rather than as a boundary silently going unchecked.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Every module specifier `source` imports, re-exports, or `import()`s.
 *
 * @remarks
 * The four spellings this repository can produce are covered in one pattern:
 * `from "x"` (a static import or a re-export), a side-effect `import "x"`, a
 * dynamic `import("x")`, and `require("x")`.
 */
function importSpecifiers(source: string): string[] {
  const pattern =
    /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"'\n]+)["']/g;
  return [...withoutComments(source).matchAll(pattern)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/** Every `.ts`/`.tsx` file under `directory`, as repo-relative POSIX paths. */
function modulesUnder(directory: string): string[] {
  const absolute = path.join(repoRoot, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return modulesUnder(relative);
    }
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

/**
 * The repo-relative module a specifier names, or `undefined` for a package.
 *
 * @remarks
 * Two spellings reach a module of this repository's own. A relative one is
 * resolved against the importer's directory. An `@/…` one goes through the
 * alias `tsconfig.json` maps to `./src/*`, so it is resolved against `src/`
 * whatever the importer's depth — without this branch every zone assertion
 * below would silently stop seeing an aliased import, which is the shape
 * shadcn/ui writes and the reason the alias exists at all.
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

/** Whether `specifier` reaches `pkg` — the package itself or any subpath. */
function importsPackage(specifier: string, pkg: string): boolean {
  return specifier === pkg || specifier.startsWith(`${pkg}/`);
}

/** Whether `specifier` reaches a module inside the AI layer's adapter tree. */
function importsAdapter(module: string, specifier: string): boolean {
  return resolveWithin(module, specifier)?.startsWith("src/ai/adapters/") === true;
}

interface Module {
  /** Repo-relative POSIX path, e.g. `src/server/handlers/score.ts`. */
  readonly file: string;
  readonly specifiers: readonly string[];
}

const sourceModules: readonly Module[] = modulesUnder("src")
  .sort()
  .map((file) => ({
    file,
    specifiers: importSpecifiers(readFileSync(path.join(repoRoot, file), "utf8")),
  }));

function modulesIn(...zones: readonly string[]): Module[] {
  return sourceModules.filter((module) =>
    zones.some((zone) => module.file.startsWith(`${zone}/`)),
  );
}

// --- the scanner itself ------------------------------------------------------

// A boundary test whose scanner quietly finds nothing passes forever while
// enforcing nothing, so the scanner is pinned before the zones are asserted
// with it. Every case that could silence it is here: a specifier inside a
// block comment, one inside a line comment, and one inside an ordinary string.
const SCANNER_CONTROL = `
import defaultExport from "next";
import { named } from "../core/result";
import "./globals.css";
import type { OnlyAType } from "@ai-sdk/openai";
import { aliased } from "@/core/result";
export { re } from "./errors";
const lazy = await import("../ai/index");
const legacy = require("node:fs");
const message = "imported from ../ai/adapters/fake/index by hand";
// import { commented } from "./line-comment-only";
/* import { blocked } from "./block-comment-only"; */
`;

/**
 * Modules the walk has to come back with, chosen for the shapes they cover.
 *
 * @remarks
 * A named subset rather than the whole tree: enumerating every module made the
 * suite fail on each legal new file, which teaches its reader to edit the
 * expectation. Each entry earns its place — three directories deep (the
 * recursion), a `.tsx` rather than a `.ts` (the extension filter), a zone
 * holding exactly one module, and a nested module in the zone the surface
 * rules are about. What the
 * exhaustive list was really standing in for — a scan that quietly found
 * nothing — is asserted directly by this and by the zone-coverage case below.
 */
const SCAN_ANCHORS = [
  "src/ai/adapters/fake/index.ts",
  "src/app/page.tsx",
  "src/core/result.ts",
  "src/server/handlers/score.ts",
];

describe("the import scanner the zone assertions run on", () => {
  it("finds every spelling of an import and nothing that only looks like one", () => {
    expect(importSpecifiers(SCANNER_CONTROL)).toStrictEqual([
      "next",
      "../core/result",
      "./globals.css",
      "@ai-sdk/openai",
      "@/core/result",
      "./errors",
      "../ai/index",
      "node:fs",
    ]);
  });

  it.each([
    [
      "src/ai/adapters/fake/index.ts",
      ["zod", "../../../core/result", "../../errors", "../../port"],
    ],
    [
      "src/server/handlers/score.ts",
      [
        "../../ai/index",
        "../../core/wire",
        "../http",
        "../llm-profiles",
        "../prompts/scoring",
        "../request-body",
      ],
    ],
    ["src/app/api/score/route.ts", ["../../../server/composition"]],
    ["src/app/api/questions/route.ts", ["../../../server/composition"]],
  ])("reads %s as %p", (file, expected) => {
    const module = sourceModules.find((candidate) => candidate.file === file);
    expect(module?.specifiers).toStrictEqual(expected);
  });

  it("reaches every anchor, so the walk is not stuck in a subdirectory of src/", () => {
    expect(sourceModules.map((module) => module.file)).toEqual(
      expect.arrayContaining(SCAN_ANCHORS),
    );
  });

  // `arrayContaining` above only proves presence: it would still pass if
  // `modulesUnder`'s `/\.tsx?$/` filter were dropped and every `.css` or
  // binary file under `src/` joined `sourceModules` too. This is the
  // assertion the old exhaustive `toStrictEqual` list stood in for — that the
  // filter actually excludes something — asserted directly instead of by
  // enumerating every file the walk must return.
  it("returns nothing but .ts and .tsx files", () => {
    expect(sourceModules.every((module) => /\.tsx?$/.test(module.file))).toBe(true);
  });

  it("resolves a relative specifier to the module it names", () => {
    expect(resolveWithin("src/server/handlers/score.ts", "../../ai/index")).toBe(
      "src/ai/index",
    );
    expect(resolveWithin("src/ai/port.ts", "./adapters/fake/index")).toBe(
      "src/ai/adapters/fake/index",
    );
    expect(resolveWithin("src/core/result.ts", "next")).toBeUndefined();
  });

  it("resolves an @/ specifier against src/, from any depth, and no package name", () => {
    expect(
      resolveWithin("src/components/ui/button.tsx", "@/components/lib/utils"),
    ).toBe("src/components/lib/utils");
    expect(resolveWithin("src/app/page.tsx", "@/ai/index")).toBe("src/ai/index");
    // The whole point of the `@/` branch: the same specifier resolves to the
    // same module whatever file names it, which is what a `../`-relative
    // specifier cannot do and what makes an aliased import worth a boundary.
    expect(resolveWithin("src/core/result.ts", "@/ai/index")).toBe("src/ai/index");
    // A scoped package is `@scope/name`; `/` is not a legal scope, so nothing
    // a registry publishes can be mistaken for an aliased path.
    expect(resolveWithin("src/core/result.ts", "@ai-sdk/openai")).toBeUndefined();
  });
});

// --- the zone edges ----------------------------------------------------------

/**
 * Every zone under `src/`, and the zones a module in it may not import.
 *
 * @remarks
 * AGENTS.md's `app → server → ai → core`, with `app → components → core`
 * beside it, written as a table. A zone added to
 * `src/` has to be
 * given a row here before this suite passes, which is the review the table
 * exists to force. `eslint.config.mjs` states the same edges as
 * `no-restricted-imports` groups; the two layers are checked independently, so
 * a rule deleted there still fails here.
 *
 * `src/components` is listed in three other rows as well as carrying its own:
 * a boundary only one side enforces is one a single edit removes, so the zones
 * below it name it and it names them.
 */
const FORBIDDEN_ZONE_IMPORTS: Readonly<Record<string, readonly string[]>> = {
  "src/ai": ["src/app", "src/components", "src/server"],
  "src/app": [],
  "src/components": ["src/ai", "src/app", "src/server"],
  "src/core": ["src/ai", "src/app", "src/components", "src/server"],
  "src/server": ["src/app", "src/components"],
};

/** The AI layer's whole surface, as a repo-relative module. */
const AI_SURFACE = "src/ai/index";

/**
 * The only two spellings of that surface a caller outside the layer may use.
 *
 * @remarks
 * Derived from {@link AI_SURFACE} rather than typed again: the bare directory
 * import resolves to the same module, and `eslint.config.mjs`'s
 * `AI_LAYER_PRIVATE` leaves both alone, so the two layers have to agree on
 * exactly this pair.
 */
const AI_SURFACE_MODULES = [path.posix.dirname(AI_SURFACE), AI_SURFACE];

/** Whether `resolved` is `zone` itself or a module inside it. */
function inZone(resolved: string, zone: string): boolean {
  return resolved === zone || resolved.startsWith(`${zone}/`);
}

/**
 * `"<file>: <specifier>"` for every import crossing an edge the table forbids.
 *
 * @remarks
 * The module list is a parameter rather than {@link sourceModules} closed over,
 * so the checker can be driven with a synthetic module and proved to report as
 * well as to stay silent.
 */
function crossZoneOffenders(modules: readonly Module[]): string[] {
  return modules.flatMap((module) => {
    const zone = Object.keys(FORBIDDEN_ZONE_IMPORTS).find((candidate) =>
      inZone(module.file, candidate),
    );
    const forbidden = zone === undefined ? [] : (FORBIDDEN_ZONE_IMPORTS[zone] ?? []);
    return module.specifiers
      .filter((specifier) => {
        const resolved = resolveWithin(module.file, specifier);
        return (
          resolved !== undefined && forbidden.some((other) => inZone(resolved, other))
        );
      })
      .map((specifier) => `${module.file}: ${specifier}`);
  });
}

/** The same, for an AI-layer import that is not one of its surface spellings. */
function aiLayerBypasses(modules: readonly Module[]): string[] {
  return modules.flatMap((module) =>
    module.specifiers
      .filter((specifier) => {
        const resolved = resolveWithin(module.file, specifier);
        return (
          resolved !== undefined &&
          inZone(resolved, path.posix.dirname(AI_SURFACE)) &&
          !AI_SURFACE_MODULES.includes(resolved)
        );
      })
      .map((specifier) => `${module.file}: ${specifier}`),
  );
}

/** `"<file>: <specifier>"` for every import of `modules` reaching `pkg`. */
function packageOffenders(modules: readonly Module[], pkg: string): string[] {
  return modules.flatMap((module) =>
    module.specifiers
      .filter((specifier) => importsPackage(specifier, pkg))
      .map((specifier) => `${module.file}: ${specifier}`),
  );
}

describe("src/ imports run one way, app → server → ai → core and app → components → core", () => {
  it("reaches every zone the table names", () => {
    const unscanned = Object.keys(FORBIDDEN_ZONE_IMPORTS).filter(
      (zone) => !sourceModules.some((module) => inZone(module.file, zone)),
    );
    expect(unscanned).toStrictEqual([]);
  });

  it("gives every zone under src/ a row, so a new one needs a decision", () => {
    const zones = readdirSync(path.join(repoRoot, "src"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `src/${entry.name}`)
      .sort();
    expect(zones).toStrictEqual(Object.keys(FORBIDDEN_ZONE_IMPORTS).sort());
  });

  it("keeps no module at the root of src/, so every one belongs to a zone", () => {
    // `src/proxy.ts` was the one exception, and it left with next-intl. A
    // module reappearing here is one the zone table above cannot judge.
    const atRoot = sourceModules
      .map((module) => module.file)
      .filter((file) => file.split("/").length === 2);
    expect(atRoot).toStrictEqual([]);
  });

  it.each(Object.entries(FORBIDDEN_ZONE_IMPORTS))(
    "leaves %s importing none of %p",
    (zone) => {
      expect(crossZoneOffenders(modulesIn(zone))).toStrictEqual([]);
    },
  );

  it("reports a crossing when there is one, so the rows above are not vacuous", () => {
    const offenders = crossZoneOffenders([
      {
        file: "src/core/probe.ts",
        specifiers: ["../server/env", "./result", "next"],
      },
    ]);
    expect(offenders).toStrictEqual(["src/core/probe.ts: ../server/env"]);
  });

  // The same control for the spelling the alias made possible. Without the
  // `@/` branch in `resolveWithin` this crossing resolves to nothing and the
  // row above it passes while enforcing nothing, which is the exact failure
  // the alias would otherwise have introduced into every zone at once.
  it("reports an aliased crossing too, so the @/ spelling is not a way around the table", () => {
    const offenders = crossZoneOffenders([
      {
        file: "src/components/probe.tsx",
        specifiers: [
          "@/server/env",
          "@/core/result",
          "@/components/lib/utils",
          "react",
        ],
      },
    ]);
    expect(offenders).toStrictEqual(["src/components/probe.tsx: @/server/env"]);
  });
});

/**
 * Every language-model SDK, as `eslint.config.mjs` bans them outside adapters.
 *
 * @remarks
 * Restated here rather than imported, because the point of this suite is that
 * the two layers are checked independently — a specifier dropped from the
 * config still fails here. Keep it in step with that file's `LLM_SDK`
 * by hand. `ai`, the Vercel AI SDK's vendor-neutral core, is included because
 * it is still an SDK implementation detail that must stay behind the adapter.
 */
const LLM_SDKS = ["openai", "@ai-sdk", "@anthropic-ai", "ai"];

describe("src/core/ is framework-free and language-model-SDK-free", () => {
  // The zone holds the vocabulary the other three are written in. A framework
  // or SDK import here makes that vocabulary un-reusable and un-testable
  // without the thing it imported.
  const forbidden = ["next", "react", "react-dom", ...LLM_SDKS];

  it.each(forbidden)("imports no %s", (pkg) => {
    expect(packageOffenders(modulesIn("src/core"), pkg)).toStrictEqual([]);
  });
});

describe("src/ai/ outside adapters imports no language-model SDK", () => {
  const nonAdapterModules = modulesIn("src/ai").filter(
    (module) => !module.file.startsWith("src/ai/adapters/"),
  );

  it.each(LLM_SDKS)("imports no %s", (pkg) => {
    expect(packageOffenders(nonAdapterModules, pkg)).toStrictEqual([]);
  });
});

describe("src/app/ and src/server/ reach the AI layer only through src/ai/index.ts", () => {
  it("names no module inside the layer but its surface", () => {
    expect(aiLayerBypasses(modulesIn("src/app", "src/server"))).toStrictEqual([]);
  });

  // The check above passes just as well if nothing under src/app/ or
  // src/server/ imports the AI layer at all — "names no module but its
  // surface" is vacuously true of an empty set. This asserts the real tree
  // actually exercises the surface, without pinning which file does: a
  // minimum count survives a legal refactor that moves the call between
  // src/server/composition.ts and src/server/handlers/score.ts, where an
  // exhaustive file list would not.
  it("has at least one real src/app or src/server module reaching the AI surface", () => {
    const surfaceImporters = modulesIn("src/app", "src/server").filter((module) =>
      module.specifiers.some((specifier) => {
        const resolved = resolveWithin(module.file, specifier);
        return resolved !== undefined && AI_SURFACE_MODULES.includes(resolved);
      }),
    );
    expect(surfaceImporters.length).toBeGreaterThan(0);
  });

  it("reports a bypass when there is one, so the check above is not vacuous", () => {
    // Both legal spellings and both private ones in one module: this is what
    // pins the allow-list, and what keeps it agreeing with `AI_LAYER_PRIVATE`.
    const offenders = aiLayerBypasses([
      {
        file: "src/server/probe.ts",
        specifiers: [
          "../ai/index",
          "../ai",
          "../ai/errors",
          "../ai/adapters/fake/index",
        ],
      },
    ]);
    expect(offenders.sort()).toStrictEqual([
      "src/server/probe.ts: ../ai/adapters/fake/index",
      "src/server/probe.ts: ../ai/errors",
    ]);
  });

  it.each(LLM_SDKS)("imports no %s", (pkg) => {
    expect(packageOffenders(modulesIn("src/app", "src/server"), pkg)).toStrictEqual([]);
  });
});

describe("src/components/ is client UI: no language-model SDK, no server-only", () => {
  const componentModules = modulesIn("src/components");

  // `server-only` throws on import outside a React Server Components graph, so
  // a component carrying it can never be a Client Component — which is the one
  // thing this zone exists to be able to become. Checked alongside the
  // language-model SDKs, since both are the same "reaches `pkg`" shape.
  it.each([...LLM_SDKS, "server-only"])("imports no %s", (pkg) => {
    expect(packageOffenders(componentModules, pkg)).toStrictEqual([]);
  });
});

describe("src/ai/port.ts does not know its adapters", () => {
  it("imports nothing from src/ai/adapters/", () => {
    const port = sourceModules.find((module) => module.file === "src/ai/port.ts");
    expect(port).toBeDefined();
    const offenders = (port?.specifiers ?? []).filter((specifier) =>
      importsAdapter("src/ai/port.ts", specifier),
    );
    expect(offenders).toStrictEqual([]);
  });
});
