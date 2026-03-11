import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloneService } from '../../src/services/clone-service';
import type { IInstallAdapter } from '../../src/adapters/install-adapter';

describe('CloneService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };
  const librariesFolder = 'libraries';

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('calls getWithDependencies with clone action', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockResolvedValue([]) };
    const svc = new CloneService(adapter, librariesFolder, logger);
    await svc.clone('h5p-blanks', 'view');
    expect(adapter.getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', 'view');
  });

  it('logs start and done messages with librariesFolder', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockResolvedValue([]) };
    const svc = new CloneService(adapter, librariesFolder, logger);
    await svc.clone('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith(`> cloning h5p-blanks library and dependencies into "${librariesFolder}" folder`);
    expect(logger.log).toHaveBeenCalledWith('> done installing h5p-blanks');
  });

  it('works without mode', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockResolvedValue([]) };
    const svc = new CloneService(adapter, librariesFolder, logger);
    await svc.clone('h5p-blanks');
    expect(adapter.getWithDependencies).toHaveBeenCalledWith('clone', 'h5p-blanks', undefined);
  });

  it('propagates rejection', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockRejectedValue(new Error('clone failed')) };
    const svc = new CloneService(adapter, librariesFolder, logger);
    await expect(svc.clone('h5p-blanks')).rejects.toThrow('clone failed');
  });
});
