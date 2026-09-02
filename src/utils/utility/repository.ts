import fs from 'fs';
import type { LibraryDependency } from '../../lib/library-types.ts';

export type { LibraryDependency };

export type LibraryJson = {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  runnable: number;
  title?: string;
  preloadedDependencies?: LibraryDependency[];
  editorDependencies?: LibraryDependency[];
};

/**
 * Read json file and parse it
 * @param repo Directory of file
 * @param fileName Name of file
 * @returns Parsed JSON file
 */
export const readJson = function (repo: string, fileName: string): any {
  try {
    const jsonFile = fs.readFileSync(repo + fileName);
    return JSON.parse(jsonFile.toString());
  }
  catch (err: any) {
    let errorMessage: any = err;
    if (err.toString().indexOf('no such file or directory') !== -1 || err.toString().indexOf('not a directory') !== -1) {
      errorMessage = 'not a library';
    }
    return errorMessage;
  }
};

/**
 * Get library data from library.json file in H5P library
 * @param repo Directory of library.json
 * @returns Parsed JSON data
 */
export const getLibraryData = function (repo: string): any {
  return readJson(repo, '/library.json');
};

/**
 * Get translation object of given language
 * @param repo Directory of library
 * @param languageCode Language code of translation
 * @returns Parsed JSON data
 */
export const getLanguageData = function (repo: string, languageCode: string): any {
  return readJson(repo, `/language/${languageCode}.json`);
};

export const isEditorLibrary = function (libraryJson: LibraryJson): boolean {
  const machineName = libraryJson.machineName;
  return (machineName.startsWith('H5PEditor') || machineName === 'H5P.DragNBar') &&
         libraryJson.runnable === 0;
};
