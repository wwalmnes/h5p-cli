import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installCommand } from '../../src/commands/install';

vi.mock('../../configLoader', () => ({
  default: { registry: 'libraryRegistry.json', folders: { libraries: 'libraries', temp: 'temp' } },
}));
vi.mock('../../logic', () => ({
  default: { getWithDependencies: vi.fn() },
}));

describe('installCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { install: vi.fn().mockResolvedValue(undefined) } as any;
    expect(installCommand(mockSvc).name()).toBe('install');
  });

  it('calls service.install with library and mode', async () => {
    const mockSvc = { install: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = installCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', 'edit']);
    expect(mockSvc.install).toHaveBeenCalledWith('h5p-blanks', 'edit');
  });

  it('calls service.install without mode', async () => {
    const mockSvc = { install: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = installCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockSvc.install).toHaveBeenCalledWith('h5p-blanks', undefined);
  });

  it('logs error on rejection', async () => {
    const mockSvc = { install: vi.fn().mockRejectedValue(new Error('install failed')) } as any;
    const cmd = installCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
