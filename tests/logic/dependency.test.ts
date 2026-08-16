import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyPlan } from "../../src/lib/dependencies/apply.ts";
import { buildPlan } from "../../src/lib/dependencies/plan.ts";
import {
  chain,
  cycleLines,
  editLines,
  planHead,
  planRows,
  summary,
} from "../../src/lib/dependencies/report.ts";
import { collectSemanticsRefs, scanLibraries } from "../../src/lib/dependencies/scan.ts";
import { parseSeedArg } from "../../src/lib/dependencies/version.ts";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "dependency-check-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

interface LibrarySpec {
  dir: string;
  machineName: string;
  major?: number;
  minor: number;
  patch?: number;
  /** semantics library options, e.g. ['H5P.Accordion 1.0'] */
  uses?: string[];
  dependencies?: {
    machineName: string;
    majorVersion: number;
    minorVersion: number;
  }[];
}

function writeLibrary(spec: LibrarySpec): void {
  const dir = path.join(root, spec.dir);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, "library.json"),
    JSON.stringify(
      {
        title: spec.machineName,
        machineName: spec.machineName,
        majorVersion: spec.major ?? 1,
        minorVersion: spec.minor,
        patchVersion: spec.patch ?? 0,
        runnable: 1,
        ...(spec.dependencies
          ? { preloadedDependencies: spec.dependencies }
          : {}),
      },
      null,
      2,
    ),
  );

  if (spec.uses) {
    fs.writeFileSync(
      path.join(dir, "semantics.json"),
      JSON.stringify(
        [
          {
            name: "content",
            type: "library",
            label: "Content",
            options: spec.uses,
          },
        ],
        null,
        2,
      ),
    );
  }
}

/** Accordion <- Column <- InteractiveBook, the chain from the real workspace. */
function writeNestedChain(): void {
  writeLibrary({
    dir: "h5p-accordion",
    machineName: "H5P.Accordion",
    minor: 2,
  });
  writeLibrary({
    dir: "h5p-column",
    machineName: "H5P.Column",
    minor: 22,
    uses: ["H5P.Accordion 1.0", "H5P.Image 1.1"],
  });
  writeLibrary({
    dir: "h5p-interactive-book",
    machineName: "H5P.InteractiveBook",
    minor: 15,
    uses: ["H5P.Column 1.22"],
  });
}

/** Plan a single seed, named the way the command line would name it. */
function plan(seed: string) {
  return planAll([seed]);
}

function planAll(seeds: string[]) {
  return buildPlan(scanLibraries(root), {
    seeds: seeds.map(parseSeedArg),
    librariesDir: root,
  });
}

describe("scanning", () => {
  it("reads machineName and version from library.json, not the folder name", () => {
    writeNestedChain();
    const { libraries } = scanLibraries(root);

    const column = libraries.find(
      (library) => library.dirName === "h5p-column",
    );
    expect(column?.machineName).toBe("H5P.Column");
    expect(column?.version).toEqual({ major: 1, minor: 22 });
  });

  it("finds library options nested inside groups and lists", () => {
    const semantics = [
      {
        name: "chapters",
        type: "list",
        field: {
          name: "chapter",
          type: "group",
          fields: [
            { name: "contents", type: "library", options: ["H5P.Column 1.22"] },
          ],
        },
      },
    ];

    const refs = collectSemanticsRefs(semantics);
    expect(refs).toEqual([
      {
        machineName: "H5P.Column",
        version: { major: 1, minor: 22 },
        fieldPath: "chapters.chapter.contents",
      },
    ]);
  });

  it("ignores select-field options that are not library references", () => {
    const semantics = [
      {
        name: "useSeparator",
        type: "select",
        options: [{ value: "auto", label: "Automatic" }],
      },
    ];

    expect(collectSemanticsRefs(semantics)).toEqual([]);
  });
});

