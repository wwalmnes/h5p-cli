import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findInconsistencies } from "../../src/lib/dependencies/inconsistencies.ts";
import { scanLibraries } from "../../src/lib/dependencies/scan.ts";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "inconsistencies-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

type LibrarySpec = {
  dir: string;
  machineName: string;
  major?: number;
  minor: number;
  /** semantics library options, e.g. ['H5P.Accordion 1.0'] */
  uses?: string[];
  dependencies?: { machineName: string; majorVersion: number; minorVersion: number }[];
  editorDependencies?: { machineName: string; majorVersion: number; minorVersion: number }[];
};

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
        patchVersion: 0,
        runnable: 1,
        ...(spec.dependencies ? { preloadedDependencies: spec.dependencies } : {}),
        ...(spec.editorDependencies ? { editorDependencies: spec.editorDependencies } : {}),
      },
      null,
      2,
    ),
  );

  if (spec.uses) {
    fs.writeFileSync(
      path.join(dir, "semantics.json"),
      JSON.stringify(
        [{ name: "content", type: "library", label: "Content", options: spec.uses }],
        null,
        2,
      ),
    );
  }
}

function report(transitive = false) {
  return findInconsistencies(scanLibraries(root), { librariesDir: root, transitive });
}

describe("findInconsistencies", () => {
  it("flags a dependency pinned at two different minors of one major", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 3 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      // semantics says 1.0, library.json says 1.2 — the library pulls two copies
      uses: ["H5P.Accordion 1.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 2 }],
    });

    const result = report();

    expect(result.direct).toHaveLength(1);
    expect(result.direct[0].library.machineName).toBe("H5P.Column");
    expect(result.direct[0].machineName).toBe("H5P.Accordion");
    expect(result.direct[0].versions.map((v) => `${v.major}.${v.minor}`)).toEqual(["1.0", "1.2"]);
  });

  it("flags a dependency named at two different majors across library.json and semantics.json", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 0 });
    writeLibrary({ dir: "h5p-accordion-2", machineName: "H5P.Accordion", major: 2, minor: 0 });
    // The editor is told 1.0 and the runtime 2.0 — the same mistake as two
    // minors, only louder.
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      uses: ["H5P.Accordion 1.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 2, minorVersion: 0 }],
    });

    const result = report();

    expect(result.direct).toHaveLength(1);
    expect(result.direct[0].library.machineName).toBe("H5P.Column");
    expect(result.direct[0].machineName).toBe("H5P.Accordion");
    expect(result.direct[0].versions.map((v) => `${v.major}.${v.minor}`)).toEqual(["1.0", "2.0"]);
    expect(result.direct[0].pins.map((pin) => `${pin.version.major}.${pin.version.minor}`)).toEqual([
      "1.0",
      "2.0",
    ]);
  });

  it("flags two majors of one dependency declared inside library.json alone", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 0 });
    writeLibrary({ dir: "h5p-accordion-2", machineName: "H5P.Accordion", major: 2, minor: 0 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      dependencies: [
        { machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 0 },
        { machineName: "H5P.Accordion", majorVersion: 2, minorVersion: 0 },
      ],
    });

    const result = report();

    expect(result.direct).toHaveLength(1);
    expect(result.direct[0].versions.map((v) => `${v.major}.${v.minor}`)).toEqual(["1.0", "2.0"]);
    expect(result.direct[0].pins.every((pin) => pin.relFile.endsWith("library.json"))).toBe(true);
  });

  it("does not flag two libraries that each consistently pin a different major", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 0 });
    writeLibrary({ dir: "h5p-accordion-2", machineName: "H5P.Accordion", major: 2, minor: 0 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      uses: ["H5P.Accordion 1.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 0 }],
    });
    writeLibrary({
      dir: "h5p-dialogcards",
      machineName: "H5P.Dialogcards",
      minor: 0,
      uses: ["H5P.Accordion 2.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 2, minorVersion: 0 }],
    });

    // A conflict is a disagreement *within* one library's own references.
    expect(report().direct).toEqual([]);
  });

  it("reports a cross-major conflict reached through two different dependencies", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 0 });
    writeLibrary({ dir: "h5p-accordion-2", machineName: "H5P.Accordion", major: 2, minor: 0 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 0 }],
    });
    writeLibrary({
      dir: "h5p-dialogcards",
      machineName: "H5P.Dialogcards",
      minor: 0,
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 2, minorVersion: 0 }],
    });
    writeLibrary({
      dir: "h5p-interactive-book",
      machineName: "H5P.InteractiveBook",
      minor: 0,
      dependencies: [
        { machineName: "H5P.Column", majorVersion: 1, minorVersion: 1 },
        { machineName: "H5P.Dialogcards", majorVersion: 1, minorVersion: 0 },
      ],
    });

    const result = report(true);

    expect(result.direct).toEqual([]);
    const book = result.transitive.filter((c) => c.library.machineName === "H5P.InteractiveBook");
    expect(book).toHaveLength(1);
    expect(book[0].machineName).toBe("H5P.Accordion");
    expect(book[0].versions.map((v) => `${v.major}.${v.minor}`)).toEqual(["1.0", "2.0"]);
  });

  it("reports each conflicting pin with the file that declares it", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 3 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      uses: ["H5P.Accordion 1.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 2 }],
    });

    const [conflict] = report().direct;
    const files = conflict.pins.map((pin) => pin.relFile).sort();

    expect(files).toEqual([
      path.join("h5p-column", "library.json"),
      path.join("h5p-column", "semantics.json"),
    ]);
    for (const pin of conflict.pins) {
      expect(pin.lines.length).toBeGreaterThan(0);
    }
  });

  it("warns about a referenced major that is not checked out instead of truncating the walk", () => {
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      dependencies: [{ machineName: "H5P.Missing", majorVersion: 4, minorVersion: 0 }],
    });

    const result = report(true);

    expect(result.warnings).toContain("H5P.Missing 4.x is referenced but not checked out");
  });

  it("terminates on a reference cycle", () => {
    writeLibrary({
      dir: "h5p-a",
      machineName: "H5P.A",
      minor: 0,
      dependencies: [{ machineName: "H5P.B", majorVersion: 1, minorVersion: 0 }],
    });
    writeLibrary({
      dir: "h5p-b",
      machineName: "H5P.B",
      minor: 0,
      dependencies: [{ machineName: "H5P.A", majorVersion: 1, minorVersion: 0 }],
    });

    // The assertion is that this returns at all rather than hanging or overflowing.
    const result = report(true);

    expect(result.scanned).toBe(2);
    expect(result.direct).toEqual([]);
  });

  it("separates a conflict a library declares itself from one it only reaches", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 3 });
    // Column declares the conflict.
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      uses: ["H5P.Accordion 1.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 2 }],
    });
    // Book only reaches it, through Column.
    writeLibrary({
      dir: "h5p-interactive-book",
      machineName: "H5P.InteractiveBook",
      minor: 0,
      dependencies: [{ machineName: "H5P.Column", majorVersion: 1, minorVersion: 1 }],
    });

    const result = report(true);

    expect(result.direct.map((c) => c.library.machineName)).toEqual(["H5P.Column"]);
    expect(result.transitive.map((c) => c.library.machineName)).toEqual(["H5P.InteractiveBook"]);
  });

  it("flags a library that names itself at an older minor than its own version", () => {
    // The shape H5P.BranchingScenario 1.11 is in: bumped, but the self-pin in
    // editorDependencies was left behind at 1.10.
    writeLibrary({
      dir: "h5p-branching-scenario",
      machineName: "H5P.BranchingScenario",
      minor: 11,
      editorDependencies: [
        { machineName: "H5P.BranchingScenario", majorVersion: 1, minorVersion: 10 },
      ],
    });

    const result = report();

    expect(result.direct).toHaveLength(1);
    expect(result.direct[0].library.machineName).toBe("H5P.BranchingScenario");
    expect(result.direct[0].machineName).toBe("H5P.BranchingScenario");
    expect(result.direct[0].versions.map((v) => `${v.major}.${v.minor}`)).toEqual(["1.10", "1.11"]);

    const self = result.direct[0].pins.find((pin) => pin.where === "(self)");
    expect(self).toBeDefined();
    expect(self!.relFile).toBe(path.join("h5p-branching-scenario", "library.json"));
    expect(self!.lines.length).toBeGreaterThan(0);
  });

  it("does not flag a library that names itself at its own version", () => {
    writeLibrary({
      dir: "h5p-branching-scenario",
      machineName: "H5P.BranchingScenario",
      minor: 11,
      editorDependencies: [
        { machineName: "H5P.BranchingScenario", majorVersion: 1, minorVersion: 11 },
      ],
    });

    expect(report().direct).toEqual([]);
  });

  it("flags a library that names itself at another version in its own semantics", () => {
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 2,
      uses: ["H5P.Column 1.1"],
    });

    const result = report();

    expect(result.direct).toHaveLength(1);
    expect(result.direct[0].versions.map((v) => `${v.major}.${v.minor}`)).toEqual(["1.1", "1.2"]);
  });

  it("points each dependency entry at its own line, not every line naming it", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 3 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      // Same name in two arrays: each entry must claim one distinct line.
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 0 }],
      editorDependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 2 }],
    });

    const [conflict] = report().direct;
    const lines = conflict.pins.map((pin) => pin.lines);

    expect(lines.every((entry) => entry.length === 1)).toBe(true);
    expect(new Set(lines.flat()).size).toBe(2);
  });

  it("does not confuse a self-reference with the library's own machineName key", () => {
    writeLibrary({
      dir: "h5p-branching-scenario",
      machineName: "H5P.BranchingScenario",
      minor: 11,
      editorDependencies: [
        { machineName: "H5P.BranchingScenario", majorVersion: 1, minorVersion: 10 },
      ],
    });

    const [conflict] = report().direct;
    const raw = fs.readFileSync(path.join(root, "h5p-branching-scenario", "library.json"), "utf-8");
    const ownNameLine =
      raw
        .split("\n")
        .findIndex((line) => line.includes('"machineName": "H5P.BranchingScenario"')) + 1;

    const entry = conflict.pins.find((pin) => pin.where === "editorDependencies")!;
    expect(entry.lines).toHaveLength(1);
    expect(entry.lines).not.toContain(ownNameLine);
  });

  it("does not flag a reference that merely lags the checkout on disk", () => {
    // dependency-check's finding, not this one — and byMajor resolves to the
    // newest checkout, so treating it as a conflict would fire on every bump.
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 3 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      uses: ["H5P.Accordion 1.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 0 }],
    });
    writeLibrary({
      dir: "h5p-interactive-book",
      machineName: "H5P.InteractiveBook",
      minor: 0,
      dependencies: [{ machineName: "H5P.Column", majorVersion: 1, minorVersion: 1 }],
    });

    const result = report(true);

    expect(result.direct).toEqual([]);
    expect(result.transitive).toEqual([]);
  });

  it("reports nothing for a clean set of libraries", () => {
    writeLibrary({ dir: "h5p-accordion", machineName: "H5P.Accordion", minor: 0 });
    writeLibrary({
      dir: "h5p-column",
      machineName: "H5P.Column",
      minor: 1,
      uses: ["H5P.Accordion 1.0"],
      dependencies: [{ machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 0 }],
    });

    const result = report(true);

    expect(result.direct).toEqual([]);
    expect(result.transitive).toEqual([]);
    expect(result.scanned).toBe(2);
  });
});
