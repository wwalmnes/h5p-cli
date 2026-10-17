import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installCommand } from '../../src/commands/install.ts';
import { getWithDependencies } from '../../src/install/install.ts';

vi.mock('../../src/config/loader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../src/install/install.ts', () => ({ getWithDependencies: vi.fn() }));

describe('installCommand', () => {
  let stderr: string;

  beforeEach(() => {
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.mocked(getWithDependencies).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('downloads the library and its dependencies in the given mode', async () => {
    await installCommand().parseAsync(['node', 'h5p', 'h5p-blanks', 'edit']);
    expect(getWithDependencies).toHaveBeenCalledWith('download', 'h5p-blanks', 'edit', false);
  });

  it('leaves the mode to the default when none is given', async () => {
    await installCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(getWithDependencies).toHaveBeenCalledWith('download', 'h5p-blanks', undefined, false);
  });

  it('logs error on rejection', async () => {
    vi.mocked(getWithDependencies).mockRejectedValue(new Error('install failed'));
    await installCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: install failed');
  });

  it('rejects an invalid mode without installing anything', async () => {
    await installCommand().parseAsync(['node', 'h5p', 'h5p-blanks', 'invalid']);
    expect(getWithDependencies).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
