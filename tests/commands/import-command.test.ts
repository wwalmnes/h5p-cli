import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importCommand } from '../../src/commands/import';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { import: vi.fn() },
}));

describe('importCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockAdapter = { import: vi.fn().mockReturnValue('myfolder') } as any;
    expect(importCommand(mockAdapter).name()).toBe('import');
  });

  it('calls adapter.import with folder and archive', async () => {
    const mockAdapter = { import: vi.fn().mockReturnValue('myfolder') } as any;
    const cmd = importCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'myfolder', 'archive.h5p']);
    expect(mockAdapter.import).toHaveBeenCalledWith('myfolder', 'archive.h5p');
  });

  it('calls adapter.import without archive', async () => {
    const mockAdapter = { import: vi.fn().mockReturnValue('myfolder') } as any;
    const cmd = importCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'myfolder']);
    expect(mockAdapter.import).toHaveBeenCalledWith('myfolder', undefined);
  });

  it('logs error on exception', async () => {
    const mockAdapter = { import: vi.fn().mockImplementation(() => { throw new Error('import failed'); }) } as any;
    const cmd = importCommand(mockAdapter);
    await cmd.parseAsync(['node', 'h5p', 'myfolder']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
