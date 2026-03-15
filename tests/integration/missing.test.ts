import { describe, it, expect, vi } from 'vitest';
import { MissingService } from '../../src/services/missing-service';
import type { IMissingAdapter } from '../../src/adapters/missing-adapter';

function makeAdapter(overrides: Partial<IMissingAdapter> = {}): IMissingAdapter {
  return {
    parseLibraryFolders: vi.fn().mockResolvedValue({ 1: '/libraries/h5p-blanks' }),
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    computeDependencies: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

const BLANKS_REGISTRY = {
  regular: { 'H5P.Blanks': { id: 1, org: 'h5p' } },
  reversed: {},
};

describe('MissingService integration', () => {
  it('logs "has no unregistered dependencies" when all deps are in registry', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      getRegistry: vi.fn().mockResolvedValue({
        regular: {
          'H5P.Blanks': { id: 1, org: 'h5p' },
          'H5P.JoubelUI': { id: 2, org: 'h5p' },
        },
        reversed: {},
      }),
      parseLibraryFolders: vi.fn().mockResolvedValue({ 1: '/libs/h5p-blanks', 2: '/libs/h5p-joubel-ui' }),
      computeDependencies: vi.fn().mockResolvedValue({ 'H5P.JoubelUI': { optional: false } }),
    });
    const svc = new MissingService(adapter, logger);

    await svc.missing('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith('> H5P.Blanks has no unregistered dependencies');
  });

  it('logs optional dep as (optional) when missing from registry', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      getRegistry: vi.fn().mockResolvedValue(BLANKS_REGISTRY),
      computeDependencies: vi.fn()
        .mockResolvedValueOnce({ 'H5P.Missing': { optional: true } }) // view
        .mockResolvedValueOnce({}), // edit
    });
    const svc = new MissingService(adapter, logger);

    await svc.missing('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith('H5P.Missing (optional)');
  });

  it('logs required dep as (required) when missing from registry', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      getRegistry: vi.fn().mockResolvedValue(BLANKS_REGISTRY),
      computeDependencies: vi.fn()
        .mockResolvedValueOnce({ 'H5P.Required': { optional: false } }) // view
        .mockResolvedValueOnce({}), // edit
    });
    const svc = new MissingService(adapter, logger);

    await svc.missing('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith('H5P.Required (required)');
  });

  it('reports the same unregistered dep only once when it appears in both view and edit', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      getRegistry: vi.fn().mockResolvedValue(BLANKS_REGISTRY),
      computeDependencies: vi.fn()
        .mockResolvedValueOnce({ 'H5P.Shared': { optional: true } }) // view
        .mockResolvedValueOnce({ 'H5P.Shared': { optional: true } }), // edit
    });
    const svc = new MissingService(adapter, logger);

    await svc.missing('H5P.Blanks');

    const logCalls = logger.log.mock.calls.filter(([msg]) => msg === 'H5P.Shared (optional)');
    expect(logCalls).toHaveLength(1);
  });

  it('recursively checks sub-deps of registered deps', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter({
      getRegistry: vi.fn().mockResolvedValue({
        regular: {
          'H5P.Blanks': { id: 1, org: 'h5p' },
          'H5P.JoubelUI': { id: 2, org: 'h5p' },
        },
        reversed: {},
      }),
      parseLibraryFolders: vi.fn().mockResolvedValue({ 1: '/libs/h5p-blanks', 2: '/libs/h5p-joubel-ui' }),
      computeDependencies: vi.fn()
        .mockResolvedValueOnce({ 'H5P.JoubelUI': { optional: false } }) // view for H5P.Blanks
        .mockResolvedValueOnce({ 'H5P.SubDep': { optional: false } }) // edit for H5P.JoubelUI (sub-dep check)
        .mockResolvedValueOnce({}), // edit for H5P.Blanks
    });
    const svc = new MissingService(adapter, logger);

    await svc.missing('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith('H5P.SubDep (required)');
  });
});
