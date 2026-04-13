import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MissingService } from '../../src/services/missing-service.ts';
import type { IMissingAdapter } from '../../src/adapters/missing-adapter.ts';

function makeAdapter(overrides: Partial<IMissingAdapter> = {}): IMissingAdapter {
  return {
    parseLibraryFolders: vi.fn().mockResolvedValue({ 1: '/libs/h5p-blanks', 2: '/libs/h5p-core' }),
    getRegistry: vi.fn().mockResolvedValue({
      regular: { 'h5p-blanks': { id: 1 }, 'h5p-core': { id: 2 } },
      reversed: {},
    }),
    computeDependencies: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe('MissingService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('logs no unregistered message when nothing is missing', async () => {
    const adapter = makeAdapter();
    const svc = new MissingService(adapter, logger);
    await svc.missing('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('> h5p-blanks has no unregistered dependencies');
  });

  it('logs optional dep as optional', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn().mockResolvedValue({ 'h5p-unknown': { id: undefined, optional: true } }),
    });
    const svc = new MissingService(adapter, logger);
    await svc.missing('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('> unregistered dependencies for h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('h5p-unknown (optional)');
  });

  it('logs required dep as required', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn().mockResolvedValue({ 'h5p-unknown': { id: undefined, optional: false } }),
    });
    const svc = new MissingService(adapter, logger);
    await svc.missing('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('h5p-unknown (required)');
  });

  it('once set to required (false), is never overwritten to optional (true)', async () => {
    // First call returns required, second call (edit) returns optional for same item
    let callCount = 0;
    const adapter = makeAdapter({
      computeDependencies: vi.fn().mockImplementation((_lib, mode) => {
        if (mode === 'view') {
          return Promise.resolve({ 'h5p-unknown': { id: undefined, optional: false } });
        }
        return Promise.resolve({ 'h5p-unknown': { id: undefined, optional: true } });
      }),
    });
    const svc = new MissingService(adapter, logger);
    await svc.missing('h5p-blanks');
    // Should be logged as required, not optional
    expect(logger.log).toHaveBeenCalledWith('h5p-unknown (required)');
    expect(logger.log).not.toHaveBeenCalledWith('h5p-unknown (optional)');
  });

  it('propagates rejection', async () => {
    const adapter = makeAdapter({
      parseLibraryFolders: vi.fn().mockRejectedValue(new Error('fs error')),
    });
    const svc = new MissingService(adapter, logger);
    await expect(svc.missing('h5p-blanks')).rejects.toThrow('fs error');
  });
});
