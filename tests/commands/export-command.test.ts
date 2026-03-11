import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportCommand } from '../../src/commands/export';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { export: vi.fn() },
}));

describe('exportCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { export: vi.fn().mockResolvedValue(undefined) } as any;
    expect(exportCommand(mockSvc).name()).toBe('export');
  });

  it('calls service.export with library and folder', async () => {
    const mockSvc = { export: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = exportCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', '/out']);
    expect(mockSvc.export).toHaveBeenCalledWith('h5p-blanks', '/out');
  });

  it('calls service.export without folder', async () => {
    const mockSvc = { export: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = exportCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockSvc.export).toHaveBeenCalledWith('h5p-blanks', undefined);
  });

  it('logs error on rejection', async () => {
    const mockSvc = { export: vi.fn().mockRejectedValue(new Error('export failed')) } as any;
    const cmd = exportCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
