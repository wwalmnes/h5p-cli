import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

const VERIFY_RESULT = {
  ok: true,
  libraries: { 'H5P.Blanks': { present: true } },
};

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
    import: vi.fn(),
    verifySetup: vi.fn().mockResolvedValue(VERIFY_RESULT),
  },
}));

describe('verify — end-to-end', () => {
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

  it('calls logic.verifySetup with the given library name', async () => {
    const logic = await import('../../logic.ts');
    const { verifyCommand } = await import('../../src/commands/verify.ts');

    await verifyCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.verifySetup).toHaveBeenCalledWith('H5P.Blanks');
  });

  it('logs the verification result', async () => {
    const { verifyCommand } = await import('../../src/commands/verify.ts');

    await verifyCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(console.log).toHaveBeenCalledWith(VERIFY_RESULT);
  });
});
