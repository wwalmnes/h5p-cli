import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupCommand } from '../../src/commands/setup.ts';
import { SetupService } from '../../src/services/setup-service.ts';
import type { ISetupAdapter } from '../../src/adapters/setup-adapter.ts';
import type { IRegisterAdapter } from '../../src/adapters/register-adapter.ts';
import { RegisterService } from '../../src/services/register-service.ts';

vi.mock('../../configLoader', () => ({
  default: {
    registry: 'libraryRegistry.json',
    folders: { libraries: 'libraries', temp: 'temp' },
  },
}));

vi.mock('../../logic', () => ({
  default: {
    machineToShort: vi.fn(),
    computeDependencies: vi.fn(),
    getWithDependencies: vi.fn(),
    getRegistry: vi.fn(),
    registryEntryFromRepoUrl: vi.fn(),
  },
}));

function makeSetupAdapter(overrides: Partial<ISetupAdapter> = {}): ISetupAdapter {
  return {
    machineToShort: vi.fn().mockReturnValue('h5p-blanks'),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeRegisterAdapter(overrides: Partial<IRegisterAdapter> = {}): IRegisterAdapter {
  return {
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    registryEntryFromRepoUrl: vi.fn().mockResolvedValue({}),
    readJsonFile: vi.fn().mockReturnValue({}),
    writeJsonFile: vi.fn(),
    ...overrides,
  };
}

function makeMockService(overrides: Partial<SetupService> = {}): SetupService {
  const setupAdapter = makeSetupAdapter();
  const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
  const svc = new SetupService(setupAdapter, registerSvc, 'libraries');
  svc.setup = vi.fn().mockResolvedValue(undefined);
  Object.assign(svc, overrides);
  return svc;
}

describe('setupCommand', () => {
  let stderr: string;

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
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
    const mockSvc = makeMockService();
    const cmd = setupCommand(mockSvc);
    expect(cmd.name()).toBe('setup');
  });

  it('calls service.setup with library arg', async () => {
    const mockSvc = makeMockService();
    const cmd = setupCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(mockSvc.setup).toHaveBeenCalledWith('h5p-blanks', undefined, undefined);
  });

  it('forwards version and download args to service.setup', async () => {
    const mockSvc = makeMockService();
    const cmd = setupCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks', '1.14', '1']);
    expect(mockSvc.setup).toHaveBeenCalledWith('h5p-blanks', '1.14', '1');
  });

  it('logs error when service.setup rejects, no unhandled rejection', async () => {
    const mockSvc = makeMockService({
      setup: vi.fn().mockRejectedValue(new Error('setup failed')),
    });
    const cmd = setupCommand(mockSvc);
    await cmd.parseAsync(['node', 'h5p', 'h5p-blanks']);
    expect(stderr).toContain('> error: setup failed');
  });

  it('has a description set', () => {
    const mockSvc = makeMockService();
    const cmd = setupCommand(mockSvc);
    expect(cmd.description()).toBeTruthy();
  });
});
