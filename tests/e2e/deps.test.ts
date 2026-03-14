import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmptyProject, type Fixture } from '../helpers/fixture';

vi.mock('../../logic', () => ({
  default: {
    clone: vi.fn(),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    getRegistry: vi.fn().mockResolvedValue({
      regular: { 'H5P.Blanks': { id: 'h5p-blanks', org: 'h5p' } },
      reversed: {},
    }),
    parseLibraryFolders: vi.fn().mockResolvedValue({ 'h5p-blanks': 'H5P.Blanks-1.0' }),
    registryEntryFromRepoUrl: vi.fn(),
    machineToShort: vi.fn(),
    tags: vi.fn(),
    export: vi.fn(),
    import: vi.fn(),
    verifySetup: vi.fn(),
  },
}));

describe('deps — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('calls computeDependencies with library name and no defaults', async () => {
    const logic = await import('../../logic');
    const { depsCommand } = await import('../../src/commands/deps');

    await depsCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.computeDependencies).toHaveBeenCalledWith(
      'H5P.Blanks', undefined, undefined, undefined
    );
  });

  it('passes mode, version, and folder arguments through', async () => {
    const logic = await import('../../logic');
    const { depsCommand } = await import('../../src/commands/deps');

    await depsCommand().parseAsync(['node', 'h5p', 'H5P.Blanks', 'view', '1.0', 'some-folder']);

    expect(logic.default.computeDependencies).toHaveBeenCalledWith(
      'H5P.Blanks', 'view', '1.0', 'some-folder'
    );
  });

  it('rejects an invalid mode and does not call computeDependencies', async () => {
    const logic = await import('../../logic');
    const { depsCommand } = await import('../../src/commands/deps');
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await depsCommand().parseAsync(['node', 'h5p', 'H5P.Blanks', 'invalid']);

    expect(logic.default.computeDependencies).not.toHaveBeenCalled();
  });
});

describe('missing — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('calls getRegistry, parseLibraryFolders, and computeDependencies for the library', async () => {
    const logic = await import('../../logic');
    const { missingCommand } = await import('../../src/commands/missing');

    await missingCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.getRegistry).toHaveBeenCalled();
    expect(logic.default.parseLibraryFolders).toHaveBeenCalled();
    expect(logic.default.computeDependencies).toHaveBeenCalledWith(
      'H5P.Blanks', 'view', null, 'H5P.Blanks-1.0'
    );
  });

  it('reports no unregistered dependencies when all deps are in registry', async () => {
    const { missingCommand } = await import('../../src/commands/missing');

    await missingCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    const logged = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat() as string[];
    expect(logged.some(l => l.includes('H5P.Blanks has no unregistered dependencies'))).toBe(true);
  });
});
