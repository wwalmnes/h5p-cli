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
    expect(setupAdapter.getWithDependencies).toHaveBeenCalledWith('download', expect.any(String), expect.any(String), expect.any(Boolean), expect.any(Array));
  });

  it('uses action=clone when download is not set', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(setupAdapter.getWithDependencies).toHaveBeenCalledWith('clone', expect.any(String), expect.any(String), expect.any(Boolean), expect.any(Array));
  });

  it('passes latest=false when version is provided', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks', '1.14');
    expect(setupAdapter.getWithDependencies).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(String), false, expect.any(Array));
  });

  it('passes latest=true when version is absent', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(setupAdapter.getWithDependencies).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(String), true, expect.any(Array));
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

  it('passes accumulated toSkip from view pass to edit pass in pre-check loop', async () => {
    const viewDeps = {
      'h5p-core': { id: 1 },
    };
    const getWithDepsMock = vi.fn()
      .mockResolvedValueOnce(['h5p-core']) // pre-check: item 'h5p-core' edit pass
      .mockResolvedValueOnce(['h5p-core', 'h5p-blanks']) // main: view
      .mockResolvedValueOnce(['h5p-core', 'h5p-blanks', 'h5p-editor']); // main: edit
    const setupAdapter = makeSetupAdapter({
      computeDependencies: vi.fn().mockResolvedValue(viewDeps),
      getWithDependencies: getWithDepsMock,
    });
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    // first call: pre-check item with toSkip=[]
    expect(getWithDepsMock.mock.calls[0][4]).toEqual([]);
    // second call: main view with toSkip reset to []
    expect(getWithDepsMock.mock.calls[1][4]).toEqual([]);
  });

  it('logs done message', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith('> done setting up h5p-blanks');
  });

  it('logs action and folder for view and edit steps', async () => {
    const setupAdapter = makeSetupAdapter();
    const registerSvc = new RegisterService(makeRegisterAdapter(), 'libraryRegistry.json');
    const svc = new SetupService(setupAdapter, registerSvc, librariesFolder, logger);
    await svc.setup('h5p-blanks');
    expect(logger.log).toHaveBeenCalledWith(`> clone h5p-blanks library "view" dependencies into "${librariesFolder}" folder`);
    expect(logger.log).toHaveBeenCalledWith(`> clone h5p-blanks library "edit" dependencies into "${librariesFolder}" folder`);
  });
});
