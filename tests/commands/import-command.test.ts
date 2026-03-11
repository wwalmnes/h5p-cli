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
    const mockSvc = { import: vi.fn() } as any;
    expect(importCommand(mockSvc).name()).toBe('import');
  });

  it('calls service.import with folder and archive', async () => {
    const mockSvc = { import: vi.fn() } as any;
    const cmd = importCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'myfolder', 'archive.h5p']);
    expect(mockSvc.import).toHaveBeenCalledWith('myfolder', 'archive.h5p');
  });

  it('calls service.import without archive', async () => {
    const mockSvc = { import: vi.fn() } as any;
    const cmd = importCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'myfolder']);
    expect(mockSvc.import).toHaveBeenCalledWith('myfolder', undefined);
  });

  it('logs error on exception', async () => {
    const mockSvc = { import: vi.fn().mockImplementation(() => { throw new Error('import failed'); }) } as any;
    const cmd = importCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'myfolder']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
