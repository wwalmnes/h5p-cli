import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneCommand } from '../../src/commands/clone.ts';
import { getWithDependencies } from '../../src/logic/install.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../src/logic/install.ts', () => ({ getWithDependencies: vi.fn() }));

describe('cloneCommand', () => {
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

  it('clones the library and its dependencies in the given mode', async () => {
    await cloneCommand().parseAsync(['node', 'h5p', 'h5p-blanks', 'edit']);
    expect(getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', 'edit', false);
  });

  it('leaves the mode to the default when none is given', async () => {
    await cloneCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', undefined, false);
  });

  it('logs error on rejection', async () => {
    vi.mocked(getWithDependencies).mockRejectedValue(new Error('clone failed'));
    await cloneCommand().parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: clone failed');
  });

  it('rejects an invalid mode without installing anything', async () => {
    await cloneCommand().parseAsync(['node', 'h5p', 'h5p-blanks', 'invalid']);
    expect(getWithDependencies).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
