import fs from 'fs';
import path from 'path';
import { findTopLevelNumber, lineOf } from './json-edit.ts';
import {
  latestByMachineName,
  optionToken,
  type LibraryRecord,
  type LibraryRef,
  type RefKind,
  type ScanResult,
} from './scan.ts';
import {
  bumpMinor,
  compareVersions,
  formatVersion,
  type SeedArg,
  type Version,
} from './version.ts';

export type Edit =
  | {
      kind: 'library-version';
      file: string;
      relFile: string;
      key: 'majorVersion' | 'minorVersion' | 'patchVersion';
      value: number;
      detail: string;
      lines: number[];
    }
  | {
      kind: 'semantics-option';
      file: string;
      relFile: string;
      token: string;
      replacement: string;
      detail: string;
      lines: number[];
      note?: string;
    }
  | {
      kind: 'dependency-version';
      file: string;
      relFile: string;
      dependencyName: string;
      key: 'minorVersion';
      value: number;
      detail: string;
      lines: number[];
      note?: string;
    };

export interface Cause {
  /** The library whose bump forces this one. */
  via: string;
  viaTo: Version;
  kind: RefKind;
  where: string;
}

export interface BumpNode {
  machineName: string;
  title?: string;
  dirName: string;
  from: Version;
  to: Version;
  seed: boolean;
  causes: Cause[];
  edits: Edit[];
  /** Index into `Plan.cycles`, when this node sits in a reference cycle. */
  cycle?: number;
}

export interface UpToDate {
  machineName: string;
  dependencyName: string;
  pinned: Version;
}

export interface Plan {
  librariesDir: string;
  scanned: number;
  /** The bumps that were asked for, in the order they were named. */
  seeds: { machineName: string; from: Version; to: Version }[];
  order: BumpNode[];
  /** Groups of machine names that reference each other; bump them together. */
  cycles: string[][];
  upToDate: UpToDate[];
  warnings: string[];
}

export interface PlanOptions {
  /** The libraries being bumped, each with an optional explicit version range. */
  seeds: SeedArg[];
  librariesDir: string;
}

function refKey(machineName: string, major: number): string {
  return `${machineName}|${major}`;
}

interface Referrer {
  library: LibraryRecord;
  ref: LibraryRef;
}

function buildReverseIndex(libraries: LibraryRecord[]): Map<string, Referrer[]> {
  const index = new Map<string, Referrer[]>();

  for (const library of libraries) {
    for (const ref of library.refs) {
      const key = refKey(ref.machineName, ref.version.major);
      const bucket = index.get(key);
      if (bucket) bucket.push({ library, ref });
      else index.set(key, [{ library, ref }]);
    }
  }

  return index;
}

function readRaw(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return undefined;
  }
}

/** The library.json edits that constitute the version bump itself. */
function versionEdits(library: LibraryRecord, to: Version, librariesDir: string): Edit[] {
  const file = path.join(library.dir, 'library.json');
  const relFile = path.relative(librariesDir, file);
  const raw = readRaw(file) ?? '';
  const edits: Edit[] = [];

  if (library.version.minor !== to.minor) {
    const found = findTopLevelNumber(raw, 'minorVersion');
    edits.push({
      kind: 'library-version',
      file,
      relFile,
      key: 'minorVersion',
      value: to.minor,
      detail: `"minorVersion": ${library.version.minor} -> ${to.minor}`,
      lines: found ? [lineOf(raw, found.token.keyStart)] : [],
    });
  }

  if (library.version.major !== to.major) {
    const found = findTopLevelNumber(raw, 'majorVersion');
    edits.push({
      kind: 'library-version',
      file,
      relFile,
      key: 'majorVersion',
      value: to.major,
      detail: `"majorVersion": ${library.version.major} -> ${to.major}`,
      lines: found ? [lineOf(raw, found.token.keyStart)] : [],
    });
  }

  if (library.patch !== 0) {
    const found = findTopLevelNumber(raw, 'patchVersion');
    edits.push({
      kind: 'library-version',
      file,
      relFile,
      key: 'patchVersion',
      value: 0,
      detail: `"patchVersion": ${library.patch} -> 0 (reset by the minor bump)`,
      lines: found ? [lineOf(raw, found.token.keyStart)] : [],
    });
  }

  return edits;
}

function staleNote(pinned: Version, from: Version): string | undefined {
  const behind = from.minor - pinned.minor;
  if (pinned.major !== from.major || behind <= 0) return undefined;
  return `reference was already ${behind} minor version${behind === 1 ? '' : 's'} behind`;
}

