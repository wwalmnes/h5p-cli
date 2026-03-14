import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmptyProject, type Fixture } from '../helpers/fixture';

vi.mock('../../logic', () => ({
  default: {
    clone: vi.fn(),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    registryEntryFromRepoUrl: vi.fn(),
    machineToShort: vi.fn(),
    tags: vi.fn(),
    export: vi.fn(),
    import: vi.fn().mockReturnValue('content'),
    verifySetup: vi.fn(),
  },
}));

describe('import — end-to-end', () => {
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

  it('calls logic.import with folder and no archive by default', async () => {
    const logic = await import('../../logic');
    const { importCommand } = await import('../../src/commands/import');

    await importCommand().parseAsync(['node', 'h5p', 'content-folder']);

    expect(logic.default.import).toHaveBeenCalledWith('content-folder', undefined);
  });

  it('passes the optional archive path to logic.import', async () => {
    const logic = await import('../../logic');
    const { importCommand } = await import('../../src/commands/import');

    await importCommand().parseAsync(['node', 'h5p', 'content-folder', 'archive.h5p']);

    expect(logic.default.import).toHaveBeenCalledWith('content-folder', 'archive.h5p');
  });
});
