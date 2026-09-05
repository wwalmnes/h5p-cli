import { ui } from './ui.ts';
import { fromTemplate, parseGitUrl, pathHasDuplicates, parseSemanticLibraries } from './h5p-utils.ts';
import type { ParsedGitUrl } from './h5p-utils.ts';
import type { LibraryDependency, LibraryEntry, Registry, DependencyMap } from './library-types.ts';

// Library shapes live in ./library-types.ts so that h5p-utils.ts can use them
// without importing this module back. Re-exported here to keep the public
// `h5p-cli/compute-dependencies` subpath intact.
export type {
  LibraryDependency,
  LibraryEntry,
  Registry,
  DependencyMap,
} from './library-types.ts';

export type IComputeDependenciesPort = {
  getRegistry(): Promise<Registry>;
  parseLibraryFolders(): Promise<Record<string, string>>;
  getLibraryJson(
    folder: string | null | undefined,
    org: string,
    repoName: string,
    version: string
  ): Promise<any>;
  getSemanticsJson(
    folder: string | null | undefined,
    org: string,
    repoName: string,
    version: string
  ): Promise<any>;
  getTags(org: string, repo: string): string[];
};

export async function computeDependencies(
  library: string,
  mode: 'view' | 'edit',
  version: string | null | undefined,
  folder: string | undefined,
  io: IComputeDependenciesPort
): Promise<DependencyMap> {
  ui.info(`calculating dependencies for ${library} (${mode})`);
  /* per-dependency detail matters while it happens, not afterwards: it shares
  one self-overwriting line and collapses into a single summary at the end */
  const statusId = `deps:${library}:${mode}`;
  version = version || 'master';
  let level = -1;
  let registry: Registry = { regular: {}, reversed: {} };
  const toDo: Record<string, { parent: string; version: string; folder: string | undefined }> = {};
  const cache: Record<string, any> = {};
  const done: Record<number, DependencyMap> = {};
  const weights: Record<string, number> = {};
  toDo[library] = {
    parent: '',
    version,
    folder
  };
  const libraryDirs = await io.parseLibraryFolders();
  const getOptionals = async (dep: string, org: string, repoName: string, version: string, dir: string | null | undefined) => {
    if (cache[dep].optionals) {
      return cache[dep].optionals;
    }
    cache[dep].semantics = await io.getSemanticsJson(dir, org, repoName, version);
    cache[dep].optionals = parseSemanticLibraries(cache[dep].semantics);
    return cache[dep].optionals;
  }

  const latestPatch = (org: string, repo: string, version: string) => {
    const tags = io.getTags(org, repo);
    let patch = -1;
    for (const item of tags) {
      if (!item.startsWith(`${version}.`)) {
        continue;
      }
      const numbers = item.split('.');
      if (numbers.length < 3) {
        continue;
      }
      const candidate = parseInt(numbers[2]);
      if (Number.isFinite(candidate) && candidate > patch) {
        patch = candidate;
      }
    }
    return patch > -1 ? `${version}.${patch}` : version;
  }
  // determine if dependency needs to be processed
  const handleDepListEntry = (machineName: string, parent: string, ver: string, dir: string | null | undefined) => {
    const lib = registry.reversed[machineName];
    const entry = lib?.shortName;
    if (!entry) {
      const optional = isOptional(cache[parent], machineName);
      if (!done[level][machineName] || done[level][machineName].optional) {
        done[level][machineName] = { optional, parent } as any as LibraryEntry;
      }
      const parentVersion = `${done[level][parent].version!.major}.${done[level][parent].version!.minor}.${done[level][parent].version!.patch}`;
      ui.warn(`${optional ? 'optional' : 'required'} library ${machineName} ${ver} not found in registry; required by ${parent} (${parentVersion})`);
      return;
    }
    const version = ver == 'master' ? ver : latestPatch(lib.org, entry, ver);
    if (!done[level][entry]?.id && !toDo[entry]?.parent) {
      toDo[entry] = { parent, version, folder: dir ?? undefined };
    }
    weights[entry] = weights[entry] ? weights[entry] + 1 : 1;
    return;
  }
  // determine if a library is a soft dependency of its parent
  const isOptional = (parent: LibraryEntry | undefined, machineName: string) => {
    if (!parent) {
      return false;
    }
    if (parent && parent.optional) {
      return true;
    }
    const finder = (element: LibraryDependency) => element.machineName === machineName;
    if (parent?.preloadedDependencies?.find(finder) !== undefined || parent?.editorDependencies?.find(finder) !== undefined) {
      return false;
    }
    return true;
  }
  /* Warm `cache` for a whole frontier at once.

  `compute` below mutates shared state — done/toDo/weights and the requiredBy
  paths on the registry entries — so it has to keep running one library at a
  time. Its two network reads do not: resolving a content type reads
  library.json and semantics.json for dozens of repos, and doing that strictly
  in series made the resolve a chain of ~2N round trips. Fetching the frontier
  together turns each wave into roughly one.

  Deliberately best-effort. Anything that goes wrong here is swallowed and the
  entry left uncached, so `compute` makes the same call itself and fails in the
  exact place it always did — error messages, and the order they arrive in, are
  unchanged. It may also prefetch a library that `compute` then prunes as a
  repeat path; that costs a cache fill, not correctness. */
  const prefetch = async (deps: string[]): Promise<void> => {
    await Promise.all(deps.map(async dep => {
      if (cache[dep] || !registry.regular[dep]) {
        return;
      }
      const entry = registry.regular[dep];
      const { repoName } = entry.repo?.url ? parseGitUrl(entry.repo.url) as ParsedGitUrl : { repoName: dep };
      const dir = toDo[dep].folder;
      const version = toDo[dep].version;
      try {
        const list = await io.getLibraryJson(dir, entry.org, repoName, version);
        // leave the "missing library.json" throw to compute(), which words it
        if (!list?.title) {
          return;
        }
        cache[dep] = list;
        // same version string compute() derives before it asks for semantics
        const ver = version == 'master'
          ? version
          : `${list.majorVersion}.${list.minorVersion}.${list.patchVersion}`;
        cache[dep].semantics = await io.getSemanticsJson(dir, entry.org, repoName, ver);
        cache[dep].optionals = parseSemanticLibraries(cache[dep].semantics);
      }
      catch {
        delete cache[dep];
      }
    }));
  }
  const compute = async (org: string, dep: string, version: string) => {
    const parent = toDo[dep].parent ? `/${toDo[dep].parent}` : '';
    const lastParent = registry.regular[toDo[dep].parent]?.requiredBy?.[registry.regular[toDo[dep].parent]?.requiredBy?.length ?? 0 - 1] ?? '';
    const requiredByPath = lastParent + parent;
    if (pathHasDuplicates(requiredByPath)) {
      delete toDo[dep];
      return;
    }
    if (registry.regular[dep].requiredBy && registry.regular[dep].requiredBy.includes(requiredByPath)) {
      delete toDo[dep];
      return;
    }
    done[level][dep] = registry.regular[dep];
    let list;
    const { repoName } = registry.regular[dep]?.repo?.url ? parseGitUrl(registry.regular[dep].repo.url) as ParsedGitUrl : { repoName: dep };
    if (cache[dep]) {
      list = cache[dep];
    }
    else {
      list = await io.getLibraryJson(toDo[dep].folder, org, repoName, version);
      cache[dep] = list;
    }
    if (!list.title) {
      throw new Error(`missing library.json for ${toDo[dep].folder || dep}`);
    }
    done[level][dep].title = list.title;
    done[level][dep].version = {
      major: list.majorVersion,
      minor: list.minorVersion,
      patch: list.patchVersion
    }
    done[level][dep].runnable = list.runnable;
    done[level][dep].fullscreen = list.fullscreen;
    done[level][dep].optional = registry.regular[dep].optional === false ? false : isOptional(cache[toDo[dep].parent], list.machineName);
    cache[dep].optional = done[level][dep].optional;
    const summary = `${dep} required by ${toDo[dep].parent} (${done[level][dep].optional ? 'optional' : 'required'})`;
    done[level][dep].preloadedJs = list.preloadedJs || [];
    done[level][dep].preloadedCss = list.preloadedCss || [];
    done[level][dep].preloadedDependencies = list.preloadedDependencies || [];
    done[level][dep].editorDependencies = list.editorDependencies || [];
    done[level][dep].metadataSettings = list.metadataSettings;
    if (!done[level][dep].requiredBy) {
      done[level][dep].requiredBy = [];
    }
    done[level][dep].requiredBy!.push(requiredByPath);
    done[level][dep].level = level;
    let ver = version == 'master' ? version : `${done[level][dep].version!.major}.${done[level][dep].version!.minor}.${done[level][dep].version!.patch}`;
    const optionals = await getOptionals(dep, org, repoName, ver, toDo[dep].folder);
    if (list.preloadedDependencies) {
      for (let item of list.preloadedDependencies) {
        ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
        const dir = folder ? libraryDirs[item.machineName] : null;
        handleDepListEntry(item.machineName, dep, ver, dir);
      }
    }
    for (let item in optionals) {
      ver = version == 'master' ? version : optionals[item].version;
      const dir = folder ? libraryDirs[item] : null;
      handleDepListEntry(item, dep, ver, dir);
    }
    if (mode == 'edit' && list.editorDependencies) {
      for (let item of list.editorDependencies) {
        ver = version == 'master' ? version : `${item.majorVersion}.${item.minorVersion}`;
        const dir = folder ? libraryDirs[item.machineName] : null;
        handleDepListEntry(item.machineName, dep, ver, dir);
      }
    }
    delete toDo[dep];
    ui.status(statusId, summary);
  }
  registry = await io.getRegistry();
  if (!folder && !registry.regular[library]) {
    throw new Error(`unregistered ${library} library`);
  }
  /* The root's version arrives as the user typed it, and `h5p setup <lib> 1.1`
  is the documented way to ask for a version. A bare major.minor is not a ref —
  h5p-blanks publishes 1.1.5 and 1.1.1, never 1.1 — so it has to go through the
  same patch lookup handleDepListEntry already applies to every child. Without
  it the very first metadata fetch asks for a ref that does not exist, the raw
  host 404s, the clone fallback reports "Remote branch 1.1 not found" and the
  whole versioned path is unreachable. */
  if (!folder && /^\d+\.\d+$/.test(toDo[library].version)) {
    toDo[library].version = latestPatch(registry.regular[library].org, library, toDo[library].version);
  }
  let output: DependencyMap = {};
  try {
    while (Object.keys(toDo).length) {
      level++;
      ui.status(statusId, `on level ${level}`);
      done[level] = {};
      /* Snapshot only for the prefetch list. The for...in below keeps its
      original semantics, so anything compute() enqueues mid-sweep behaves
      exactly as before — it just misses this wave's warm-up and fetches
      itself. */
      const frontier = Object.keys(toDo);
      ui.debug(`level ${level}: ${frontier.length} librar${frontier.length === 1 ? 'y' : 'ies'}`);
      await prefetch(frontier);
      for (let item in toDo) {
        await compute(registry.regular[item].org, item, toDo[item].version);
      }
    }
    for (let i = level; i >= 0; i--) {
      const keys = Object.keys(done[i]);
      keys.sort((a, b) => {
        return weights[b] - weights[a];
      });
      for (let key of keys) {
        if (!output[key] || output[key]?.optional) {
          output[key] = done[i][key];
        }
        if (!done[i][key].id) {
          continue;
        }
      }
    }
  }
  finally {
    // compute() can throw mid-resolve; never leave the line on screen
    ui.statusDone(statusId);
  }
  const resolved = Object.keys(output).length;
  ui.info(`resolved ${resolved} ${resolved === 1 ? 'dependency' : 'dependencies'} for ${library}`);
  return output;
}
