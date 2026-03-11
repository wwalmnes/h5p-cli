import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListService } from '../../src/services/list-service';
import type { IListAdapter } from '../../src/adapters/list-adapter';

function makeAdapter(regular: Record<string, any>): IListAdapter {
  return {
    getRegistry: vi.fn().mockResolvedValue({ regular, reversed: {} }),
  };
}

describe('ListService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('logs fetching message', async () => {
    const adapter = makeAdapter({});
    const svc = new ListService(adapter, logger);
    await svc.list();
    expect(logger.log).toHaveBeenCalledWith('> fetching h5p library registry');
  });

  it('logs library name when reversed=0', async () => {
    const adapter = makeAdapter({ 'h5p-blanks': { id: 42, org: 'h5p' } });
    const svc = new ListService(adapter, logger);
    await svc.list(0);
    expect(logger.log).toHaveBeenCalledWith('h5p-blanks (h5p)');
  });

  it('logs library id when reversed=1', async () => {
    const adapter = makeAdapter({ 'h5p-blanks': { id: 42, org: 'h5p' } });
    const svc = new ListService(adapter, logger);
    await svc.list(1);
    expect(logger.log).toHaveBeenCalledWith('42 (h5p)');
  });

  it('passes ignoreFile to adapter', async () => {
    const adapter = makeAdapter({});
    const svc = new ListService(adapter, logger);
    await svc.list(0, 1);
    expect(adapter.getRegistry).toHaveBeenCalledWith(1);
  });

  it('propagates rejection', async () => {
    const adapter: IListAdapter = { getRegistry: vi.fn().mockRejectedValue(new Error('net error')) };
    const svc = new ListService(adapter, logger);
    await expect(svc.list()).rejects.toThrow('net error');
  });
});
