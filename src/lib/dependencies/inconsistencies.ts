/**
 * Finding references that disagree about which version of a library to use.
 *
 * A library can name the same dependency more than once — in `semantics.json`
 * options, and in any of the three dependency arrays in `library.json`. Those
 * references have to agree on both major and minor: when two of them name
 * different versions the library declares one version to the editor and another
 * to the runtime, pulls two copies, and the newer one wins by accident.
 *
 * H5P does treat `H5P.Accordion 1.x` and `2.x` as separate libraries, which is
 * why *resolving* a reference to a checkout still matches on major — but that is
 * about where a reference points, not about whether one library may point two
 * ways at once. Grouping for conflict detection is therefore by machine name
 * alone, and cross-major disagreement is a conflict like any other.
 *
 * A library also has to agree with *itself*: naming itself in one of its own
 * dependency arrays at a version other than its top-level one is the same
 * disagreement, and is how a bumped library.json leaves a stale self-pin behind.
 * Its own version therefore joins its own group as a pin.
 */
import path from 'path';
import type { LibraryRecord, LibraryRef, RefKind, ScanResult } from './scan.ts';
import { compareVersions, type Version } from './version.ts';

/** One reference, and the file and line that declares it. */
export type Pin = LibraryRef & {
  /** The library whose file declares this reference. */
  declaredBy: LibraryRecord;
  relFile: string;
};

export type Conflict = Group & {
  /** The library whose dependency set holds the conflict. */
  library: LibraryRecord;
  /** Distinct versions, ascending. */
  versions: Version[];
};

export type InconsistencyReport = {
  librariesDir: string;
  scanned: number;
  /** Conflicts among a library's own references. */
  direct: Conflict[];
  /** Conflicts anywhere in a library's reachable set. Empty unless asked for. */
  transitive: Conflict[];
  warnings: string[];
};

export type InconsistencyOptions = {
  librariesDir: string;
  /** Walk the whole reachable set, not just each library's own references. */
  transitive?: boolean;
};

/**
 * `where` for the pin standing in for a library's own version declaration.
 *
 * Reads like the `(root)` that `collectSemanticsRefs` uses for a field path with
 * no name above it.
 */
export const SELF_WHERE = '(self)';

/**
 * Grouping identity for conflict detection: the machine name alone.
 *
 * One library must pin one dependency at one version, whichever major that is,
 * so every reference to a name belongs in the same group.
 */
function groupKey(machineName: string): string {
  return machineName;
}

/**
 * Which checkout a reference points at. Same shape as the bump planner's index:
 * references resolve on major only, because H5P really does ship majors as
 * separate libraries.
 */
function resolveKey(machineName: string, major: number): string {
  return `${machineName}|${major}`;
}

/** Node identity for the walk — a specific checkout, not a reference. */
function recordKey(record: LibraryRecord): string {
  return `${record.machineName}|${record.version.major}.${record.version.minor}`;
}

function fileOf(record: LibraryRecord, kind: RefKind, librariesDir: string): string {
  const file = kind === 'semantics' ? 'semantics.json' : 'library.json';
  return path.relative(librariesDir, path.join(record.dir, file));
}

/**
 * The newest checkout of each major.
 *
 * `latestByMachineName` collapses majors together, which would make a 1.x
 * reference resolve to a 2.x checkout, so this keeps them apart.
 */
function byMajor(libraries: LibraryRecord[]): Map<string, LibraryRecord> {
  const index = new Map<string, LibraryRecord>();

  for (const library of libraries) {
    const key = resolveKey(library.machineName, library.version.major);
    const current = index.get(key);
    if (!current || compareVersions(library.version, current.version) > 0) {
      index.set(key, library);
    }
  }

  return index;
}

/** A dependency (by machine name) and every reference pinning it. */
type Group = {
  /** The dependency pinned at more than one version. */
  machineName: string;
  pins: Pin[];
};

function addPin(groups: Map<string, Group>, record: LibraryRecord, librariesDir: string): void {
  for (const ref of record.refs) {
    const key = groupKey(ref.machineName);
    let group = groups.get(key);
    if (!group) {
      group = { machineName: ref.machineName, pins: [] };
      groups.set(key, group);
    }

    group.pins.push({
      ...ref,
      declaredBy: record,
      relFile: fileOf(record, ref.kind, librariesDir),
    });
  }
}

/** Distinct versions in a group, ascending. */
function distinctVersions(pins: Pin[]): Version[] {
  const seen = new Map<string, Version>();
  for (const pin of pins) {
    const key = `${pin.version.major}.${pin.version.minor}`;
    if (!seen.has(key)) seen.set(key, pin.version);
  }
  return [...seen.values()].sort(compareVersions);
}

