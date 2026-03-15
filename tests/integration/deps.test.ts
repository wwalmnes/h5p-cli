import { describe, it, expect, vi } from 'vitest';
import { DepsService } from '../../src/services/deps-service';
import type { IDepsAdapter } from '../../src/adapters/deps-adapter';

function makeAdapter(deps: Record<string, any>): IDepsAdapter {
  return {
    computeDependencies: vi.fn().mockResolvedValue(deps),
  };
}

describe('DepsService integration', () => {
  it('logs each dep by name when all have ids', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      'H5P.JoubelUI': { id: 2, org: 'h5p' },
      'H5P.Question': { id: 3, org: 'h5p' },
    });
    const svc = new DepsService(adapter, logger);

    await svc.deps('H5P.Blanks', 'view');

    expect(logger.log).toHaveBeenCalledWith('H5P.JoubelUI');
    expect(logger.log).toHaveBeenCalledWith('H5P.Question');
  });

  it('logs unregistered optional dep with warning prefix', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      'H5P.Registered': { id: 1, org: 'h5p' },
      'H5P.OptDep': { optional: true },
    });
    const svc = new DepsService(adapter, logger);

    await svc.deps('H5P.Blanks', 'view');

    expect(logger.log).toHaveBeenCalledWith('H5P.Registered');
    expect(logger.log).toHaveBeenCalledWith('!!! unregistered optional H5P.OptDep library');
  });

  it('logs unregistered required dep with warning prefix', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      'H5P.RequiredDep': { optional: false },
    });
    const svc = new DepsService(adapter, logger);

    await svc.deps('H5P.Blanks', 'view');

    expect(logger.log).toHaveBeenCalledWith('!!! unregistered required H5P.RequiredDep library');
  });
});
