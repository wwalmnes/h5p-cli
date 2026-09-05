import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupService } from '../../src/services/setup-service.ts';
import { RegisterService } from '../../src/services/register-service.ts';
import type { ISetupAdapter } from '../../src/adapters/setup-adapter.ts';
import type { IRegisterAdapter } from '../../src/adapters/register-adapter.ts';

function makeSetupAdapter(overrides: Partial<ISetupAdapter> = {}): ISetupAdapter {
  return {
    machineToShort: vi.fn().mockReturnValue('h5p-blanks'),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    installDependencies: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeRegisterAdapter(overrides: Partial<IRegisterAdapter> = {}): IRegisterAdapter {
  return {
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    registryEntryFromRepoUrl: vi.fn().mockResolvedValue({}),
    readJsonFile: vi.fn().mockReturnValue({}),
    writeJsonFile: vi.fn(),
    ...overrides,
  };
}

describe('SetupService', () => {
  const librariesFolder = 'libraries';
  let logger: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn() };
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('does not call registerService.register for non-URL library', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerAdapter = makeRegisterAdapter();
    const registerSvc = new RegisterService(registerAdapter, 'libraryRegistry.json');
    const registerSpy = vi.spyOn(registerSvc, 'register');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('calls registerService.register for http URL', async () => {
    const entry = { 'H5P.Blanks-1.14': {} };
    const registerAdapter = makeRegisterAdapter({
      registryEntryFromRepoUrl: vi.fn().mockResolvedValue(entry),
    });
    const setupAdapter = makeSetupAdapter({
      machineToShort: vi.fn().mockReturnValue('h5p-blanks'),
    });
    const registerSvc = new RegisterService(registerAdapter, 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('https://github.com/h5p/h5p-blanks');
    expect(registerAdapter.registryEntryFromRepoUrl).toHaveBeenCalledWith('https://github.com/h5p/h5p-blanks');
    expect(setupAdapter.machineToShort).toHaveBeenCalledWith('H5P.Blanks-1.14');
  });

  it('uses action=download when download=1', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks', undefined, '1');
    expect(setupAdapter.installDependencies).toHaveBeenCalledWith('download', expect.any(Object), expect.any(Boolean), expect.any(Array), undefined);
  });

  it('uses action=clone when download is not set', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(setupAdapter.installDependencies).toHaveBeenCalledWith('clone', expect.any(Object), expect.any(Boolean), expect.any(Array), undefined);
  });

  it('passes latest=false when version is provided', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks', '1.14');
    expect(setupAdapter.installDependencies).toHaveBeenCalledWith(expect.any(String), expect.any(Object), false, expect.any(Array), undefined);
  });

  it('passes latest=true when version is absent', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(setupAdapter.installDependencies).toHaveBeenCalledWith(expect.any(String), expect.any(Object), true, expect.any(Array), undefined);
  });

  it('collects optional missing dep in report, does not throw', async () => {
    const setupAdapter = makeSetupAdapter({
      computeDependencies: vi.fn().mockResolvedValue({
        'h5p-optional-lib': { id: undefined, optional: true, parent: 'h5p-blanks' },
      }),
    });
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('!!! missing optional libraries');
    expect(logger.log).toHaveBeenCalledWith('h5p-optional-lib (optional) required by h5p-blanks');
  });

  it('throws for missing required dep', async () => {
    const setupAdapter = makeSetupAdapter({
      computeDependencies: vi.fn().mockResolvedValue({
        'h5p-required-lib': { id: undefined, optional: false, parent: 'h5p-blanks' },
      }),
    });
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await expect(svc.setup('h5p-blanks')).rejects.toThrow('unregistered h5p-required-lib library required by h5p-blanks');
  });

  /* The whole point of the collapse: this used to be N+4 resolutions and two
  install passes with the skip list reset between them. Equivalence of the
  resulting graph is pinned in tests/lib/setup-graph-equivalence.test.ts. */
  it('resolves the graph once, in edit mode, and installs it once', async () => {
    const graph = { 'h5p-core': { id: 'H5P.Core' }, 'h5p-blanks': { id: 'H5P.Blanks' } };
    const setupAdapter = makeSetupAdapter({
      computeDependencies: vi.fn().mockResolvedValue(graph),
    });
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);

    await svc.setup('h5p-blanks');

    expect(setupAdapter.computeDependencies).toHaveBeenCalledTimes(1);
    expect(setupAdapter.computeDependencies).toHaveBeenCalledWith('h5p-blanks', 'edit', undefined);
    expect(setupAdapter.installDependencies).toHaveBeenCalledTimes(1);
    expect(setupAdapter.installDependencies).toHaveBeenCalledWith('clone', graph, true, [], undefined);
    expect(setupAdapter.getWithDependencies).not.toHaveBeenCalled();
  });

  it('logs done message', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('> done setting up h5p-blanks');
  });

  it('logs action and folder for the install step', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith(`> clone h5p-blanks library dependencies into "${librariesFolder}" folder`);
  });
});
