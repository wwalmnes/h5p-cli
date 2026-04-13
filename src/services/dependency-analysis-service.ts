import fs from 'fs';
import { findRepos } from '../lib/process-repos.ts';
import { parseSemanticLibraries } from '../lib/h5p-utils.ts';

interface LibraryNode {
  library: { name: string; version: string };
  deps: LibraryNode[];
}

export class DependencyAnalysisService {
  async findInconsistencies(): Promise<void> {
    const libraries: Record<string, LibraryNode> = {};

    const addDependency = (library: any, dependency: any) => {
      const libId = `${library.machineName}-${library.majorVersion}.${library.minorVersion}`;
      const depId = `${dependency.machineName}-${dependency.majorVersion}.${dependency.minorVersion}`;

      if (!libraries[libId]) {
        libraries[libId] = {
          library: { name: library.machineName, version: `${library.majorVersion}.${library.minorVersion}` },
          deps: [],
        };
      }
      if (!libraries[depId]) {
        libraries[depId] = {
          library: { name: dependency.machineName, version: `${dependency.majorVersion}.${dependency.minorVersion}` },
          deps: [],
        };
      }

      libraries[libId].deps.push(libraries[depId]);
    };

    const repos = await findRepos();
    await Promise.all(repos.map(async (repo) => {
      let library: any;
      try {
        library = JSON.parse(fs.readFileSync(`${repo}/library.json`).toString());
      } catch {
        return;
      }

      for (const dep of (library.preloadedDependencies ?? [])) {
        addDependency(library, dep);
      }
      for (const dep of (library.editorDependencies ?? [])) {
        addDependency(library, dep);
      }

      try {
        const semantics = JSON.parse(fs.readFileSync(`${repo}/semantics.json`).toString());
        const semLibs = parseSemanticLibraries(semantics);
        for (const dep of Object.values(semLibs)) {
          const [majorVersion, minorVersion] = dep.version.split('.');
          addDependency(library, {
            machineName: dep.name,
            majorVersion: majorVersion,
            minorVersion: minorVersion,
          });
        }
      } catch { /* no semantics — skip */ }
    }));

    findDuplicatesWithDifferentVersions(libraries);
  }
}

function flattenDependencyTree(
  libraryId: string,
  dependencies: LibraryNode[],
  flat: Record<string, Record<string, string[]>>
): void {
  for (const dep of dependencies) {
    if (!flat[libraryId][dep.library.name]) {
      flat[libraryId][dep.library.name] = [];
    }
    if (flat[libraryId][dep.library.name].includes(dep.library.version)) continue;
    flat[libraryId][dep.library.name].push(dep.library.version);
    if (dep.deps) flattenDependencyTree(libraryId, dep.deps, flat);
  }
}

function findDuplicatesWithDifferentVersions(
  libraries: Record<string, LibraryNode>
): void {
  const flat: Record<string, Record<string, string[]>> = {};

  for (const libraryId in libraries) {
    flat[libraryId] = {};
    flattenDependencyTree(libraryId, libraries[libraryId].deps, flat);
  }

  for (const libraryId in flat) {
    for (const dep in flat[libraryId]) {
      if (flat[libraryId][dep].length > 1) {
        const versions = flat[libraryId][dep].join(', ');
        console.log(`Inconsistency detected for ${libraryId} -> ${dep} (versions: ${versions})`);
      }
    }
  }
}
