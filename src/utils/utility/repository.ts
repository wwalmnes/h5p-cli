import fs from 'fs';
import child from 'child_process';
import type { LibraryDependency } from '../../lib/library-types.ts';
import type { RepoOpResult } from '../../lib/repo-types.ts';

const env = process.env;

export type RepoStatus = RepoOpResult;

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
 * Find status lines for the given repo.
 * @param repo Repository name
 */
export const statusRepository = function (repo: string): Promise<RepoStatus> {
  const status: RepoStatus = {
    name: repo
  };

  return new Promise((resolve, reject) => {
    const proc =
      child.spawn('git', ['status', '--porcelain', '--branch'],
        {
          cwd: process.cwd() + '/' + repo,
          env: env
        });

    proc.on('error', function (error) {
      status.error = String(error);
      reject(status);
    });

    let buffer = '';
    proc.stdout.on('data', function (data) {
      buffer += data.toString();
    });

    proc.stdout.on('end', function () {
      const lines = buffer.split('\n');
      lines.pop(); // Empty

      status.branch = lines.shift()!.split('## ')[1];
      if (lines.length) {
        status.changes = lines;
      }

      resolve(status);
    });
  });
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