function referenceEdit(
  referrer: LibraryRecord,
  ref: LibraryRef,
  to: Version,
  from: Version,
  librariesDir: string,
): Edit {
  const note = staleNote(ref.version, from);

  if (ref.kind === 'semantics') {
    const file = path.join(referrer.dir, 'semantics.json');
    return {
      kind: 'semantics-option',
      file,
      relFile: path.relative(librariesDir, file),
      token: optionToken(ref.machineName, ref.version),
      replacement: optionToken(ref.machineName, to),
      detail: `${ref.machineName} ${formatVersion(ref.version)} -> ${formatVersion(to)}  (${ref.where})`,
      lines: ref.lines,
      note,
    };
  }

  const file = path.join(referrer.dir, 'library.json');
  return {
    kind: 'dependency-version',
    file,
    relFile: path.relative(librariesDir, file),
    dependencyName: ref.machineName,
    key: 'minorVersion',
    value: to.minor,
    detail: `${ref.where}: ${ref.machineName} ${formatVersion(ref.version)} -> ${formatVersion(to)}`,
    lines: ref.lines,
    note,
  };
}

function sameEdit(a: Edit, b: Edit): boolean {
  return a.file === b.file && a.detail === b.detail;
}

function resolveSeeds(
  specs: SeedArg[],
  scan: ScanResult,
  latest: Map<string, LibraryRecord>,
): SeedArg[] {
  const missing: string[] = [];

  const resolved = specs.map((spec) => {
    if (latest.has(spec.machineName)) return spec;

    const wanted = spec.machineName.toLowerCase();
    const candidates = [
      (library: LibraryRecord) => library.machineName.toLowerCase() === wanted,
      (library: LibraryRecord) => library.dirName === spec.machineName,
      (library: LibraryRecord) => library.dirName.toLowerCase() === wanted,
    ];

    let names: string[] = [];
    for (const matches of candidates) {
      names = [...new Set(scan.libraries.filter(matches).map((library) => library.machineName))];
      if (names.length > 0) break;
    }

    if (names.length === 1) return { ...spec, machineName: names[0]! };

    if (names.length > 1) {
      throw new Error(
        `"${spec.machineName}" matches several libraries: ${names.sort().join(', ')} — name one of them instead`,
      );
    }

    // Collected rather than thrown, so naming three typos reports all three.
    missing.push(spec.machineName);
    return spec;
  });

  if (missing.length > 0) {
    const known = [...latest.keys()].sort().join(', ') || 'none';
    throw new Error(
      `${missing.join(', ')} ${missing.length === 1 ? 'was' : 'were'} not found in the libraries folder.\nLibraries present: ${known}`,
    );
  }

  return resolved;
}

/**
 * Work out the full set of libraries that must be bumped, in the order they
 * should be bumped in. Will only minor bump a library once.
 */