describe("ripple", () => {
  it("bumps the whole nested chain from a single seed bump", () => {
    writeNestedChain();
    const result = plan("H5P.Accordion");

    expect(result.seeds).toEqual([
      {
        machineName: "H5P.Accordion",
        from: { major: 1, minor: 2 },
        to: { major: 1, minor: 3 },
      },
    ]);
    expect(
      result.order.map(
        (node) => `${node.machineName} ${node.from.minor}->${node.to.minor}`,
      ),
    ).toEqual([
      "H5P.Accordion 2->3",
      "H5P.Column 22->23",
      "H5P.InteractiveBook 15->16",
    ]);
  });

  it("reports the reference edit each dependent needs, with its line", () => {
    writeNestedChain();
    const column = plan("H5P.Accordion").order.find(
      (node) => node.machineName === "H5P.Column",
    )!;

    const semanticsEdit = column.edits.find(
      (edit) => edit.kind === "semantics-option",
    )!;
    expect(semanticsEdit.relFile).toBe(
      path.join("h5p-column", "semantics.json"),
    );
    expect(semanticsEdit).toMatchObject({
      token: '"H5P.Accordion 1.0"',
      replacement: '"H5P.Accordion 1.3"',
    });
    expect(semanticsEdit.lines.length).toBe(1);
    expect(semanticsEdit.note).toContain("2 minor versions behind");
  });

  it("leaves unrelated libraries out of the plan", () => {
    writeNestedChain();
    writeLibrary({ dir: "h5p-blanks", machineName: "H5P.Blanks", minor: 14 });

    const names = plan("H5P.Accordion").order.map((node) => node.machineName);
    expect(names).not.toContain("H5P.Blanks");
  });

  it("does not bump a dependent that already points at the new version", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.3"],
    });

    const result = plan("H5P.Accordion");
    expect(result.order.map((node) => node.machineName)).toEqual([
      "H5P.Accordion",
    ]);
    expect(result.upToDate).toEqual([
      {
        machineName: "H5P.Column",
        dependencyName: "H5P.Accordion",
        pinned: { major: 1, minor: 3 },
      },
    ]);
  });

  it("ignores references pinned to a different major version", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 2.0"],
    });

    expect(plan("H5P.Accordion").order.map((node) => node.machineName)).toEqual(
      ["H5P.Accordion"],
    );
  });

  it("bumps each library once when several paths reach it", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2"],
    });
    writeLibrary({
      dir: "h5p-book",
      machineName: "H5P.InteractiveBook",
      minor: 15,
      // reaches Accordion both directly and through Column
      uses: ["H5P.Column 1.22", "H5P.Accordion 1.2"],
    });

    const result = plan("H5P.Accordion");
    const book = result.order.filter(
      (node) => node.machineName === "H5P.InteractiveBook",
    );
    expect(book).toHaveLength(1);
    expect(book[0]!.to).toEqual({ major: 1, minor: 16 });
    expect(
      book[0]!.edits.filter((edit) => edit.kind === "semantics-option"),
    ).toHaveLength(2);
  });

  it("terminates on a reference cycle and reports it as a group", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2", "H5P.Row 1.3"],
    });
    writeLibrary({
      dir: "h5p-row",
      machineName: "H5P.Row",
      minor: 3,
      uses: ["H5P.Column 1.22"],
    });

    const result = plan("H5P.Accordion");
    expect(result.order.map((node) => node.machineName).sort()).toEqual([
      "H5P.Accordion",
      "H5P.Column",
      "H5P.Row",
    ]);
    expect(result.cycles).toHaveLength(1);
    expect(result.cycles[0]!.sort()).toEqual(["H5P.Column", "H5P.Row"]);
  });

  it("orders dependencies before the libraries that reference them", () => {
    writeNestedChain();
    const names = plan("H5P.Accordion").order.map((node) => node.machineName);
    expect(names.indexOf("H5P.Column")).toBeLessThan(
      names.indexOf("H5P.InteractiveBook"),
    );
  });

  it("ripples through library.json dependency references, not just semantics", () => {
    writeLibrary({
      dir: "h5p-joubelui",
      machineName: "H5P.JoubelUI",
      minor: 3,
    });
    writeLibrary({
      dir: "h5p-book",
      machineName: "H5P.InteractiveBook",
      minor: 15,
      dependencies: [
        { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
      ],
    });
    writeLibrary({
      dir: "h5p-course",
      machineName: "H5P.CoursePresentation",
      minor: 27,
      uses: ["H5P.InteractiveBook 1.15"],
    });

    const result = plan("H5P.JoubelUI");
    expect(result.order.map((node) => node.machineName)).toEqual([
      "H5P.JoubelUI",
      "H5P.InteractiveBook",
      "H5P.CoursePresentation",
    ]);

    const book = result.order.find(
      (node) => node.machineName === "H5P.InteractiveBook",
    )!;
    expect(
      book.edits.some(
        (edit) =>
          edit.kind === "dependency-version" &&
          edit.dependencyName === "H5P.JoubelUI" &&
          edit.value === 4,
      ),
    ).toBe(true);
  });

  it("leaves older side-by-side copies alone but warns about them", () => {
    writeLibrary({
      dir: "H5P.Accordion-1.2",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "H5P.Column-1.21",
      machineName: "H5P.Column",
      minor: 21,
      uses: ["H5P.Accordion 1.0"],
    });
    writeLibrary({
      dir: "H5P.Column-1.22",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.0"],
    });

    const result = plan("H5P.Accordion");
    const column = result.order.find(
      (node) => node.machineName === "H5P.Column",
    )!;
    expect(column.from).toEqual({ major: 1, minor: 22 });
    expect(result.warnings.join("\n")).toContain("H5P.Column-1.21");
  });

  it("accepts an explicit range when library.json was already bumped by hand", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 3,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2"],
    });

    const result = plan("H5P.Accordion@1.2..1.3");
    const seed = result.order[0]!;
    // The seed's library.json already says 1.3, so it needs no version edit.
    expect(
      seed.edits.filter((edit) => edit.kind === "library-version"),
    ).toHaveLength(0);
    expect(result.order.map((node) => node.machineName)).toContain(
      "H5P.Column",
    );
  });

  it("rejects a range whose target is not ahead of its start", () => {
    writeNestedChain();
    expect(() => plan("H5P.Accordion@1.2..1.2")).toThrow(/must be greater than/);
  });

  it("names the libraries it did find when the seed is missing", () => {
    writeNestedChain();
    expect(() => plan("H5P.Nope")).toThrow(/H5P.Accordion/);
  });
});

