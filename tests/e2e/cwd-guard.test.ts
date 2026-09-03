import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmptyProject, createSeededProject, type Fixture } from '../helpers/fixture.ts';

// `utils list` is exempt from the guard, so it must reach its adapter. Stub the network.
vi.mock('../../src/adapters/repo-discovery-adapter.ts', () => ({
  RepoDiscoveryAdapter: class {
    fetchRegistry = vi.fn(async () => ({ 'H5P.Accordion': { repository: 'h5p/h5p-accordion' } }));
  },
}));

const { gitCommand } = await import('../../src/commands/git/index.ts');
const { utilsCommand } = await import('../../src/commands/utils/index.ts');

class Exit extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
  }
}

describe('working directory guard — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;
  let stderr: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Exit(code);
    }) as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it('stops "git status" run from the workspace root and points at libraries/', async () => {
    fixture = createSeededProject(['H5P.Accordion-1.0']);
    process.chdir(fixture.dir);

    await expect(gitCommand().parseAsync(['node', 'h5p', 'status'])).rejects.toThrow(Exit);
    expect(stderr).toContain('No git repositories found');
    expect(stderr).toContain('cd libraries');
  });

  it('stops "utils validate" run from the workspace root', async () => {
    fixture = createSeededProject(['H5P.Accordion-1.0']);
    process.chdir(fixture.dir);

    await expect(utilsCommand().parseAsync(['node', 'h5p', 'validate', 'h5p-accordion'])).rejects.toThrow(Exit);
    expect(stderr).toContain('No git repositories found');
  });

  it('lets "utils list" through — it touches no files', async () => {
    fixture = createEmptyProject();
    process.chdir(fixture.dir);

    await expect(utilsCommand().parseAsync(['node', 'h5p', 'list'])).resolves.toBeDefined();
    expect(stderr).not.toContain('No git repositories found');
  });
});
