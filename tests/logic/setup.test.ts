import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setup } from '../../src/logic/setup.ts';
import { computeDependencies } from '../../src/logic/dependencies.ts';
import { getWithDependencies, installDependencies } from '../../src/logic/install.ts';
import { register } from '../../src/logic/register.ts';

vi.mock('../../configLoader', () => ({
  default: { folders: { libraries: 'libraries' } },
}));
vi.mock('../../src/logic/dependencies.ts', () => ({ computeDependencies: vi.fn() }));
vi.mock('../../src/logic/install.ts', () => ({ getWithDependencies: vi.fn(), installDependencies: vi.fn() }));
vi.mock('../../src/logic/register.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/logic/register.ts')>()),
  register: vi.fn(),
}));

describe('setup', () => {
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
    vi.mocked(computeDependencies).mockResolvedValue({});
    vi.mocked(installDependencies).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not register a library given by name', async () => {
    await setup('h5p-blanks');
    expect(register).not.toHaveBeenCalled();
  });

  it('registers a library given by URL and sets it up by its short name', async () => {
    vi.mocked(register).mockResolvedValue({ 'H5P.Blanks': {} });
    await setup('https://github.com/h5p/h5p-blanks');
    expect(register).toHaveBeenCalledWith('https://github.com/h5p/h5p-blanks');
    expect(computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'edit', undefined);
  });

  it('downloads instead of cloning when download=1', async () => {
    await setup('h5p-blanks', undefined, '1');
    expect(installDependencies).toHaveBeenCalledWith('download', expect.any(Object), expect.any(Boolean), expect.any(Array), undefined, undefined);
  });

  it('reports missing optional dependencies without failing', async () => {
    vi.mocked(computeDependencies).mockResolvedValue({
      'h5p-optional-lib': { id: undefined, optional: true, parent: 'h5p-blanks' },
    } as any);
    await setup('h5p-blanks');
    expect(stderr).toContain('missing optional libraries');
    expect(stdout).toContain('h5p-optional-lib (optional) required by h5p-blanks');
  });

  it('throws for a missing required dependency', async () => {
    vi.mocked(computeDependencies).mockResolvedValue({
      'h5p-required-lib': { id: undefined, optional: false, parent: 'h5p-blanks' },
    } as any);
    await expect(setup('h5p-blanks')).rejects.toThrow('unregistered h5p-required-lib library required by h5p-blanks');
    expect(installDependencies).not.toHaveBeenCalled();
  });

  /* The whole point of the collapse: this used to be N+4 resolutions and two
  install passes with the skip list reset between them. Equivalence of the
  resulting graph is pinned in tests/lib/dependency-graph.test.ts. */
  it('resolves the graph once, in edit mode, and installs it once', async () => {
    const graph = { 'h5p-core': { id: 'H5P.Core' }, 'h5p-blanks': { id: 'H5P.Blanks' } } as any;
    vi.mocked(computeDependencies).mockResolvedValue(graph);

    await setup('h5p-blanks');

    expect(computeDependencies).toHaveBeenCalledTimes(1);
    expect(computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'edit', undefined);
    expect(installDependencies).toHaveBeenCalledTimes(1);
    expect(installDependencies).toHaveBeenCalledWith('clone', graph, true, [], undefined, undefined);
    expect(getWithDependencies).not.toHaveBeenCalled();
  });

  it('says what it installs where, and when it is done', async () => {
    await setup('h5p-blanks');
    expect(stderr).toContain('clone h5p-blanks library dependencies into "libraries" folder');
    expect(stderr).toContain('done setting up h5p-blanks');
  });

  it('resolves and installs from a git ref, without tracking master', async () => {
    const graph = { 'h5p-blanks': { id: 'H5P.Blanks' } } as any;
    vi.mocked(computeDependencies).mockResolvedValue(graph);

    await setup('h5p-blanks', 'feat/my-pr');

    expect(computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'edit', 'feat/my-pr');
    expect(installDependencies).toHaveBeenCalledWith(
      'clone', graph, false, [], undefined, { library: 'h5p-blanks', ref: 'feat/my-pr' },
    );
  });

  it('does not treat a release pin as a root git ref', async () => {
    await setup('h5p-blanks', '1.14');

    expect(computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'edit', '1.14');
    expect(installDependencies).toHaveBeenCalledWith(
      'clone', expect.any(Object), false, [], undefined, undefined,
    );
  });

  it('rejects an unsafe ref', async () => {
    await expect(setup('h5p-blanks', 'feat/foo;rm')).rejects.toThrow('invalid ref');
  });
});
