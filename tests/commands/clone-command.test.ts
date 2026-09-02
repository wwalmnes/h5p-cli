import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneCommand } from '../../src/commands/clone.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { getWithDependencies: vi.fn() },
}));

describe('cloneCommand', () => {
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
    expect(cloneCommand(mockAdapter).name()).toBe('clone');
  });

  it('calls adapter.getWithDependencies with clone action, library and mode', async () => {
    const mockAdapter = { getWithDependencies: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = cloneCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', 'view']);
    expect(mockAdapter.getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', 'view');
  });

  it('calls adapter.getWithDependencies without mode', async () => {
    const mockAdapter = { getWithDependencies: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = cloneCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockAdapter.getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', undefined);
  });

  it('logs error on rejection', async () => {
    const mockAdapter = { getWithDependencies: vi.fn().mockRejectedValue(new Error('clone failed')) } as any;
    const cmd = cloneCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: clone failed');
  });
});
