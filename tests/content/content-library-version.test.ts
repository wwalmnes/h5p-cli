import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../src/logic.ts';

const VERSIONS = {
  'H5P.Foo': { '1.7': 'H5P.Foo-1.7', '1.8': 'H5P.Foo-1.8' },
};

const writeContent = (folder: string, minorVersion: number) => {
  fs.mkdirSync(`content/${folder}`, { recursive: true });
  fs.writeFileSync(`content/${folder}/h5p.json`, JSON.stringify({
    title: folder,
    mainLibrary: 'H5P.Foo',
    preloadedDependencies: [{ machineName: 'H5P.Foo', majorVersion: 1, minorVersion }],
  }));
};

describe('logic.contentLibraryVersion', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
  });

  it('runs the content on the version it was saved with when that one is installed', () => {
    writeContent('my-content', 7);

    expect(logic.contentLibraryVersion('my-content', 'H5P.Foo', VERSIONS)).toEqual({
      saved: '1.7',
      running: '1.7',
      folder: 'H5P.Foo-1.7',
    });
  });

  it('reports the version it falls back to when the saved one is not installed', () => {
    writeContent('my-content', 6);

    expect(logic.contentLibraryVersion('my-content', 'H5P.Foo', VERSIONS)).toEqual({
      saved: '1.6',
      running: '1.8',
      folder: 'H5P.Foo-1.8',
    });
  });

  it('reports no running version when the library is not installed at all', () => {
    writeContent('my-content', 7);

    expect(logic.contentLibraryVersion('my-content', 'H5P.Foo', {})).toEqual({
      saved: '1.7',
      running: undefined,
      folder: undefined,
    });
  });
});
