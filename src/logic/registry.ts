import fs from 'fs';
import config from '../../configLoader.ts';
import { parseGitUrl, machineToShort, normalizeRegistry } from '../lib/h5p-utils.ts';
import type { ParsedGitUrl } from '../lib/h5p-utils.ts';
import type { LibraryEntry, Registry } from '../lib/compute-dependencies.ts';
import { ui } from '../lib/ui.ts';
import { getFile } from './files.ts';
import { getRepoFile, _refreshClone } from './repo.ts';

/** Map from machineName (or folder key) to folder name string */
export type LibraryFolderMap = Record<string, string>;

// Cache registry, but as a promise because often multiple fetches are done, so we want
// to cache the promise so we only do one fetch.
let _registryMemo: Promise<string | object> | undefined;

/* retrieves list of h5p librarie
ignoreFile - if true file is overwritten with online data */
export const getRegistry = async (ignoreFile?: boolean): Promise<Registry> => {
  let list;
  if (!ignoreFile && fs.existsSync(config.registry)) {
    list = JSON.parse(fs.readFileSync(config.registry, 'utf-8'));
  }
  else {
    _registryMemo ??= getFile(config.urls.registry, true) as Promise<any>;
    _registryMemo.catch(() => { _registryMemo = undefined; });
    list = structuredClone(await _registryMemo);
  }
  const output = normalizeRegistry(list) as Registry;
  if (ignoreFile) {
    fs.writeFileSync(config.registry, JSON.stringify(list));
  }
  return output;
};

export const parseLibraryFolders = async (): Promise<LibraryFolderMap> => {
  const registry = await getRegistry();
  const output: LibraryFolderMap = {};
  const dirs = fs.readdirSync(config.folders.libraries);
  for (let folder of dirs) {
    const libraryFile = `${config.folders.libraries}/${folder}/library.json`;
    if (!fs.existsSync(libraryFile)) {
      continue;
    }
    const info = (await getFile(libraryFile, true)) as any;
    const id = info.machineName;
    output[id] = folder;
    if (!registry.reversed[id]) {
      registry.reversed[id] = {
        id: id,
        title: info.title,
        author: info.author,
        runnable: info.runnable,
        shortName: machineToShort(id),
        org: '',
        repoName: '',
      };
      fs.writeFileSync(config.registry, JSON.stringify(registry.reversed));
      ui.info(`registered local library ${id}`);
    }
  }
  return output;
};

export const registryEntryFromRepoUrl = (
  gitUrl: string,
): Record<string, LibraryEntry> => {
  const { host, org, repoName } = parseGitUrl(gitUrl) as ParsedGitUrl;
  // no raw fallback on this path, and the result is written into the
  // registry, so a stale checkout here outlives the invocation
  _refreshClone(repoName, 'master');
  const list = getRepoFile(gitUrl, 'library.json', 'master', true) as any;
  const shortName = machineToShort(list.machineName);
  const type = host.split('.')[0];
  const output: Record<string, LibraryEntry> = {};
  output[list.machineName] = {
    id: list.machineName,
    title: list.title,
    repo: {
      type: type,
      url: `https://${host}/${org}/${repoName}`,
    },
    author: list.author,
    runnable: list.runnable,
    shortName,
    repoName,
    org,
  };
  return output;
};
