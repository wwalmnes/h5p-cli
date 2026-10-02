import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { missingCommand } from '../../src/commands/missing.ts';
import { computeDependencies } from '../../src/logic/dependencies.ts';
import { getRegistry, parseLibraryFolders } from '../../src/logic/registry.ts';

vi.mock('../../src/logic/dependencies.ts', () => ({ computeDependencies: vi.fn() }));
vi.mock('../../src/logic/registry.ts', () => ({ getRegistry: vi.fn(), parseLibraryFolders: vi.fn() }));

describe('missingCommand', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.mocked(parseLibraryFolders).mockResolvedValue({ 'H5P.Blanks': 'H5P.Blanks-1.14', 'H5P.Core': 'H5P.Core-1.0' });
    vi.mocked(getRegistry).mockResolvedValue({
      regular: { 'h5p-blanks': { id: 'H5P.Blanks' }, 'h5p-core': { id: 'H5P.Core' } },
      reversed: {},
    } as any);
    vi.mocked(computeDependencies).mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('says so when nothing is missing', async () => {
    await missingCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('h5p-blanks has no unregistered dependencies');
  });

  /* The whole graph is resolved once. It used to take the view graph, an edit
  graph rooted at every registered library in it, and then the root's edit
  graph - see dependency-graph.test.ts for why one pass covers them. */
  it('resolves the graph exactly once, in edit mode, from the local folder', async () => {
    await missingCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(computeDependencies).toHaveBeenCalledTimes(1);
    expect(computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'edit', null, 'H5P.Blanks-1.14');
  });

  it('lists only the entries the registry does not know about, optional or required', async () => {
    vi.mocked(computeDependencies).mockResolvedValue({
      'h5p-blanks': { id: 'H5P.Blanks', optional: false },
      'h5p-core': { id: 'H5P.Core', optional: true },
      'h5p-unknown': { id: undefined, optional: true },
      'h5p-needed': { id: undefined, optional: false },
      'h5p-unflagged': { id: undefined },
    } as any);
    await missingCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('unregistered dependencies for h5p-blanks');
    expect(stdout).toBe('h5p-unknown (optional)\nh5p-needed (required)\nh5p-unflagged (required)\n');
  });

  /* An unrecognised name used to throw a TypeError reading .id off the missing
  registry entry; it now reaches the resolver, which names the library. */
  it('hands an unregistered library to the resolver instead of crashing on the lookup', async () => {
    vi.mocked(computeDependencies).mockRejectedValue(new Error('unregistered h5p-nope library'));
    await missingCommand().parseAsync(['node', 'h5p', 'h5p-nope']);
    expect(computeDependencies).toHaveBeenCalledWith('h5p-nope', 'edit', null, undefined);
    expect(stderr).toContain('> error: unregistered h5p-nope library');
  });
});
