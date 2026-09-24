import config from '../../configLoader.ts';
import { computeDependencies as _computeDependencies } from '../lib/compute-dependencies.ts';
import type { IComputeDependenciesPort, DependencyMap } from '../lib/compute-dependencies.ts';
import { getFile } from './files.ts';
import { getMetadataFile } from './metadata.ts';
import { getRegistry, parseLibraryFolders } from './registry.ts';
import { tags } from './repo.ts';

class DefaultComputeDependenciesPort implements IComputeDependenciesPort {
  getRegistry() { return getRegistry(); }
  parseLibraryFolders() { return parseLibraryFolders(); }
  getLibraryJson(folder: string | null | undefined, org: string, repoName: string, version: string) {
    if (folder) return getFile(`${config.folders.libraries}/${folder}/library.json`, true) as Promise<any>;
    return getMetadataFile(org, repoName, version, 'library.json');
  }
  getSemanticsJson(folder: string | null | undefined, org: string, repoName: string, version: string) {
    if (folder) return getFile(`${config.folders.libraries}/${folder}/semantics.json`, true) as Promise<any>;
    return getMetadataFile(org, repoName, version, 'semantics.json');
  }
  getTags(org: string, repo: string) { return tags(org, repo); }
}

/* computes list of library dependencies in their correct load order
mode - 'view' or 'edit' to compute non-editor or editor dependencies
version - optional version to compute; defaults to 'master'
folder - optional local library folder to use instead of git repo; use "" to ignore */
export const computeDependencies = (library: string, mode?: 'view' | 'edit', version?: string | null, folder?: string): Promise<DependencyMap> => {
  return _computeDependencies(library, mode ?? 'view', version, folder, new DefaultComputeDependenciesPort());
};
