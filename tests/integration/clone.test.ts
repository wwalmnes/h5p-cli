import { describe, it, expect, vi } from 'vitest';
import { CloneService } from '../../src/services/clone-service';
import type { IInstallAdapter } from '../../src/adapters/install-adapter';

function makeAdapter(): IInstallAdapter {
  return {
    getWithDependencies: vi.fn().mockResolvedValue([]),
  };
}

describe('CloneService integration', () => {
  it('logs library name and librariesFolder in the cloning message', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter();
    const svc = new CloneService(adapter, 'libraries', logger);

    await svc.clone('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith(
      '> cloning H5P.Blanks library and dependencies into "libraries" folder'
    );
  });

  it('calls getWithDependencies with action "clone"', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter();
    const svc = new CloneService(adapter, 'libraries', logger);

    await svc.clone('H5P.Blanks', 'view');

    expect(adapter.getWithDependencies).toHaveBeenCalledWith('clone', 'H5P.Blanks', 'view');
  });
});
