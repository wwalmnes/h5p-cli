import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

vi.mock('../../logic', () => ({
  default: {
    clone: vi.fn(),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    registryEntryFromRepoUrl: vi.fn(),
    machineToShort: vi.fn(),
    tags: vi.fn(),
    export: vi.fn().mockResolvedValue('H5P.Blanks.h5p'),
    import: vi.fn(),
    verifySetup: vi.fn(),
  },
}));

describe('export — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('calls logic.export with library name and no folder by default', async () => {
    const logic = await import('../../logic.ts');
    const { exportCommand } = await import('../../src/commands/export.ts');

    await exportCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.export).toHaveBeenCalledWith('H5P.Blanks', undefined);
  });

  it('passes the optional output folder to logic.export', async () => {
    const logic = await import('../../logic.ts');
    const { exportCommand } = await import('../../src/commands/export.ts');

    await exportCommand().parseAsync(['node', 'h5p', 'H5P.Blanks', 'dist']);

    expect(logic.default.export).toHaveBeenCalledWith('H5P.Blanks', 'dist');
  });
});
