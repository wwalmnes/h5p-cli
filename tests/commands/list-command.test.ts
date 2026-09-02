import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCommand } from '../../src/commands/list.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { getRegistry: vi.fn() },
}));

describe('listCommand', () => {
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
});