describe("naming a library by its directory", () => {
  it("accepts the repository folder name", () => {
    writeNestedChain();
    const result = plan("h5p-accordion");

    expect(result.seeds).toEqual([
      {
        machineName: "H5P.Accordion",
        from: { major: 1, minor: 2 },
        to: { major: 1, minor: 3 },
      },
    ]);
    expect(result.order.map((node) => node.machineName)).toContain(
      "H5P.Column",
    );
  });

  it("accepts a folder name in a different case", () => {
    writeNestedChain();
    expect(plan("H5P-Accordion").seeds[0]!.machineName).toBe("H5P.Accordion");
  });

  it("accepts a machine name in a different case", () => {
    writeNestedChain();
    expect(plan("h5p.accordion").seeds[0]!.machineName).toBe("H5P.Accordion");
  });

  it("takes a version range on a folder name too", () => {
    writeNestedChain();
    expect(plan("h5p-accordion@1.2..1.5").seeds[0]).toEqual({
      machineName: "H5P.Accordion",
      from: { major: 1, minor: 2 },
      to: { major: 1, minor: 5 },
    });
  });

  it("prefers a machine name over a folder of the same name", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    // A folder named after a *different* library than the one it holds.
    writeLibrary({ dir: "H5P.Accordion", machineName: "H5P.Impostor", minor: 9 });

    expect(plan("H5P.Accordion").seeds[0]).toMatchObject({
      machineName: "H5P.Accordion",
      from: { major: 1, minor: 2 },
    });
  });

  it("rejects a folder name that matches several libraries", () => {
    // Two folders differing only in case, holding different libraries. Built
    // by hand rather than on disk, since macOS would fold them into one.
    const record = (dirName: string, machineName: string) => ({
      machineName,
      version: { major: 1, minor: 1 },
      patch: 0,
      dir: path.join(root, dirName),
      dirName,
      hasSemantics: false,
      refs: [],
    });

    expect(() =>
      buildPlan(
        {
          libraries: [record("shared", "H5P.One"), record("Shared", "H5P.Two")],
          problems: [],
        },
        { seeds: [parseSeedArg("SHARED")], librariesDir: root },
      ),
    ).toThrow(/matches several libraries/);
  });

  it("rejects the same library named twice under two spellings", () => {
    writeNestedChain();
    expect(() => planAll(["H5P.Accordion", "h5p-accordion"])).toThrow(
      /named twice/,
    );
  });
});

