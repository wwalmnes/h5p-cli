import { describe, it, expect, vi } from 'vitest';
import { InstallService } from '../../src/services/install-service';
import type { IInstallAdapter } from '../../src/adapters/install-adapter';

function makeAdapter(): IInstallAdapter {
  return {
    getWithDependencies: vi.fn().mockResolvedValue([]),
  };
}

describe('InstallService integration', () => {
  it('logs library name and librariesFolder in the downloading message', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter();
    const svc = new InstallService(adapter, 'libraries', logger);

    await svc.install('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith(
      '> downloading H5P.Blanks library and dependencies into "libraries" folder'
    );
  });

  it('calls getWithDependencies with action "download"', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter();
    const svc = new InstallService(adapter, 'libraries', logger);

    await svc.install('H5P.Blanks', 'edit');

    expect(adapter.getWithDependencies).toHaveBeenCalledWith('download', 'H5P.Blanks', 'edit');
  });
});
