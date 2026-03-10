import h5p from '../h5p';
import { getLibraryData } from '../utility/repository';
import * as output from '../utility/output';
import Input from '../utility/input';

const c = output.color;

interface DirectoryData {
  dirName: string;
  libData: any;
}

function printDependencies(totalDependencies: number): void {
  if (totalDependencies > 0) {
    output.printLn(`Adding ${c.emphasize + totalDependencies + c.default} ` +
      (totalDependencies === 1 ? 'dependency' : 'dependencies') +
      ` to ${c.emphasize}file${c.default}...`);
  }
}

function printLibsPacked(libs: string[]): void {
  output.printLn(`Packing ${c.emphasize + libs.length + c.default} ` +
    (libs.length === 1 ? 'library' : 'libraries') +
    ` to ${c.emphasize}file${c.default}...`);
}

function recursivelyGetDependencies(libraries: string[]): Promise<string[]> {
  return h5p.findDirectories()
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

function pack(...inputList: string[]): Promise<void> {
  const input = new Input(inputList);
  const file = input.getFileName();
  return input.init(true)
    .then(() => {
      const libraries = input.getLibraries();

      if (!libraries.length) {
        output.printLn('You must specify libraries');
        return;
      }

      printLibsPacked(libraries);

      if (input.hasFlag('-r')) {
        return recursivelyGetDependencies(libraries)
          .then(libsToPack => {
            printDependencies(libsToPack.length - libraries.length);
            return h5p.pack(libsToPack, file);
          });
      }
      else {
        return h5p.pack(libraries, file);
      }
    });
}

export default pack;
