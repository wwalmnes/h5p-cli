import { describe, it, expect, vi, beforeEach } from 'vitest';
import { depsCommand } from '../../src/commands/deps';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { computeDependencies: vi.fn() },
}));

describe('depsCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { deps: vi.fn().mockResolvedValue(undefined) } as any;
    expect(depsCommand(mockSvc).name()).toBe('deps');
  });

  it('calls service.deps with all args', async () => {
    const mockSvc = { deps: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = depsCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', 'view', '1.14', '/folder']);
    expect(mockSvc.deps).toHaveBeenCalledWith('h5p-blanks', 'view', '1.14', '/folder');
  });

  it('calls service.deps with only library', async () => {
    const mockSvc = { deps: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = depsCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockSvc.deps).toHaveBeenCalledWith('h5p-blanks', undefined, undefined, undefined);
  });

  it('logs error on rejection', async () => {
    const mockSvc = { deps: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    const cmd = depsCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