describe("several seeds at once", () => {
  /** Two independently bumped libraries that Column happens to offer both of. */
  function writeSharedDependent(): void {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({ dir: "h5p-audio", machineName: "H5P.Audio", minor: 5 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2", "H5P.Audio 1.5"],
    });
  }

  it("bumps a shared dependent once, not once per seed", () => {
    writeSharedDependent();
    const result = planAll(["H5P.Accordion", "H5P.Audio"]);

    const column = result.order.filter(
      (node) => node.machineName === "H5P.Column",
    );
    expect(column).toHaveLength(1);
    // 22 -> 23, not 22 -> 24 as two sequential runs would give.
    expect(column[0]!.to).toEqual({ major: 1, minor: 23 });
  });

  it("records every seed that forced a shared dependent", () => {
    writeSharedDependent();
    const column = planAll(["H5P.Accordion", "H5P.Audio"]).order.find(
      (node) => node.machineName === "H5P.Column",
    )!;

    expect(column.causes.map((cause) => cause.via).sort()).toEqual([
      "H5P.Accordion",
      "H5P.Audio",
    ]);
    // and it still needs both reference edits
    expect(
      column.edits.filter((edit) => edit.kind === "semantics-option"),
    ).toHaveLength(2);
  });

  it("reaches the union of what the seeds reach separately", () => {
    writeSharedDependent();
    writeLibrary({
      dir: "h5p-book",
      machineName: "H5P.InteractiveBook",
      minor: 15,
      uses: ["H5P.Column 1.22"],
    });
    writeLibrary({
      dir: "h5p-course",
      machineName: "H5P.CoursePresentation",
      minor: 27,
      uses: ["H5P.Audio 1.5"],
    });

    const separately = new Set([
      ...plan("H5P.Accordion").order.map((node) => node.machineName),
      ...plan("H5P.Audio").order.map((node) => node.machineName),
    ]);
    const together = planAll(["H5P.Accordion", "H5P.Audio"]).order.map(
      (node) => node.machineName,
    );

    expect(together).toHaveLength(new Set(together).size);
    expect([...together].sort()).toEqual([...separately].sort());
  });

  it("gives each seed its own version range", () => {
    writeSharedDependent();
    const result = planAll(["H5P.Accordion@1.0..1.2", "H5P.Audio@2.0..2.1"]);

    expect(result.seeds).toEqual([
      {
        machineName: "H5P.Accordion",
        from: { major: 1, minor: 0 },
        to: { major: 1, minor: 2 },
      },
      {
        machineName: "H5P.Audio",
        from: { major: 2, minor: 0 },
        to: { major: 2, minor: 1 },
      },
    ]);
  });

  it("keeps a seed's named target when another seed also reaches it", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2"],
    });

    // Column is named outright *and* stranded by Accordion. One bump, to the
    // version asked for — not that version plus a rippled one on top.
    const result = planAll(["H5P.Accordion", "H5P.Column@1.22..1.25"]);
    const column = result.order.filter(
      (node) => node.machineName === "H5P.Column",
    );

    expect(column).toHaveLength(1);
    expect(column[0]!.to).toEqual({ major: 1, minor: 25 });
    expect(column[0]!.seed).toBe(true);
    expect(
      column[0]!.edits.some(
        (edit) =>
          edit.kind === "semantics-option" &&
          edit.replacement === '"H5P.Accordion 1.3"',
      ),
    ).toBe(true);
  });

  it("orders a seed after the seed that strands it", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2"],
    });

    // named in the wrong order on purpose
    const names = planAll(["H5P.Column", "H5P.Accordion"]).order.map(
      (node) => node.machineName,
    );
    expect(names).toEqual(["H5P.Accordion", "H5P.Column"]);
  });

  it("says so when a named library is both a seed and a dependent", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2"],
    });

    const rows = planRows(planAll(["H5P.Accordion", "H5P.Column"]));
    const column = rows.find((row) => row[1] === "H5P.Column")!;
    expect(column[4]).toBe(
      "the bump you asked about; also references H5P.Accordion",
    );
  });

  it("reports every seed", () => {
    writeSharedDependent();
    expect(planAll(["H5P.Accordion", "H5P.Audio"]).seeds).toEqual([
      {
        machineName: "H5P.Accordion",
        from: { major: 1, minor: 2 },
        to: { major: 1, minor: 3 },
      },
      {
        machineName: "H5P.Audio",
        from: { major: 1, minor: 5 },
        to: { major: 1, minor: 6 },
      },
    ]);
  });

  it("applies a shared dependent's bump exactly once", () => {
    writeSharedDependent();
    applyPlan(planAll(["H5P.Accordion", "H5P.Audio"]));

    const column = JSON.parse(
      fs.readFileSync(path.join(root, "h5p-column", "library.json"), "utf-8"),
    );
    expect(column.minorVersion).toBe(23);

    const semantics = fs.readFileSync(
      path.join(root, "h5p-column", "semantics.json"),
      "utf-8",
    );
    expect(semantics).toContain('"H5P.Accordion 1.3"');
    expect(semantics).toContain('"H5P.Audio 1.6"');
  });

  it("rejects the same library named twice", () => {
    writeSharedDependent();
    expect(() => planAll(["H5P.Accordion", "H5P.Accordion@1.2..1.4"])).toThrow(
      /named twice/,
    );
  });

  it("names every missing library at once", () => {
    writeSharedDependent();
    expect(() => planAll(["H5P.Nope", "H5P.AlsoNope"])).toThrow(
      /H5P.Nope, H5P.AlsoNope/,
    );
  });
});

