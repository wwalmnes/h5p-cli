import { fromTemplate, parseGitUrl, pathHasDuplicates, parseSemanticLibraries } from './h5p-utils';
import type { ParsedGitUrl } from './h5p-utils';

export interface LibraryVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface LibraryDependencyRef {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
}

export interface LibraryEntry {
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
  version?: LibraryVersion;
  preloadedJs?: Array<{ path: string }>;
  preloadedCss?: Array<{ path: string }>;
  preloadedDependencies?: LibraryDependencyRef[];
  editorDependencies?: LibraryDependencyRef[];
  metadataSettings?: any;
  level?: number;
}

export interface Registry {
  regular: Record<string, LibraryEntry>;
  reversed: Record<string, LibraryEntry>;
}

export type DependencyMap = Record<string, LibraryEntry>;

export interface IComputeDependenciesPort {
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
}

const _log = (message: string) => {
  if (process.argv[2] !== 'server') console.log(message);
};
const _write = (message: string) => {
  if (process.argv[2] !== 'server') process.stdout.write(message);
};

export async function computeDependencies(
  library: string,
  mode: 'view' | 'edit',
  version: string | null | undefined,
  folder: string | undefined,
  io: IComputeDependenciesPort
): Promise<DependencyMap> {
  _log(`> ${library} deps ${mode}`);
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
    for (let item of tags) {
      if (item.indexOf(version) != 0) {
        continue;
      }
      const numbers = item.split('.');
      if (numbers.length < 3) {
        continue;
      }
      if (parseInt(numbers[2]) > patch) {
        patch = parseInt(numbers[2]);
        break;
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
      const parentVersion = `${done[level][parent].version.major}.${done[level][parent].version.minor}.${done[level][parent].version.patch}`;
      process.stdout.write(`\n!!! ${optional ? 'optional' : 'required'} library ${machineName} ${ver} not found in registry; required by ${parent} (${parentVersion}) `);
      return;
    }
    const version = ver == 'master' ? ver : latestPatch(lib.org, entry, ver);
    if (!done[level][entry]?.id && !toDo[entry]?.parent) {
      toDo[entry] = { parent, version, folder: dir };
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
    const finder = (element: LibraryDependencyRef) => element.machineName === machineName;
    if (parent?.preloadedDependencies?.find(finder) !== undefined || parent?.editorDependencies?.find(finder) !== undefined) {
      return false;
    }
    return true;
  }
  const compute = async (org: string, dep: string, version: string) => {
    const parent = toDo[dep].parent ? `/${toDo[dep].parent}` : '';
    const lastParent = registry.regular[toDo[dep].parent]?.requiredBy[registry.regular[toDo[dep].parent]?.requiredBy.length - 1] || '';
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
    _write(`>> ${dep} required by ${toDo[dep].parent} (${done[level][dep].optional ? 'optional' : 'required'}) ... `);
    done[level][dep].preloadedJs = list.preloadedJs || [];
    done[level][dep].preloadedCss = list.preloadedCss || [];
    done[level][dep].preloadedDependencies = list.preloadedDependencies || [];
    done[level][dep].editorDependencies = list.editorDependencies || [];
    done[level][dep].metadataSettings = list.metadataSettings;
    if (!done[level][dep].requiredBy) {
      done[level][dep].requiredBy = [];
    }
    done[level][dep].requiredBy.push(requiredByPath);
    done[level][dep].level = level;
    let ver = version == 'master' ? version : `${done[level][dep].version.major}.${done[level][dep].version.minor}.${done[level][dep].version.patch}`;
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
    _log('done');
  }
  registry = await io.getRegistry();
  if (!folder && !registry.regular[library]) {
    throw new Error(`unregistered ${library} library`);
  }
  while (Object.keys(toDo).length) {
    level++;
    _log(`>> on level ${level}`);
    done[level] = {};
    for (let item in toDo) {
      await compute(registry.regular[item].org, item, toDo[item].version);
    }
  }
  let output: DependencyMap = {};
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
  _write('\n');
  return output;
}
