import fs from 'fs';
import path from 'path';
import { findTokenOffsets, lineOf } from './json-edit.ts';
import { compareVersions, formatVersion, type Version } from './version.ts';

export type RefKind = 'semantics' | 'dependency';

export type LibraryRef = {
  /** Library being referenced, e.g. H5P.Accordion. */
  machineName: string;
  /** Version the reference is pinned to. */
  version: Version;
  kind: RefKind;
  /** semantics: dotted field path. dependency: the declaring array's key. */
  where: string;
  /** 1-indexed line(s) in the declaring file. */
  lines: number[];
};

export type LibraryRecord = {
  machineName: string;
  version: Version;
  patch: number;
  title?: string;
  dir: string;
  /** Directory name as it appears on disk, used in reports. */
  dirName: string;
  hasSemantics: boolean;
  refs: LibraryRef[];
};

export type ScanResult = {
  libraries: LibraryRecord[];
  /** Directories that looked like libraries but could not be read. */
  problems: string[];
};

/** `"H5P.Accordion 1.0"` as it appears in a semantics `options` array. */
export function optionToken(machineName: string, version: Version): string {
  return `"${machineName} ${formatVersion(version)}"`;
}

function parseOption(option: string): { machineName: string; version: Version } | undefined {
  const match = /^(\S+)\s+(\d+)\.(\d+)$/.exec(option.trim());
  if (!match) return undefined;
  return {
    machineName: match[1]!,
    version: { major: Number(match[2]), minor: Number(match[3]) },
  };
}

type RawOption = {
  machineName: string;
  version: Version;
  fieldPath: string;
};

/**
 * Collect every `library`-type field's `options` entry.
 *
 * The walk is structural rather than a fixed field/fields/list recursion:
 * semantics nest groups inside list entities inside groups, and content types
 * in the wild add wrappers of their own. Anything shaped like a library field
 * is recorded wherever it sits.
 */
export function collectSemanticsRefs(node: unknown, trail: string[] = []): RawOption[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectSemanticsRefs(child, trail));
  }
  if (node === null || typeof node !== 'object') return [];

  const field = node as Record<string, unknown>;
  const nextTrail =
    typeof field.name === 'string' && field.name ? [...trail, field.name] : trail;
  const found: RawOption[] = [];

  if (field.type === 'library' && Array.isArray(field.options)) {
    for (const option of field.options) {
      if (typeof option !== 'string') continue;
      const parsed = parseOption(option);
      if (parsed) {
        found.push({ ...parsed, fieldPath: nextTrail.join('.') || '(root)' });
      }
    }
  }

  for (const [key, value] of Object.entries(field)) {
    if (key === 'options' && field.type === 'library') continue;
    if (value !== null && typeof value === 'object') {
      found.push(...collectSemanticsRefs(value, nextTrail));
    }
  }

  return found;
}

const DEPENDENCY_KEYS = [
  'preloadedDependencies',
  'editorDependencies',
  'dynamicDependencies',
] as const;

function readDependencyRefs(library: Record<string, unknown>, raw: string): LibraryRef[] {
  const refs: LibraryRef[] = [];

  for (const key of DEPENDENCY_KEYS) {
    const entries = library[key];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object') continue;
      const dependency = entry as Record<string, unknown>;
      const machineName = dependency.machineName;
      if (typeof machineName !== 'string') continue;

      refs.push({
        machineName,
        version: {
          major: Number(dependency.majorVersion ?? 0),
          minor: Number(dependency.minorVersion ?? 0),
        },
        kind: 'dependency',
        where: key,
        lines: findTokenOffsets(raw, `"${machineName}"`).map((offset) => lineOf(raw, offset)),
      });
    }
  }

  return refs;
}

function readSemanticsRefs(dir: string): { refs: LibraryRef[]; hasSemantics: boolean } {
  const file = path.join(dir, 'semantics.json');
  if (!fs.existsSync(file)) return { refs: [], hasSemantics: false };

  const raw = fs.readFileSync(file, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${file}: ${(error as Error).message}`);
  }

  const refs = collectSemanticsRefs(parsed).map((option): LibraryRef => ({
    machineName: option.machineName,
    version: option.version,
    kind: 'semantics',
    where: option.fieldPath,
    lines: findTokenOffsets(raw, optionToken(option.machineName, option.version)).map((offset) =>
      lineOf(raw, offset),
    ),
  }));

  return { refs, hasSemantics: true };
}

/**
 * Read every library in `librariesDir`.
 */
export function scanLibraries(librariesDir: string): ScanResult {
  if (!fs.existsSync(librariesDir)) {
    throw new Error(`Libraries directory not found: ${librariesDir}`);
  }

  const libraries: LibraryRecord[] = [];
  const problems: string[] = [];

  for (const entry of fs.readdirSync(librariesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const dir = path.join(librariesDir, entry.name);
    const libraryFile = path.join(dir, 'library.json');
    if (!fs.existsSync(libraryFile)) continue;

    try {
      const raw = fs.readFileSync(libraryFile, 'utf-8');
      const library = JSON.parse(raw) as Record<string, unknown>;
      const machineName = library.machineName;

      if (typeof machineName !== 'string' || !machineName) {
        problems.push(`${entry.name}/library.json has no machineName`);
        continue;
      }

      const semantics = readSemanticsRefs(dir);
      libraries.push({
        machineName,
        version: {
          major: Number(library.majorVersion ?? 0),
          minor: Number(library.minorVersion ?? 0),
        },
        patch: Number(library.patchVersion ?? 0),
        title: typeof library.title === 'string' ? library.title : undefined,
        dir,
        dirName: entry.name,
        hasSemantics: semantics.hasSemantics,
        refs: [...semantics.refs, ...readDependencyRefs(library, raw)],
      });
    } catch (error) {
      problems.push(`${entry.name}: ${(error as Error).message}`);
    }
  }

  libraries.sort((a, b) => a.machineName.localeCompare(b.machineName) || compareVersions(a.version, b.version));
  return { libraries, problems };
}

/**
 * The newest copy of each machine name.
 *
 * A folder can hold several versions of the same library side by side
 * (`H5P.Accordion-1.1` next to `H5P.Accordion-1.2`). Only the newest is a bump
 * candidate but all of them still count as *referrers*, so the map is built 
 * alongside, not instead of, the full list.
 */
export function latestByMachineName(libraries: LibraryRecord[]): Map<string, LibraryRecord> {
  const latest = new Map<string, LibraryRecord>();

  for (const library of libraries) {
    const current = latest.get(library.machineName);
    if (!current || compareVersions(library.version, current.version) > 0) {
      latest.set(library.machineName, library);
    }
  }

  return latest;
}
