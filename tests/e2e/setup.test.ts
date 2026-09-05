import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

vi.mock('../../logic', () => ({
  default: {
    clone: vi.fn(),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    installDependencies: vi.fn().mockResolvedValue([]),
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
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const logic = await import('../../logic.ts');
    vi.mocked(logic.default.computeDependencies).mockResolvedValue({
      'H5P.Blanks': { id: 'H5P.Blanks' },
      'H5P.JoubelUI': { id: 'H5P.JoubelUI' },
    } as any);
    /* Stand in for the real install: setup now hands the resolved graph
    straight to installDependencies, so the folders appear from its keys. */
    vi.mocked(logic.default.installDependencies).mockImplementation(
      async (_action, list) => {
        const keys = Object.keys(list);
        for (const key of keys) {
          fs.mkdirSync(path.join(fixture.dir, 'libraries', key), { recursive: true });
        }
        return keys;
      }
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('resolves the dependency graph once, in edit mode', async () => {
    const logic = await import('../../logic.ts');
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.computeDependencies).toHaveBeenCalledTimes(1);
    expect(logic.default.computeDependencies).toHaveBeenCalledWith('H5P.Blanks', 'edit', undefined);
  });

  it('installs with action "clone" by default', async () => {
    const logic = await import('../../logic.ts');
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.installDependencies).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logic.default.installDependencies).mock.calls[0][0]).toBe('clone');
  });

  it('installs with action "download" when third arg is "1"', async () => {
    const logic = await import('../../logic.ts');
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks', '1.0', '1']);

    expect(logic.default.installDependencies).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logic.default.installDependencies).mock.calls[0][0]).toBe('download');
  });

  it('passes the requested version through to the resolver', async () => {
    const logic = await import('../../logic.ts');
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks', '1.14']);

    expect(logic.default.computeDependencies).toHaveBeenCalledWith('H5P.Blanks', 'edit', '1.14');
    // a pinned version must not be silently upgraded to master by the installer
    expect(vi.mocked(logic.default.installDependencies).mock.calls[0][2]).toBe(false);
  });

  it('creates library folders as a side effect of installing dependencies', async () => {
    const { setupCommand } = await import('../../src/commands/setup.ts');

    await setupCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(fs.existsSync(path.join(fixture.dir, 'libraries', 'H5P.Blanks'))).toBe(true);
    expect(fs.existsSync(path.join(fixture.dir, 'libraries', 'H5P.JoubelUI'))).toBe(true);
  });
});
