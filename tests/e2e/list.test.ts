import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

vi.mock('../../logic', () => ({
  default: {
    clone: vi.fn(),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    getRegistry: vi.fn().mockResolvedValue({
      regular: {
        'H5P.Blanks': { id: 'h5p-blanks', org: 'h5p' },
        'H5P.MultiChoice': { id: 'h5p-multi-choice', org: 'h5p' },
      },
      reversed: {},
    }),
    registryEntryFromRepoUrl: vi.fn(),
    machineToShort: vi.fn(),
    tags: vi.fn(),
    export: vi.fn(),
    import: vi.fn(),
    verifySetup: vi.fn(),
  },
}));

describe('list — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;
  let stdout: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('fetches the registry without ignoreFile by default', async () => {
    const logic = await import('../../logic.ts');
    const { listCommand } = await import('../../src/commands/list.ts');

    await listCommand().parseAsync(['node', 'h5p']);

    expect(logic.default.getRegistry).toHaveBeenCalledWith(false);
  });

  it('passes ignoreFile=true when second argument is "1"', async () => {
    const logic = await import('../../logic.ts');
    const { listCommand } = await import('../../src/commands/list.ts');

    await listCommand().parseAsync(['node', 'h5p', '0', '1']);

    expect(logic.default.getRegistry).toHaveBeenCalledWith(true);
  });

  it('logs each library name from the registry', async () => {
    const { listCommand } = await import('../../src/commands/list.ts');

    await listCommand().parseAsync(['node', 'h5p']);

    // the registry listing is a table on the stdout data channel now
    expect(stdout).toContain('H5P.Blanks');
    expect(stdout).toContain('H5P.MultiChoice');
  });
});
