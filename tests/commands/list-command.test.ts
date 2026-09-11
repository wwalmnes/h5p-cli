import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCommand } from '../../src/commands/list.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { getRegistry: vi.fn() },
}));

describe('listCommand', () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout += chunk;
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct name', () => {
    const mockAdapter = { getRegistry: vi.fn().mockResolvedValue({ regular: {} }) } as any;
    expect(listCommand(mockAdapter).name()).toBe('list');
  });

  it('calls adapter.getRegistry with ignoreFile=false by default', async () => {
    const mockAdapter = { getRegistry: vi.fn().mockResolvedValue({ regular: {} }) } as any;
    const cmd = listCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p']);
    expect(mockAdapter.getRegistry).toHaveBeenCalledWith(false);
  });

  it('calls adapter.getRegistry with ignoreFile=true', async () => {
    const mockAdapter = { getRegistry: vi.fn().mockResolvedValue({ regular: {} }) } as any;
    const cmd = listCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', '0', '1']);
    expect(mockAdapter.getRegistry).toHaveBeenCalledWith(true);
  });

  it('logs error on rejection', async () => {
    const mockAdapter = { getRegistry: vi.fn().mockRejectedValue(new Error('list failed')) } as any;
    const cmd = listCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p']);
    expect(stderr).toContain('> error: list failed');
  });

  it('writes the registry to stdout', async () => {
    const mockAdapter = {
      getRegistry: vi.fn().mockResolvedValue({
        regular: {
          'h5p-blanks': { id: 'H5P.Blanks', org: 'h5p' },
          'h5p-multi-choice': { id: 'H5P.MultiChoice', org: 'h5p' },
        },
      }),
    } as any;
    await listCommand(mockAdapter).parseAsync(['node', 'h5p']);
    expect(stdout).toContain('h5p-blanks');
    expect(stdout).toContain('h5p-multi-choice');
  });
});