describe("seed argument grammar", () => {
  it("takes a bare machine name", () => {
    expect(parseSeedArg("H5P.Accordion")).toEqual({
      machineName: "H5P.Accordion",
    });
  });

  it("takes a machine name with a version range", () => {
    expect(parseSeedArg("H5P.Accordion@1.0..1.2")).toEqual({
      machineName: "H5P.Accordion",
      from: { major: 1, minor: 0 },
      to: { major: 1, minor: 2 },
    });
  });

  it("rejects a half-written range rather than guessing which end it is", () => {
    expect(() => parseSeedArg("H5P.Accordion@1.2")).toThrow(/expected/);
    expect(() => parseSeedArg("H5P.Accordion@1.2..")).toThrow(/expected/);
    expect(() => parseSeedArg("H5P.Accordion@..1.2")).toThrow(/expected/);
  });

  it("rejects a range that is not major.minor", () => {
    expect(() => parseSeedArg("H5P.Accordion@1..2")).toThrow(/major.*minor/);
    expect(() => parseSeedArg("H5P.Accordion@1.0.3..1.1")).toThrow(
      /major.*minor/,
    );
  });
});

describe("apply", () => {
  it("writes the version bumps and the reference updates", () => {
    writeNestedChain();
    const result = plan("H5P.Accordion");
    const applied = applyPlan(result);

    expect(applied.failures).toEqual([]);

    const accordion = JSON.parse(
      fs.readFileSync(
        path.join(root, "h5p-accordion", "library.json"),
        "utf-8",
      ),
    );
    expect(accordion.minorVersion).toBe(3);

    const columnLibrary = JSON.parse(
      fs.readFileSync(path.join(root, "h5p-column", "library.json"), "utf-8"),
    );
    expect(columnLibrary.minorVersion).toBe(23);

    const columnSemantics = fs.readFileSync(
      path.join(root, "h5p-column", "semantics.json"),
      "utf-8",
    );
    expect(columnSemantics).toContain('"H5P.Accordion 1.3"');
    expect(columnSemantics).not.toContain('"H5P.Accordion 1.0"');
    // untouched references stay untouched
    expect(columnSemantics).toContain('"H5P.Image 1.1"');

    const bookSemantics = fs.readFileSync(
      path.join(root, "h5p-interactive-book", "semantics.json"),
      "utf-8",
    );
    expect(bookSemantics).toContain('"H5P.Column 1.23"');
  });

  it("resets patchVersion on a bump", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
      patch: 7,
    });

    applyPlan(plan("H5P.Accordion"));
    const bumped = JSON.parse(
      fs.readFileSync(
        path.join(root, "h5p-accordion", "library.json"),
        "utf-8",
      ),
    );
    expect(bumped).toMatchObject({ minorVersion: 3, patchVersion: 0 });
  });

  it("does not confuse the top-level version with a dependency version", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
      dependencies: [
        { machineName: "FontAwesome", majorVersion: 4, minorVersion: 5 },
      ],
    });

    applyPlan(plan("H5P.Accordion"));
    const bumped = JSON.parse(
      fs.readFileSync(
        path.join(root, "h5p-accordion", "library.json"),
        "utf-8",
      ),
    );
    expect(bumped.minorVersion).toBe(3);
    expect(bumped.preloadedDependencies[0]).toEqual({
      machineName: "FontAwesome",
      majorVersion: 4,
      minorVersion: 5,
    });
  });

  it("writes a bumped dependency entry and the dependent's own bump", () => {
    writeLibrary({
      dir: "h5p-joubelui",
      machineName: "H5P.JoubelUI",
      minor: 3,
    });
    writeLibrary({
      dir: "h5p-book",
      machineName: "H5P.InteractiveBook",
      minor: 15,
      dependencies: [
        { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
      ],
    });

    applyPlan(plan("H5P.JoubelUI"));
    const book = JSON.parse(
      fs.readFileSync(path.join(root, "h5p-book", "library.json"), "utf-8"),
    );
    expect(book).toMatchObject({ minorVersion: 16 });
    expect(book.preloadedDependencies[0]).toEqual({
      machineName: "H5P.JoubelUI",
      majorVersion: 1,
      minorVersion: 4,
    });
  });

  it("preserves file formatting outside the edited values", () => {
    const dir = path.join(root, "h5p-accordion");
    fs.mkdirSync(dir, { recursive: true });
    const original = [
      "{",
      '  "machineName": "H5P.Accordion",',
      "",
      '  "majorVersion": 1,',
      '  "minorVersion": 2,',
      '  "patchVersion": 0,',
      '  "runnable": 1',
      "}",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "library.json"), original);

    applyPlan(plan("H5P.Accordion"));
    expect(fs.readFileSync(path.join(dir, "library.json"), "utf-8")).toBe(
      original.replace('"minorVersion": 2', '"minorVersion": 3'),
    );
  });

  it("is idempotent — a second apply of the same plan changes nothing", () => {
    writeNestedChain();
    const result = plan("H5P.Accordion");
    applyPlan(result);
    const snapshot = fs.readFileSync(
      path.join(root, "h5p-column", "semantics.json"),
      "utf-8",
    );

    applyPlan(result);
    expect(
      fs.readFileSync(path.join(root, "h5p-column", "semantics.json"), "utf-8"),
    ).toBe(snapshot);
  });
});

