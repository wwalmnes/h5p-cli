import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
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
    import: vi.fn(),
    verifySetup: vi.fn(),
  },
}));

describe('clone — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(async () => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    fs.mkdirSync(path.join(fixture.dir, 'libraries'), { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const logic = await import('../../logic');
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

  it('calls getWithDependencies with action "clone" for the given library', async () => {
    const logic = await import('../../logic');
    const { cloneCommand } = await import('../../src/commands/clone');

    await cloneCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(logic.default.getWithDependencies).toHaveBeenCalledWith(
      'clone', 'H5P.Blanks', undefined, false, undefined
    );
  });

  it('passes mode to getWithDependencies', async () => {
    const logic = await import('../../logic');
    const { cloneCommand } = await import('../../src/commands/clone');

    await cloneCommand().parseAsync(['node', 'h5p', 'H5P.Blanks', 'view']);

    expect(logic.default.getWithDependencies).toHaveBeenCalledWith(
      'clone', 'H5P.Blanks', 'view', false, undefined
    );
  });

  it('creates the library folder as a side effect of cloning', async () => {
    const { cloneCommand } = await import('../../src/commands/clone');

    await cloneCommand().parseAsync(['node', 'h5p', 'H5P.Blanks']);

    expect(fs.existsSync(path.join(fixture.dir, 'libraries', 'H5P.Blanks'))).toBe(true);
  });
});
