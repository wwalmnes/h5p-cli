import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCommand } from '../../src/commands/list.ts';
import { getRegistry } from '../../src/h5p/registry.ts';

vi.mock('../../src/h5p/registry.ts', () => ({ getRegistry: vi.fn() }));

describe('listCommand', () => {
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
    vi.mocked(getRegistry).mockResolvedValue({ regular: {}, reversed: {} } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('reads the local registry file by default', async () => {
    await listCommand().parseAsync(['node', 'h5p']);
    expect(getRegistry).toHaveBeenCalledWith(false);
  });

  it('refetches the registry when ignoreFile is 1', async () => {
    await listCommand().parseAsync(['node', 'h5p', '0', '1']);
    expect(getRegistry).toHaveBeenCalledWith(true);
  });

  it('logs error on rejection', async () => {
    vi.mocked(getRegistry).mockRejectedValue(new Error('list failed'));
    await listCommand().parseAsync(['node', 'h5p']);
    expect(stderr).toContain('> error: list failed');
  });

  it('writes the registry to stdout', async () => {
    vi.mocked(getRegistry).mockResolvedValue({
      regular: {
        'h5p-blanks': { id: 'H5P.Blanks', org: 'h5p' },
        'h5p-multi-choice': { id: 'H5P.MultiChoice', org: 'h5p' },
      },
      reversed: {},
    } as any);
    await listCommand().parseAsync(['node', 'h5p']);
    expect(stdout).toContain('h5p-blanks');
    expect(stdout).toContain('h5p-multi-choice');
  });
});
