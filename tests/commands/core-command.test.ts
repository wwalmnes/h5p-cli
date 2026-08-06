import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coreCommand } from '../../src/commands/core.ts';

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
  default: { existsSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('coreCommand', () => {
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
    expect(stderr).toContain('> error: core failed');
  });
});