function toConflicts(library: LibraryRecord, groups: Map<string, Group>): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const group of groups.values()) {
    const versions = distinctVersions(group.pins);
    if (versions.length < 2) continue;

    conflicts.push({
      library,
      machineName: group.machineName,
      versions,
      pins: [...group.pins].sort((a, b) => compareVersions(a.version, b.version)),
    });
  }

  return conflicts.sort((a, b) => a.machineName.localeCompare(b.machineName));
}

/** The library's own version, as a pin in its own group. */
function selfPin(record: LibraryRecord, librariesDir: string): Pin {
  return {
    machineName: record.machineName,
    version: record.version,
    kind: 'dependency',
    where: SELF_WHERE,
    lines: record.selfLines,
    declaredBy: record,
    relFile: fileOf(record, 'dependency', librariesDir),
  };
}

function addSelfPin(groups: Map<string, Group>, record: LibraryRecord, librariesDir: string): void {
  const key = groupKey(record.machineName);
  const group = groups.get(key) ?? { machineName: record.machineName, pins: [] };
  group.pins.push(selfPin(record, librariesDir));
  groups.set(key, group);
}

/** Conflicts among one library's own references, and its own version. */
function directConflicts(library: LibraryRecord, librariesDir: string): Conflict[] {
  const groups = new Map<string, Group>();
  addPin(groups, library, librariesDir);
  addSelfPin(groups, library, librariesDir);
  return toConflicts(library, groups);
}

/**
 * Conflicts anywhere in what a library can reach.
 *
 * Each checkout is expanded at most once per root, so reference cycles — which
 * H5P has, and which the bump planner reports explicitly — terminate here.
 *
 * Deliberately no `addSelfPin` for the libraries reached along the way. `byMajor`
 * resolves to the newest checkout of a major, so a self-pin on every reached
 * record would flag any reference that lags what is on disk — normal mid-bump,
 * and already `dependency-check`'s finding rather than this command's. The root
 * needs none either: `directConflicts` always runs, and the `reported` set below
 * would drop the repeat.
 */
function transitiveConflicts(
  root: LibraryRecord,
  index: Map<string, LibraryRecord>,
  librariesDir: string,
  unresolved: Set<string>,
): Conflict[] {
  const groups = new Map<string, Group>();
  const visited = new Set<string>([recordKey(root)]);
  const queue: LibraryRecord[] = [root];

  while (queue.length > 0) {
    const record = queue.shift()!;
    addPin(groups, record, librariesDir);

    for (const ref of record.refs) {
      const key = resolveKey(ref.machineName, ref.version.major);
      const target = index.get(key);

      // A reference to a major that is not checked out is a leaf. The old
      // implementation invented a node for it instead, which truncated the
      // walk at the first such reference.
      if (!target) {
        unresolved.add(key);
        continue;
      }

      const id = recordKey(target);
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(target);
    }
  }

  return toConflicts(root, groups);
}

export function findInconsistencies(
  scan: ScanResult,
  options: InconsistencyOptions,
): InconsistencyReport {
  const warnings = scan.problems.map((problem) => `could not read ${problem}`);
  const direct: Conflict[] = [];
  const transitive: Conflict[] = [];

  for (const library of scan.libraries) {
    direct.push(...directConflicts(library, options.librariesDir));
  }

  if (options.transitive) {
    const index = byMajor(scan.libraries);
    const unresolved = new Set<string>();

    for (const library of scan.libraries) {
      // Anything already reported against this library directly would repeat
      // here, since a library reaches its own references.
      const reported = new Set(
        direct
          .filter((conflict) => conflict.library === library)
          .map((conflict) => groupKey(conflict.machineName)),
      );

      for (const conflict of transitiveConflicts(library, index, options.librariesDir, unresolved)) {
        if (reported.has(groupKey(conflict.machineName))) continue;
        transitive.push(conflict);
      }
    }

    for (const key of [...unresolved].sort()) {
      const [machineName, major] = key.split('|');
      warnings.push(`${machineName} ${major}.x is referenced but not checked out`);
    }
  }

  return {
    librariesDir: options.librariesDir,
    scanned: scan.libraries.length,
    direct: direct.sort(
      (a, b) =>
        a.library.machineName.localeCompare(b.library.machineName) ||
        a.machineName.localeCompare(b.machineName),
    ),
    transitive,
    warnings,
  };
}
