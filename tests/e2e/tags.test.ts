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
    tags: vi.fn().mockReturnValue(['1.0.0', '1.1.0', '2.0.0']),
    export: vi.fn(),
    import: vi.fn(),
    verifySetup: vi.fn(),
  },
}));

describe('tags — end-to-end', () => {
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

  it('calls logic.tags with org, library, and mainBranch', async () => {
    const logic = await import('../../logic.ts');
    const { tagsCommand } = await import('../../src/commands/tags.ts');

    await tagsCommand().parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks', 'master']);

    expect(logic.default.tags).toHaveBeenCalledWith('h5p', 'h5p-blanks', 'master');
  });

  it('logs the tag list returned by logic.tags', async () => {
    const { tagsCommand } = await import('../../src/commands/tags.ts');

    await tagsCommand().parseAsync(['node', 'h5p', 'h5p', 'h5p-blanks', 'master']);

    const allCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const tagListCall = allCalls.find(([arg]) => Array.isArray(arg));
    expect(tagListCall?.[0]).toEqual(['1.0.0', '1.1.0', '2.0.0']);
  });
});
