import { describe, it, expect, vi, beforeEach } from 'vitest';
import { missingCommand } from '../../src/commands/missing.ts';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: {
    parseLibraryFolders: vi.fn(),
    getRegistry: vi.fn(),
    computeDependencies: vi.fn(),
  },
}));

describe('missingCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { missing: vi.fn().mockResolvedValue(undefined) } as any;
    expect(missingCommand(mockSvc).name()).toBe('missing');
  });

  it('calls service.missing with library', async () => {
    const mockSvc = { missing: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = missingCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockSvc.missing).toHaveBeenCalledWith('h5p-blanks');
  });

  it('logs error on rejection', async () => {
    const mockSvc = { missing: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    const cmd = missingCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
