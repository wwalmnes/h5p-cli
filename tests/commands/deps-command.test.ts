import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { depsCommand } from '../../src/commands/deps.ts';
import { computeDependencies } from '../../src/logic/dependencies.ts';

vi.mock('../../src/logic/dependencies.ts', () => ({ computeDependencies: vi.fn() }));

describe('depsCommand', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('resolves with every argument given', async () => {
    await depsCommand().parseAsync(['node', 'h5p', 'h5p-blanks', 'view', '1.14', '/folder']);
    expect(computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'view', '1.14', '/folder');
  });

  it('resolves with only the library', async () => {
    await depsCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(computeDependencies).toHaveBeenCalledWith('h5p-blanks', undefined, undefined, undefined);
  });

  it('prints registered dependencies as data', async () => {
    vi.mocked(computeDependencies).mockResolvedValue({ 'h5p-core': { id: 'H5P.Core', optional: false } } as any);
    await depsCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stdout).toContain('h5p-core');
  });

  it('warns about unregistered dependencies, saying whether they are optional', async () => {
    vi.mocked(computeDependencies).mockResolvedValue({
      'h5p-optional': { id: undefined, optional: true },
      'h5p-required': { id: null, optional: false },
    } as any);
    await depsCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('unregistered optional h5p-optional library');
    expect(stderr).toContain('unregistered required h5p-required library');
    expect(stdout).not.toContain('h5p-optional');
  });

  it('logs error on rejection', async () => {
    vi.mocked(computeDependencies).mockRejectedValue(new Error('fail'));
    await depsCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: fail');
  });

  it('rejects an invalid mode without resolving', async () => {
    await depsCommand().parseAsync(['node', 'h5p', 'h5p-blanks', 'invalid']);
    expect(computeDependencies).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
