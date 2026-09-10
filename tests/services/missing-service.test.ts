import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MissingService } from '../../src/services/missing-service.ts';
import type { IMissingAdapter } from '../../src/adapters/missing-adapter.ts';

function makeAdapter(overrides: Partial<IMissingAdapter> = {}): IMissingAdapter {
  return {
    parseLibraryFolders: vi.fn().mockResolvedValue({ 1: 'h5p-blanks', 2: 'h5p-core' }),
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

  /* The whole graph is resolved once. It used to take the view graph, an edit
  graph rooted at every registered library in it, and then the root's edit
  graph - see missing-graph-equivalence.test.ts for why one pass covers them. */
  it('resolves the graph exactly once, in edit mode, from the local folder', async () => {
    const adapter = makeAdapter();
    const svc = new MissingService(adapter, logger);
    await svc.missing('h5p-blanks');
    expect(adapter.computeDependencies).toHaveBeenCalledTimes(1);
    expect(adapter.computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'edit', null, 'h5p-blanks');
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

  it('treats an entry with no optional flag as required', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn().mockResolvedValue({ 'h5p-unknown': { id: undefined } }),
    });
    const svc = new MissingService(adapter, logger);
    await svc.missing('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('h5p-unknown (required)');
  });

  it('reports only the entries the registry does not know about', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn().mockResolvedValue({
        'h5p-blanks': { id: 1, optional: false },
        'h5p-core': { id: 2, optional: true },
        'h5p-unknown': { id: undefined, optional: true },
      }),
    });
    const svc = new MissingService(adapter, logger);
    await svc.missing('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('h5p-unknown (optional)');
    expect(logger.log).toHaveBeenCalledTimes(2);
  });

  /* An unrecognised name used to throw a TypeError reading .id off the missing
  registry entry; it now reaches the resolver, which names the library. */
  it('hands an unregistered library to the resolver instead of crashing on the lookup', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn().mockRejectedValue(new Error('unregistered h5p-nope library')),
    });
    const svc = new MissingService(adapter, logger);
    await expect(svc.missing('h5p-nope')).rejects.toThrow('unregistered h5p-nope library');
    expect(adapter.computeDependencies).toHaveBeenCalledWith('h5p-nope', 'edit', null, undefined);
  });

  it('propagates rejection', async () => {
    const adapter = makeAdapter({
      parseLibraryFolders: vi.fn().mockRejectedValue(new Error('fs error')),
    });
    const svc = new MissingService(adapter, logger);
    await expect(svc.missing('h5p-blanks')).rejects.toThrow('fs error');
  });
});
