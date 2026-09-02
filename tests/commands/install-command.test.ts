import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installCommand } from '../../src/commands/install.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { getWithDependencies: vi.fn() },
}));

describe('installCommand', () => {
  let stderr: string;

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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
    const mockAdapter = { getWithDependencies: vi.fn().mockResolvedValue(undefined) } as any;
    expect(installCommand(mockAdapter).name()).toBe('install');
  });

  it('calls adapter.getWithDependencies with download action, library and mode', async () => {
    const mockAdapter = { getWithDependencies: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = installCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', 'edit']);
    expect(mockAdapter.getWithDependencies).toHaveBeenCalledWith('download', 'h5p-blanks', 'edit');
  });

  it('calls adapter.getWithDependencies without mode', async () => {
    const mockAdapter = { getWithDependencies: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = installCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockAdapter.getWithDependencies).toHaveBeenCalledWith('download', 'h5p-blanks', undefined);
  });

  it('logs error on rejection', async () => {
    const mockAdapter = { getWithDependencies: vi.fn().mockRejectedValue(new Error('install failed')) } as any;
    const cmd = installCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: install failed');
  });
});
