import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// A fixed dep map returned by the computeDependencies spy.
// Simulates two registered libraries: h5p-joubel-ui (dep) and h5p-blanks (parent).
const DEP_MAP = {
  'h5p-joubel-ui': {
    id: 'H5P.JoubelUI',
    shortName: 'h5p-joubel-ui',
    repoName: 'h5p-joubel-ui',
    org: 'h5p',
    version: { major: 3, minor: 3, patch: 0 },
    optional: false,
    preloadedJs: [],
    preloadedCss: [],
    preloadedDependencies: [],
    editorDependencies: [],
  },
  'h5p-blanks': {
    id: 'H5P.Blanks',
    shortName: 'h5p-blanks',
    repoName: 'h5p-blanks',
    org: 'h5p',
    version: { major: 1, minor: 14, patch: 0 },
    optional: false,
    preloadedJs: [],
    preloadedCss: [],
    preloadedDependencies: [],
    editorDependencies: [],
  },
} as any;

describe('logic.getWithDependencies', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    vi.spyOn(logic, 'computeDependencies').mockResolvedValue(DEP_MAP);
    fs.mkdirSync('libraries', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('skips already-installed library and adds it to toSkip', async () => {
    // Pre-create both library folders to simulate already installed
    fs.mkdirSync('libraries/H5P.JoubelUI-3.3', { recursive: true });
    fs.mkdirSync('libraries/H5P.Blanks-1.14', { recursive: true });

    const result = await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    expect(result).toContain('h5p-joubel-ui');
    expect(result).toContain('h5p-blanks');
    // No git clone should have been called
    const cloneCalls = vi.mocked(execSync).mock.calls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).startsWith('git clone'),
    );
    expect(cloneCalls).toHaveLength(0);
  });

  it('calls execSync git clone for a not-yet-installed library', async () => {
    // Do not pre-create library folders
    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    const cloneCalls = vi.mocked(execSync).mock.calls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).startsWith('git clone'),
    );
    expect(cloneCalls.length).toBeGreaterThan(0);
  });

  it('skips optional unregistered dep with a log message and no throw', async () => {
    vi.spyOn(logic, 'computeDependencies').mockResolvedValue({
      'H5P.SomeOptional': { id: undefined, optional: true, parent: 'h5p-blanks' } as any,
    });

    await expect(
      logic.getWithDependencies('clone', 'h5p-blanks', 'view', false),
    ).resolves.toBeDefined();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('skipping optional unregistered'),
    );
  });

  it('throws for a required unregistered dep', async () => {
    vi.spyOn(logic, 'computeDependencies').mockResolvedValue({
      'H5P.Required': { id: undefined, optional: false, parent: 'h5p-blanks' } as any,
    });

    await expect(
      logic.getWithDependencies('clone', 'h5p-blanks', 'view', false),
    ).rejects.toThrow('unregistered H5P.Required library');
  });

  it('toSkip accumulates — passing result of first call skips all already-processed libs', async () => {
    const first = await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    vi.mocked(execSync).mockClear();

    // Second call with toSkip = result of first; no clones should happen
    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false, first);

    const cloneCalls = vi.mocked(execSync).mock.calls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).startsWith('git clone'),
    );
    expect(cloneCalls).toHaveLength(0);
  });
});
