import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepsService } from '../../src/services/deps-service.ts';
import type { IDepsAdapter } from '../../src/adapters/deps-adapter.ts';

describe('DepsService', () => {
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
  });

  it('logs registered dep name when id is truthy', async () => {
    const adapter: IDepsAdapter = {
      computeDependencies: vi.fn().mockResolvedValue({ 'h5p-core': { id: 1, optional: false } }),
    };
    const svc = new DepsService(adapter, logger);
    await svc.deps('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('h5p-core');
  });

  it('logs unregistered optional message when id is falsy and optional=true', async () => {
    const adapter: IDepsAdapter = {
      computeDependencies: vi.fn().mockResolvedValue({ 'h5p-optional': { id: undefined, optional: true } }),
    };
    const svc = new DepsService(adapter, logger);
    await svc.deps('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('!!! unregistered optional h5p-optional library');
  });

  it('logs unregistered required message when id is falsy and optional=false', async () => {
    const adapter: IDepsAdapter = {
      computeDependencies: vi.fn().mockResolvedValue({ 'h5p-required': { id: null, optional: false } }),
    };
    const svc = new DepsService(adapter, logger);
    await svc.deps('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('!!! unregistered required h5p-required library');
  });

  it('forwards all args to adapter', async () => {
    const adapter: IDepsAdapter = { computeDependencies: vi.fn().mockResolvedValue({}) };
    const svc = new DepsService(adapter, logger);
    await svc.deps('h5p-blanks', 'view', '1.14', '/folder');
    expect(adapter.computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'view', '1.14', '/folder');
  });

  it('propagates rejection', async () => {
    const adapter: IDepsAdapter = { computeDependencies: vi.fn().mockRejectedValue(new Error('fail')) };
    const svc = new DepsService(adapter, logger);
    await expect(svc.deps('h5p-blanks')).rejects.toThrow('fail');
  });
});
