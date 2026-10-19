import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
// @ts-ignore - no type declarations for adm-zip in this project
import admZip from 'adm-zip';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../src/logic.ts';

const REGISTRY = {
  'H5P.Foo': { id: 'H5P.Foo', title: 'Foo', shortName: 'h5p-foo', repoName: 'h5p-foo', org: 'h5p', runnable: 1 },
  'H5P.Dep': { id: 'H5P.Dep', title: 'Dep', shortName: 'h5p-dep', repoName: 'h5p-dep', org: 'h5p', runnable: 0 },
};

const writeLibrary = (machineName: string, minorVersion: number, preloadedDependencies: object[] = []) => {
  const folder = `libraries/${machineName}-1.${minorVersion}`;
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(`${folder}/library.json`, JSON.stringify({
    machineName,
    title: machineName,
    majorVersion: 1,
    minorVersion,
    patchVersion: 0,
    runnable: machineName === 'H5P.Foo' ? 1 : 0,
    preloadedDependencies,
  }));
  fs.writeFileSync(`${folder}/semantics.json`, '[]');
};

const writeContent = (folder: string, minorVersion: number) => {
  fs.mkdirSync(`content/${folder}`, { recursive: true });
  fs.writeFileSync(`content/${folder}/content.json`, '{}');
  fs.writeFileSync(`content/${folder}/h5p.json`, JSON.stringify({
    title: folder,
    mainLibrary: 'H5P.Foo',
    preloadedDependencies: [
      { machineName: 'H5P.Dep', majorVersion: 1, minorVersion },
      { machineName: 'H5P.Foo', majorVersion: 1, minorVersion },
    ],
  }));
};

const packedLibraries = (file: string): string[] => {
  const folders = new admZip(file).getEntries()
    .map((entry: any) => entry.entryName.split('/')[0])
    .filter((name: string) => name.startsWith('H5P.'));
  return [...new Set<string>(folders)].sort();
};

describe('logic.export', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    fs.mkdirSync('temp', { recursive: true });
    fs.writeFileSync('libraryRegistry.json', JSON.stringify(REGISTRY));
    writeLibrary('H5P.Dep', 0);
    writeLibrary('H5P.Dep', 1);
    writeLibrary('H5P.Foo', 0, [{ machineName: 'H5P.Dep', majorVersion: 1, minorVersion: 0 }]);
    writeLibrary('H5P.Foo', 1, [{ machineName: 'H5P.Dep', majorVersion: 1, minorVersion: 1 }]);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it.each([0, 1])('packs the libraries of the version the content was saved with (1.%i)', async (minorVersion) => {
    writeContent('my-content', minorVersion);

    const file = await logic.export('h5p-foo', 'my-content');

    expect(packedLibraries(file)).toEqual([`H5P.Dep-1.${minorVersion}`, `H5P.Foo-1.${minorVersion}`]);
  });
});
