import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coreCommand } from '../../src/commands/core';

vi.mock('../../configLoader', () => ({
  default: {
    registry: 'libraryRegistry.json',
    folders: { libraries: 'libraries', temp: 'temp' },
    core: { clone: [], setup: [] },
  },
}));
vi.mock('../../logic', () => ({
  default: { clone: vi.fn(), computeDependencies: vi.fn(), getWithDependencies: vi.fn(), getRegistry: vi.fn(), registryEntryFromRepoUrl: vi.fn(), machineToShort: vi.fn() },
}));
vi.mock('fs', () => ({
  default: { existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn() },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('coreCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('has correct name', () => {
    const mockSvc = { core: vi.fn().mockResolvedValue(undefined) } as any;
    expect(coreCommand(mockSvc).name()).toBe('core');
  });

  it('calls service.core', async () => {
    const mockSvc = { core: vi.fn().mockResolvedValue(undefined) } as any;
    const cmd = coreCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p']);
    expect(mockSvc.core).toHaveBeenCalled();
  });

  it('logs error on rejection', async () => {
    const mockSvc = { core: vi.fn().mockRejectedValue(new Error('core failed')) } as any;
    const cmd = coreCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p']);
    expect(console.log).toHaveBeenCalledWith('> error');
  });
});
