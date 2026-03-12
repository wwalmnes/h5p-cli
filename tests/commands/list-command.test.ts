import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCommand } from '../../src/commands/list';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { getRegistry: vi.fn() },
}));

describe('listCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { list: vi.fn().mockResolvedValue(undefined) } as any;
    expect(listCommand(mockSvc).name()).toBe('list');
  });

  it('calls service.list with reversed=0 and ignoreFile=0 by default', async () => {
    const mockSvc = { list: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = listCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p']);
    expect(mockSvc.list).toHaveBeenCalledWith(false, false);
  });

  it('calls service.list with reversed=1', async () => {
    const mockSvc = { list: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = listCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', '1']);
    expect(mockSvc.list).toHaveBeenCalledWith(true, false);
  });

  it('calls service.list with ignoreFile=1', async () => {
    const mockSvc = { list: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = listCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', '0', '1']);
    expect(mockSvc.list).toHaveBeenCalledWith(false, true);
  });

  it('logs error on rejection', async () => {
    const mockSvc = { list: vi.fn().mockRejectedValue(new Error('list failed')) } as any;
    const cmd = listCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