describe("report", () => {
  it("gives one row per library, in bump order", () => {
    writeNestedChain();
    const result = plan("H5P.Accordion");

    expect(planHead(result)).toEqual(["#", "Library", "From", "To", "Reason"]);
    expect(planRows(result)).toEqual([
      ["1", "H5P.Accordion", "1.2", "1.3", "the bump you asked about"],
      ["2", "H5P.Column", "1.22", "1.23", "references H5P.Accordion"],
      ["3", "H5P.InteractiveBook", "1.15", "1.16", "references H5P.Column"],
    ]);
  });

  it("adds a cycle column only when there are cycles", () => {
    writeLibrary({
      dir: "h5p-accordion",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.2", "H5P.Row 1.3"],
    });
    writeLibrary({
      dir: "h5p-row",
      machineName: "H5P.Row",
      minor: 3,
      uses: ["H5P.Column 1.22"],
    });

    const result = plan("H5P.Accordion");
    expect(planHead(result)).toContain("Cycle");
    expect(cycleLines(result)).toHaveLength(1);
    expect(cycleLines(result)[0]).toMatch(/H5P\.(Column|Row) <-> H5P\.(Column|Row)/);

    const rows = planRows(result);
    expect(rows.find((row) => row[1] === "H5P.Accordion")![5]).toBe("");
    expect(rows.find((row) => row[1] === "H5P.Column")![5]).toBe("1");
  });

  it("summarises how many other libraries are affected", () => {
    writeNestedChain();
    expect(summary(plan("H5P.Accordion"))).toContain("2 other libraries");

    writeLibrary({ dir: "h5p-lonely", machineName: "H5P.Lonely", minor: 1 });
    expect(summary(plan("H5P.Lonely"))).toBe(
      "No other library needs a minor bump.",
    );
  });

  it("names more than three causes without listing them all", () => {
    writeLibrary({ dir: "h5p-base", machineName: "H5P.Base", minor: 1 });
    for (const name of ["A", "B", "C", "D"]) {
      writeLibrary({
        dir: `h5p-${name.toLowerCase()}`,
        machineName: `H5P.${name}`,
        minor: 1,
        uses: ["H5P.Base 1.1"],
      });
    }
    writeLibrary({
      dir: "h5p-top",
      machineName: "H5P.Top",
      minor: 1,
      uses: ["H5P.A 1.1", "H5P.B 1.1", "H5P.C 1.1", "H5P.D 1.1"],
    });

    const top = planRows(plan("H5P.Base")).find((row) => row[1] === "H5P.Top")!;
    expect(top[4]).toMatch(/references .+ and 1 more/);
  });

  it("reports the ripple chain and the exact edits behind a row", () => {
    writeNestedChain();
    const result = plan("H5P.Accordion");
    const book = result.order.find(
      (node) => node.machineName === "H5P.InteractiveBook",
    )!;
    const column = result.order.find(
      (node) => node.machineName === "H5P.Column",
    )!;

    expect(chain(result, book).join(" -> ")).toBe(
      "H5P.Accordion -> H5P.Column -> H5P.InteractiveBook",
    );

    const lines = editLines(column).join("\n");
    expect(lines).toContain(path.join("h5p-column", "library.json"));
    expect(lines).toContain("H5P.Accordion 1.0 -> 1.3");
    expect(lines).toContain(
      "note: reference was already 2 minor versions behind",
    );
  });

  it("keeps warnings on the plan, separate from the rows", () => {
    writeLibrary({
      dir: "H5P.Accordion-1.2",
      machineName: "H5P.Accordion",
      minor: 2,
    });
    writeLibrary({
      dir: "H5P.Column-1.21",
      machineName: "H5P.Column",
      minor: 21,
      uses: ["H5P.Accordion 1.0"],
    });
    writeLibrary({
      dir: "H5P.Column-1.22",
      machineName: "H5P.Column",
      minor: 22,
      uses: ["H5P.Accordion 1.0"],
    });

    const result = plan("H5P.Accordion");
    expect(result.warnings.join("\n")).toContain("H5P.Column-1.21");
    expect(planRows(result).flat().join(" ")).not.toContain("older copy");
  });
});
