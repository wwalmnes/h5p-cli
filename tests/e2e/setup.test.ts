import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
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
    export: vi.fn(),
    import: vi.fn(),
    verifySetup: vi.fn(),
  },
}));

describe('setup — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(async () => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    fs.mkdirSync(path.join(fixture.dir, 'libraries'), { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const logic = await import('../../logic.ts');
    vi.mocked(logic.default.getWithDependencies).mockImplementation(
      async (_action: string, library: string) => {
        fs.mkdirSync(path.join(fixture.dir, 'libraries', library), { recursive: true });
        return [library];
      }
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('calls computeDependencies for both view and edit modes', async () => {
    const logic = await import('../../logic.ts');
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.computeDependencies).toHaveBeenCalledWith('H5P.Blanks', 'view', undefined);
    expect(logic.default.computeDependencies).toHaveBeenCalledWith('H5P.Blanks', 'edit', undefined);
  });

  it('calls getWithDependencies with action "clone" by default', async () => {
    const logic = await import('../../logic.ts');
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    const calls = vi.mocked(logic.default.getWithDependencies).mock.calls;
    expect(calls.every(([action]) => action === 'clone')).toBe(true);
  });

  it('calls getWithDependencies with action "download" when third arg is "1"', async () => {
    const logic = await import('../../logic.ts');
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks', '1.0', '1']);

    const calls = vi.mocked(logic.default.getWithDependencies).mock.calls;
    expect(calls.every(([action]) => action === 'download')).toBe(true);
  });

  it('creates library folders as a side effect of cloning dependencies', async () => {
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(fs.existsSync(path.join(fixture.dir, 'libraries', 'H5P.Blanks'))).toBe(true);
  });
});
