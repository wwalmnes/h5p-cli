import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreService } from '../../src/services/core-service';
import type { ICoreAdapter } from '../../src/adapters/core-adapter';

function makeSetupService() {
  return { setup: vi.fn().mockResolvedValue(undefined) } as any;
}

describe('CoreService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };
  const librariesFolder = 'libraries';

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('skips cloning when existsSync returns true', async () => {
    const adapter: ICoreAdapter = {
      existsSync: vi.fn().mockReturnValue(true),
      clone: vi.fn(),
    };
    const svc = new CoreService(adapter, makeSetupService(), ['h5p-core'], [], librariesFolder, logger);
    await svc.core();
    expect(adapter.clone).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('>> ~ skipping h5p-core; it already exists.');
  });

  it('clones when existsSync returns false', async () => {
    const adapter: ICoreAdapter = {
      existsSync: vi.fn().mockReturnValue(false),
      clone: vi.fn(),
    };
    const svc = new CoreService(adapter, makeSetupService(), ['h5p-core'], [], librariesFolder, logger);
    await svc.core();
    expect(adapter.clone).toHaveBeenCalledWith('h5p', 'h5p-core', 'master', 'h5p-core');
    expect(logger.log).toHaveBeenCalledWith('>> + installing h5p-core');
  });

  it('calls setupService.setup for each item in coreToSetup', async () => {
    const adapter: ICoreAdapter = { existsSync: vi.fn().mockReturnValue(false), clone: vi.fn() };
    const setupSvc = makeSetupService();
    const svc = new CoreService(adapter, setupSvc, [], ['h5p-editor', 'h5p-blanks'], librariesFolder, logger);
    await svc.core();
    expect(setupSvc.setup).toHaveBeenCalledWith('h5p-editor');
    expect(setupSvc.setup).toHaveBeenCalledWith('h5p-blanks');
  });

  it('logs done message', async () => {
    const adapter: ICoreAdapter = { existsSync: vi.fn().mockReturnValue(false), clone: vi.fn() };
    const svc = new CoreService(adapter, makeSetupService(), [], [], librariesFolder, logger);
    await svc.core();
    expect(logger.log).toHaveBeenCalledWith('> done setting up core libraries');
  });

  it('checks correct folder path', async () => {
    const adapter: ICoreAdapter = { existsSync: vi.fn().mockReturnValue(true), clone: vi.fn() };
    const svc = new CoreService(adapter, makeSetupService(), ['h5p-core'], [], librariesFolder, logger);
    await svc.core();
    expect(adapter.existsSync).toHaveBeenCalledWith('libraries/h5p-core');
  });

  it('propagates rejection from setup', async () => {
    const adapter: ICoreAdapter = { existsSync: vi.fn().mockReturnValue(false), clone: vi.fn() };
    const setupSvc = { setup: vi.fn().mockRejectedValue(new Error('setup failed')) } as any;
    const svc = new CoreService(adapter, setupSvc, [], ['h5p-editor'], librariesFolder, logger);
    await expect(svc.core()).rejects.toThrow('setup failed');
  });
});
