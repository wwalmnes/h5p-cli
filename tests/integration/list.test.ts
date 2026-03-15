import { describe, it, expect, vi } from 'vitest';
import { ListService } from '../../src/services/list-service';
import type { IListAdapter } from '../../src/adapters/list-adapter';

const REGISTRY = {
  regular: {
    'H5P.Blanks': { id: 'h5p-blanks', org: 'h5p' },
    'H5P.DragText': { id: 'h5p-drag-text', org: 'otherorg' },
  },
  reversed: {},
};

function makeAdapter(ignoreFile?: boolean): IListAdapter {
  const getRegistry = vi.fn().mockResolvedValue(REGISTRY);
  return { getRegistry };
}

describe('ListService integration', () => {
  it('always logs the fetching message', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter();
    const svc = new ListService(adapter, logger);

    await svc.list();

    expect(logger.log).toHaveBeenCalledWith('> fetching h5p library registry');
  });

  it('logs "name (org)" when reversed is false', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter();
    const svc = new ListService(adapter, logger);

    await svc.list(false);

    expect(logger.log).toHaveBeenCalledWith('H5P.Blanks (h5p)');
    expect(logger.log).toHaveBeenCalledWith('H5P.DragText (otherorg)');
  });

  it('logs "id (org)" when reversed is true', async () => {
    const logger = { log: vi.fn() };
    const adapter = makeAdapter();
    const svc = new ListService(adapter, logger);

    await svc.list(true);

    expect(logger.log).toHaveBeenCalledWith('h5p-blanks (h5p)');
    expect(logger.log).toHaveBeenCalledWith('h5p-drag-text (otherorg)');
  });

  it('passes ignoreFile through to adapter', async () => {
    const logger = { log: vi.fn() };
    const getRegistry = vi.fn().mockResolvedValue(REGISTRY);
    const adapter: IListAdapter = { getRegistry };
    const svc = new ListService(adapter, logger);

    await svc.list(false, true);

    expect(getRegistry).toHaveBeenCalledWith(true);
  });
});
