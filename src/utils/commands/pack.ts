import fs from 'fs';
import archiver from 'archiver';
import { getLibraryData } from '../utility/repository.ts';
import { ui } from '../../lib/ui.ts';
import { splitLibrariesAndLanguages } from '../../lib/resolve-libraries.ts';
import { findRepos } from '../../lib/process-repos.ts';
import { archiveDir } from '../../lib/archive-utils.ts';

/** `repos` is already resolved against the filesystem by the caller. */
function packLibraries(repos: string[], file: string): Promise<void> {
  const targets = repos.map(repo => {
    try {
      const lib = JSON.parse(fs.readFileSync(`${repo}/library.json`, 'utf-8'));
      return { path: repo, target: `${lib.machineName}-${lib.majorVersion}.${lib.minorVersion}` };
    } catch {
      return { path: repo, target: repo };
    }
  });

  return new Promise((resolve, reject) => {
    const output_ = fs.createWriteStream(file);
    const archive = archiver('zip');
    archive.on('error', reject);
    output_.on('close', resolve);
    archive.pipe(output_);
    for (const { path: p, target: t } of targets) {
      archiveDir(archive, p, t);
    }
    archive.finalize();
  });
}

type DirectoryData = {
  dirName: string;
  libData: any;
};

function printDependencies(totalDependencies: number, file: string): void {
  if (totalDependencies > 0) {
    ui.info(`Adding ${totalDependencies} ` +
      (totalDependencies === 1 ? 'dependency' : 'dependencies') +
      ` to ${file}...`);
  }
}

function printLibsPacked(libs: string[], file: string): void {
  ui.info(`Packing ${libs.length} ` +
    (libs.length === 1 ? 'library' : 'libraries') +
    ` to ${file}...`);
}

function recursivelyGetDependencies(libraries: string[]): Promise<string[]> {
  return findRepos()
    .then(getLibraryDataForDirs)
    .then((dirData: DirectoryData[]) => getLibraryDependencies(dirData, libraries));
}

function getLibraryDataForDirs(dirs: string[]): DirectoryData[] {
  return dirs
    .map(lib => {
      return {
        dirName: lib,
        libData: getLibraryData(lib)
      };
    });
}

function getLibraryDependencies(directoryData: DirectoryData[], libraries: string[]): string[] {
  const repoCollection: string[] = [];
  libraries
    .forEach(lib => {
      const dirData = directoryData.find(dir => dir.dirName === lib);
      if (dirData && repoCollection.indexOf(dirData.dirName) < 0) {
        recursivelyAddToCollection(repoCollection, dirData, directoryData);
      }
      else if (!dirData || repoCollection.indexOf(dirData.dirName) < 0) {
        repoCollection.push(lib);
      }
    });
  return repoCollection;
}

function getLibraryDependency(library: DirectoryData): any[] {
  const preloadedDeps = library.libData.preloadedDependencies || [];
  const editorDeps = library.libData.editorDependencies || [];
  return preloadedDeps.concat(editorDeps);
}

function recursivelyAddToCollection(repoCollection: string[], dirData: DirectoryData, directories: DirectoryData[]): void {
  repoCollection.push(dirData.dirName);

  getLibraryDependency(dirData)
    .forEach((dep: any) => {
      const dir = findLibraryInDirectory(dep, directories);
      if (dir && repoCollection.indexOf(dir.dirName) < 0) {
        recursivelyAddToCollection(repoCollection, dir, directories);
      }
    });
}

function findLibraryInDirectory(libVersion: any, directories: DirectoryData[]): DirectoryData | undefined {
  return directories.find(dir =>
      dir.libData.machineName === libVersion.machineName &&
      dir.libData.majorVersion === libVersion.majorVersion &&
      dir.libData.minorVersion === libVersion.minorVersion
  );
}

export type PackOptions = {
  recursive?: boolean;
  file?: string;
};

export const defaultPackFile = (): string =>
  process.env.H5P_DEFAULT_PACK || 'libraries.h5p';

async function pack(names: string[], options: PackOptions = {}): Promise<void> {
  const file = options.file || defaultPackFile();
  const { libraries } = splitLibrariesAndLanguages(names, fs.readdirSync('.'));

  if (!libraries.length) {
    ui.warn('You must specify libraries');
    return;
  }

  printLibsPacked(libraries, file);

  if (options.recursive) {
    const libsToPack = await recursivelyGetDependencies(libraries);
    printDependencies(libsToPack.length - libraries.length, file);
    return packLibraries(libsToPack, file);
  }

  return packLibraries(libraries, file);
}

export default pack;
