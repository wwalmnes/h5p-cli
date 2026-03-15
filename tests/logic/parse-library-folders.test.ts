import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { createEmptyProject, type Fixture } from '../helpers/fixture';
import logic from '../../logic';

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
    vi.spyOn(console, 'log').mockImplementation(() => {});
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
});
