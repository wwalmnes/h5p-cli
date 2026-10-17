import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../src/logic.ts';

const BLANKS_LIB = {
  machineName: 'H5P.Blanks',
  title: 'Fill in the Blanks',
  majorVersion: 1,
  minorVersion: 14,
  patchVersion: 0,
  runnable: 1,
};

describe('logic.parseLibraryFolders', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    fs.mkdirSync('libraries', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it('returns machineName → folder name for libraries with library.json', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({}));
    fs.mkdirSync('libraries/h5p-blanks-1.14', { recursive: true });
    fs.writeFileSync('libraries/h5p-blanks-1.14/library.json', JSON.stringify(BLANKS_LIB));

    const result = await logic.parseLibraryFolders();

    expect(result['H5P.Blanks']).toBe('h5p-blanks-1.14');
  });

  it('ignores directories without library.json', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({}));
    fs.mkdirSync('libraries/no-manifest', { recursive: true });

    const result = await logic.parseLibraryFolders();

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('registers a locally-only library and writes it to libraryRegistry.json', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({}));
    fs.mkdirSync('libraries/h5p-blanks-1.14', { recursive: true });
    fs.writeFileSync('libraries/h5p-blanks-1.14/library.json', JSON.stringify(BLANKS_LIB));

    await logic.parseLibraryFolders();

    const saved = JSON.parse(fs.readFileSync('libraryRegistry.json', 'utf-8'));
    expect(saved['H5P.Blanks']).toBeDefined();
    expect(saved['H5P.Blanks'].id).toBe('H5P.Blanks');
  });

  it('returns the highest installed version when several are installed', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({}));
    for (const minorVersion of [9, 10]) {
      fs.mkdirSync(`libraries/H5P.Blanks-1.${minorVersion}`, { recursive: true });
      fs.writeFileSync(`libraries/H5P.Blanks-1.${minorVersion}/library.json`, JSON.stringify({ ...BLANKS_LIB, minorVersion }));
    }

    const result = await logic.parseLibraryFolders();

    expect(result['H5P.Blanks']).toBe('H5P.Blanks-1.10');
  });
});

describe('logic.parseLibraryVersions', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    fs.mkdirSync('libraries', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it('returns every installed version of a library by major.minor', async () => {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify({}));
    for (const minorVersion of [0, 1]) {
      fs.mkdirSync(`libraries/H5P.Blanks-1.${minorVersion}`, { recursive: true });
      fs.writeFileSync(`libraries/H5P.Blanks-1.${minorVersion}/library.json`, JSON.stringify({ ...BLANKS_LIB, minorVersion }));
    }

    const result = await logic.parseLibraryVersions();

    expect(result['H5P.Blanks']).toEqual({ '1.0': 'H5P.Blanks-1.0', '1.1': 'H5P.Blanks-1.1' });
  });
});
