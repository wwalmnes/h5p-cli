import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

// Registry file: keyed by machineName (arbitrary key); what matters are id and shortName fields.
const REGISTRY_DATA = {
  'H5P.Blanks': {
    id: 'H5P.Blanks',
    shortName: 'h5p-blanks',
    org: 'h5p',
    repoName: 'h5p-blanks',
  },
  'H5P.JoubelUI': {
    id: 'H5P.JoubelUI',
    shortName: 'h5p-joubel-ui',
    org: 'h5p',
    repoName: 'h5p-joubel-ui',
  },
};

const BLANKS_LIBRARY_JSON = {
  machineName: 'H5P.Blanks',
  title: 'Fill in the Blanks',
  majorVersion: 1,
  minorVersion: 14,
  patchVersion: 0,
  runnable: 1,
  preloadedDependencies: [
    { machineName: 'H5P.JoubelUI', majorVersion: 3, minorVersion: 3 },
  ],
};

const JOUBEL_LIBRARY_JSON = {
  machineName: 'H5P.JoubelUI',
  title: 'Joubel UI',
  majorVersion: 3,
  minorVersion: 3,
  patchVersion: 0,
  runnable: 0,
};

describe('logic.computeDependencies', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    fs.mkdirSync('libraries', { recursive: true });
    fs.mkdirSync('temp', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  function setupRegistry(data = REGISTRY_DATA) {
    fs.writeFileSync('libraryRegistry.json', JSON.stringify(data));
  }

  function setupTempDir(repoName: string, libraryJson: object, semanticsJson: unknown = []) {
    const dir = `temp/${repoName}_master`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/library.json`, JSON.stringify(libraryJson));
    fs.writeFileSync(`${dir}/semantics.json`, JSON.stringify(semanticsJson));
  }

  it('library with no deps returns a result containing only that library with an id', async () => {
    setupRegistry({ 'H5P.JoubelUI': REGISTRY_DATA['H5P.JoubelUI'] });
    setupTempDir('h5p-joubel-ui', JOUBEL_LIBRARY_JSON);

    const result = await logic.computeDependencies('h5p-joubel-ui', 'view');

    expect(result['h5p-joubel-ui']).toBeDefined();
    expect(result['h5p-joubel-ui'].id).toBe('H5P.JoubelUI');
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('library with one registered preloaded dep returns both; dep comes before parent in output', async () => {
    setupRegistry();
    setupTempDir('h5p-blanks', BLANKS_LIBRARY_JSON);
    setupTempDir('h5p-joubel-ui', JOUBEL_LIBRARY_JSON);

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks']).toBeDefined();
    expect(result['h5p-joubel-ui']).toBeDefined();

    const keys = Object.keys(result);
    expect(keys.indexOf('h5p-joubel-ui')).toBeLessThan(keys.indexOf('h5p-blanks'));
  });

  it('dep not found in registry is included with no id and correct optional flag', async () => {
    setupRegistry({ 'H5P.Blanks': REGISTRY_DATA['H5P.Blanks'] });
    const libWithUnknownDep = {
      ...BLANKS_LIBRARY_JSON,
      preloadedDependencies: [
        { machineName: 'H5P.Unknown', majorVersion: 1, minorVersion: 0 },
      ],
    };
    setupTempDir('h5p-blanks', libWithUnknownDep);

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['H5P.Unknown']).toBeDefined();
    expect(result['H5P.Unknown'].id).toBeUndefined();
    // H5P.Unknown is in preloadedDependencies → required (not optional)
    expect(result['H5P.Unknown'].optional).toBe(false);
  });
});
