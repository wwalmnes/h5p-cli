import type { SemVer } from './dependencies/version.ts';

/**
 * A reference from one library to another, as written in a `library.json`
 * `preloadedDependencies` / `editorDependencies` array.
 */
export type LibraryDependency = {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
};

/** One library as it appears in the H5P library registry. */
export type LibraryEntry = {
  id: string;
  title: string;
  author?: string;
  runnable?: number;
  fullscreen?: number;
  shortName: string;
  repoName: string;
  org: string;
  parent?: string;
  repo?: { type: string; url: string };
  requiredBy?: string[];
  optional?: boolean;
  // version is added by computeDependencies, not present in raw registry
  version?: SemVer;
  preloadedJs?: Array<{ path: string }>;
  preloadedCss?: Array<{ path: string }>;
  preloadedDependencies?: LibraryDependency[];
  editorDependencies?: LibraryDependency[];
  metadataSettings?: any;
  level?: number;
};

/** The library registry, keyed by machine name (`regular`) and by short name (`reversed`). */
export type Registry = {
  regular: Record<string, LibraryEntry>;
  reversed: Record<string, LibraryEntry>;
  runnable?: Record<string, LibraryEntry>;
};

export type DependencyMap = Record<string, LibraryEntry>;
