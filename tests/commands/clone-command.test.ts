import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneCommand } from '../../src/commands/clone';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { getWithDependencies: vi.fn() },
}));

describe('cloneCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { clone: vi.fn().mockResolvedValue(undefined) } as any;
    expect(cloneCommand(mockSvc).name()).toBe('clone');
  });

  it('calls service.clone with library and mode', async () => {
    const mockSvc = { clone: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = cloneCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', 'view']);
    expect(mockSvc.clone).toHaveBeenCalledWith('h5p-blanks', 'view');
  });

  it('calls service.clone without mode', async () => {
    const mockSvc = { clone: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = cloneCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockSvc.clone).toHaveBeenCalledWith('h5p-blanks', undefined);
  });

  it('logs error on rejection', async () => {
    const mockSvc = { clone: vi.fn().mockRejectedValue(new Error('clone failed')) } as any;
    const cmd = cloneCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
