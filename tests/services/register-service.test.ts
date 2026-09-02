import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterService } from '../../src/services/register-service.ts';
import type { IRegisterAdapter } from '../../src/adapters/register-adapter.ts';

function makeAdapter(overrides: Partial<IRegisterAdapter> = {}): IRegisterAdapter {
  return {
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    registryEntryFromRepoUrl: vi.fn().mockResolvedValue({}),
    readJsonFile: vi.fn().mockReturnValue({}),
    writeJsonFile: vi.fn(),
    ...overrides,
  };
}

describe('RegisterService', () => {
  const registryPath = 'libraryRegistry.json';

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('uses registryEntryFromRepoUrl for http URL', async () => {
    const entry = { 'H5P.Blanks-1.14': { shortName: 'h5p-blanks' } };
    const adapter = makeAdapter({
      registryEntryFromRepoUrl: vi.fn().mockResolvedValue(entry),
    });
    const svc = new RegisterService(adapter, registryPath);
    const result = await svc.register('https://github.com/h5p/h5p-blanks');
    expect(adapter.registryEntryFromRepoUrl).toHaveBeenCalledWith('https://github.com/h5p/h5p-blanks');
    expect(adapter.readJsonFile).not.toHaveBeenCalled();
    expect(result).toBe(entry);
  });

  it('uses registryEntryFromRepoUrl for git@ URL', async () => {
    const entry = { 'H5P.Blanks-1.14': {} };
    const adapter = makeAdapter({
      registryEntryFromRepoUrl: vi.fn().mockResolvedValue(entry),
    });
    const svc = new RegisterService(adapter, registryPath);
    await svc.register('git@github.com:h5p/h5p-blanks.git');
    expect(adapter.registryEntryFromRepoUrl).toHaveBeenCalledWith('git@github.com:h5p/h5p-blanks.git');
    expect(adapter.readJsonFile).not.toHaveBeenCalled();
  });

  it('uses readJsonFile for file path input', async () => {
    const entry = { 'H5P.Blanks-1.14': {} };
    const adapter = makeAdapter({
      readJsonFile: vi.fn().mockReturnValue(entry),
    });
    const svc = new RegisterService(adapter, registryPath);
    const result = await svc.register('/path/to/registry.json');
    expect(adapter.readJsonFile).toHaveBeenCalledWith('/path/to/registry.json');
    expect(adapter.registryEntryFromRepoUrl).not.toHaveBeenCalled();
    expect(result).toBe(entry);
  });

  it('merges entry into reversed registry and writes file', async () => {
    const existing = { 'H5P.Other-1.0': {} };
    const entry = { 'H5P.Blanks-1.14': {} };
    const adapter = makeAdapter({
      getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: { ...existing } }),
      readJsonFile: vi.fn().mockReturnValue(entry),
    });
    const svc = new RegisterService(adapter, registryPath);
    await svc.register('/some/path.json');
    expect(adapter.writeJsonFile).toHaveBeenCalledWith(
      registryPath,
      { ...existing, ...entry }
    );
  });

  it('returns the entry from register()', async () => {
    const entry = { 'H5P.Blanks-1.14': { shortName: 'h5p-blanks' } };
    const adapter = makeAdapter({
      registryEntryFromRepoUrl: vi.fn().mockResolvedValue(entry),
    });
    const svc = new RegisterService(adapter, registryPath);
    const result = await svc.register('https://github.com/h5p/h5p-blanks');
    expect(result).toBe(entry);
  });
});
