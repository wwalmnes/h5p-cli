import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SetupService } from '../../src/services/setup-service';
import type { ISetupAdapter } from '../../src/adapters/setup-adapter';

function makeLogger() {
  return { log: vi.fn() };
}

function makeAdapter(overrides: Partial<ISetupAdapter> = {}): ISetupAdapter {
  return {
    machineToShort: vi.fn().mockReturnValue('h5p-blanks'),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeRegisterService(entry: Record<string, any> = { 'H5P.Blanks': { id: 'h5p-blanks' } }) {
  return { register: vi.fn().mockResolvedValue(entry) } as any;
}

describe('SetupService integration', () => {
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
  });

  it('calls getWithDependencies 3 times when view deps have one registered dep', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn()
        .mockResolvedValueOnce({ 'H5P.DragText': { id: 'h5p-drag-text', org: 'h5p' } }) // view pass
        .mockResolvedValueOnce({}), // edit pass
      getWithDependencies: vi.fn().mockResolvedValue([]),
    });
    const svc = new SetupService(adapter, makeRegisterService(), 'libraries', logger);

    await svc.setup('H5P.Blanks');

    expect(adapter.getWithDependencies).toHaveBeenCalledTimes(3);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('done setting up H5P.Blanks'));
  });

  it('logs missing optional library when dep has no id and is optional', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn()
        .mockResolvedValueOnce({ 'H5P.OptDep': { optional: true, parent: 'H5P.Blanks' } }) // view
        .mockResolvedValueOnce({}), // edit
    });
    const svc = new SetupService(adapter, makeRegisterService(), 'libraries', logger);

    await svc.setup('H5P.Blanks');

    expect(logger.log).toHaveBeenCalledWith('!!! missing optional libraries');
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('H5P.OptDep')
    );
  });

  it('throws when dep has no id and is not optional', async () => {
    const adapter = makeAdapter({
      computeDependencies: vi.fn()
        .mockResolvedValueOnce({ 'H5P.RequiredDep': { optional: false, parent: 'H5P.Blanks' } }) // view
        .mockResolvedValueOnce({}), // edit
    });
    const svc = new SetupService(adapter, makeRegisterService(), 'libraries', logger);

    await expect(svc.setup('H5P.Blanks')).rejects.toThrow(
      'unregistered H5P.RequiredDep library required by H5P.Blanks'
    );
  });

  it('calls registerService.register then machineToShort when input is a URL', async () => {
    const entry = { 'H5P.Blanks': { id: 'h5p-blanks' } };
    const registerService = makeRegisterService(entry);
    const adapter = makeAdapter();
    const svc = new SetupService(adapter, registerService, 'libraries', logger);

    await svc.setup('http://github.com/h5p/h5p-blanks');

    expect(registerService.register).toHaveBeenCalledWith('http://github.com/h5p/h5p-blanks');
    expect(adapter.machineToShort).toHaveBeenCalledWith('H5P.Blanks');
  });
});
