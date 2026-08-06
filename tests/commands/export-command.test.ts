import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCommand } from '../../src/commands/export.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { export: vi.fn() },
}));

describe('exportCommand', () => {
  let stderr: string;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
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
    const mockAdapter = { export: vi.fn().mockResolvedValue('/out/h5p-blanks.h5p') } as any;
    expect(exportCommand(mockAdapter).name()).toBe('export');
  });

  it('calls adapter.export with library and folder', async () => {
    const mockAdapter = { export: vi.fn().mockResolvedValue('/out/h5p-blanks.h5p') } as any;
    const cmd = exportCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', '/out']);
    expect(mockAdapter.export).toHaveBeenCalledWith('h5p-blanks', '/out');
  });

  it('calls adapter.export without folder', async () => {
    const mockAdapter = { export: vi.fn().mockResolvedValue('/out/h5p-blanks.h5p') } as any;
    const cmd = exportCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockAdapter.export).toHaveBeenCalledWith('h5p-blanks', undefined);
  });

  it('logs error on rejection', async () => {
    const mockAdapter = { export: vi.fn().mockRejectedValue(new Error('export failed')) } as any;
    const cmd = exportCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: export failed');
  });
});
