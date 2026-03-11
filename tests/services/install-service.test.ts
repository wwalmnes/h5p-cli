import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstallService } from '../../src/services/install-service';
import type { IInstallAdapter } from '../../src/adapters/install-adapter';

describe('InstallService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };
  const librariesFolder = 'libraries';

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('calls getWithDependencies with download action', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockResolvedValue([]) };
    const svc = new InstallService(adapter, librariesFolder, logger);
    await svc.install('h5p-blanks', 'edit');
    expect(adapter.getWithDependencies).toHaveBeenCalledWith('download', 'h5p-blanks', 'edit');
  });

  it('logs start and done messages with librariesFolder', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockResolvedValue([]) };
    const svc = new InstallService(adapter, librariesFolder, logger);
    await svc.install('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith(`> downloading h5p-blanks library and dependencies into "${librariesFolder}" folder`);
    expect(logger.log).toHaveBeenCalledWith('> done installing h5p-blanks');
  });

  it('works without mode', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockResolvedValue([]) };
    const svc = new InstallService(adapter, librariesFolder, logger);
    await svc.install('h5p-blanks');
    expect(adapter.getWithDependencies).toHaveBeenCalledWith('download', 'h5p-blanks', undefined);
  });

  it('propagates rejection', async () => {
    const adapter: IInstallAdapter = { getWithDependencies: vi.fn().mockRejectedValue(new Error('download failed')) };
    const svc = new InstallService(adapter, librariesFolder, logger);
    await expect(svc.install('h5p-blanks')).rejects.toThrow('download failed');
  });
});