export function buildPlan(scan: ScanResult, options: PlanOptions): Plan {
  const latest = latestByMachineName(scan.libraries);

  if (options.seeds.length === 0) {
    throw new Error('Name at least one library to bump, e.g. H5P.Accordion');
  }

  const resolvedSeeds = resolveSeeds(options.seeds, scan, latest);

  const named = new Set<string>();
  for (const spec of resolvedSeeds) {
    if (named.has(spec.machineName)) {
      throw new Error(`${spec.machineName} was named twice — give each library one version range`);
    }
    named.add(spec.machineName);
  }

  const warnings = [...scan.problems.map((problem) => `could not read ${problem}`)];

  const seeds = resolvedSeeds.map((spec) => {
    const library = latest.get(spec.machineName)!;
    const from = spec.from ?? library.version;
    const to = spec.to ?? bumpMinor(from);

    if (compareVersions(to, from) <= 0) {
      throw new Error(
        `${spec.machineName}: ${formatVersion(to)} must be greater than ${formatVersion(from)}`,
      );
    }
    if (to.major !== from.major) {
      warnings.push(
        `${spec.machineName}: this is a major version change — in H5P that is a breaking change, and dependents must adopt it deliberately rather than as a routine bump`,
      );
    }
    if (compareVersions(library.version, from) !== 0) {
      warnings.push(
        `${spec.machineName} on disk is ${formatVersion(library.version)}, but the range says ${formatVersion(from)}`,
      );
    }

    const alreadyPresent = scan.libraries.find(
      (other) => other.machineName === spec.machineName && compareVersions(other.version, to) === 0,
    );
    if (alreadyPresent && alreadyPresent !== library) {
      warnings.push(
        `${spec.machineName} ${formatVersion(to)} already exists in the folder (${alreadyPresent.dirName})`,
      );
    }

    return { library, from, to };
  });

  const reverse = buildReverseIndex(scan.libraries);
  const nodes = new Map<string, BumpNode>();
  const upToDate: UpToDate[] = [];
  const queue: BumpNode[] = [];

  for (const { library, from, to } of seeds) {
    const seedNode: BumpNode = {
      machineName: library.machineName,
      title: library.title,
      dirName: library.dirName,
      from,
      to,
      seed: true,
      causes: [],
      edits: versionEdits(library, to, options.librariesDir),
    };

    nodes.set(library.machineName, seedNode);
    queue.push(seedNode);
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    const referrers = reverse.get(refKey(node.machineName, node.from.major)) ?? [];

    for (const { library, ref } of referrers) {
      if (library.machineName === node.machineName) continue;

      if (compareVersions(ref.version, node.to) >= 0) {
        upToDate.push({
          machineName: library.machineName,
          dependencyName: node.machineName,
          pinned: ref.version,
        });
        continue;
      }

      if (latest.get(library.machineName) !== library) {
        warnings.push(
          `${library.dirName} is an older copy of ${library.machineName} (${formatVersion(library.version)}) and was left alone, even though it references ${node.machineName} ${formatVersion(ref.version)}`,
        );
        continue;
      }

      const edit = referenceEdit(library, ref, node.to, node.from, options.librariesDir);

      let dependent = nodes.get(library.machineName);
      if (!dependent) {
        dependent = {
          machineName: library.machineName,
          title: library.title,
          dirName: library.dirName,
          from: library.version,
          to: bumpMinor(library.version),
          seed: false,
          causes: [],
          edits: versionEdits(library, bumpMinor(library.version), options.librariesDir),
        };
        nodes.set(library.machineName, dependent);
        queue.push(dependent);
      }

      if (!dependent.edits.some((existing) => sameEdit(existing, edit))) {
        dependent.edits.push(edit);
      }
      dependent.causes.push({
        via: node.machineName,
        viaTo: node.to,
        kind: ref.kind,
        where: ref.where,
      });
    }
  }

  const { order, cycles } = orderNodes(nodes);

  return {
    librariesDir: options.librariesDir,
    scanned: scan.libraries.length,
    seeds: seeds.map(({ library, from, to }) => ({
      machineName: library.machineName,
      from,
      to,
    })),
    order,
    cycles,
    upToDate,
    warnings,
  };
}

/**
 * Dependency-first ordering.
 *
 * Tarjan rather than a plain topological sort, because semantics references can
 * be mutually recursive. 
 */
export function orderNodes(nodes: Map<string, BumpNode>): { order: BumpNode[]; cycles: string[][] } {
  const edges = new Map<string, string[]>();
  for (const [name, node] of nodes) {
    if (!edges.has(name)) edges.set(name, []);
    for (const cause of node.causes) {
      // cause.via must be bumped before `name`.
      const bucket = edges.get(cause.via) ?? [];
      bucket.push(name);
      edges.set(cause.via, bucket);
    }
  }

  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;

  const visit = (name: string): void => {
    index.set(name, counter);
    low.set(name, counter);
    counter++;
    stack.push(name);
    onStack.add(name);

    for (const next of edges.get(name) ?? []) {
      if (!nodes.has(next)) continue;
      if (!index.has(next)) {
        visit(next);
        low.set(name, Math.min(low.get(name)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(name, Math.min(low.get(name)!, index.get(next)!));
      }
    }

    if (low.get(name) === index.get(name)) {
      const component: string[] = [];
      for (;;) {
        const popped = stack.pop()!;
        onStack.delete(popped);
        component.push(popped);
        if (popped === name) break;
      }
      components.push(component);
    }
  };

  for (const name of nodes.keys()) {
    if (!index.has(name)) visit(name);
  }

  components.reverse();

  const order: BumpNode[] = [];
  const cycles: string[][] = [];

  for (const component of components) {
    if (component.length > 1) {
      const group = cycles.length;
      cycles.push([...component]);
      for (const name of component) {
        const node = nodes.get(name)!;
        node.cycle = group;
        order.push(node);
      }
      continue;
    }
    order.push(nodes.get(component[0]!)!);
  }

  return { order, cycles };
}
