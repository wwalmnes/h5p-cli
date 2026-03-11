import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logic', () => ({
  default: {
    getRegistry: vi.fn(),
    registryEntryFromRepoUrl: vi.fn(),
  },
}));

vi.mock('../../configLoader', () => ({
  default: {
    registry: 'libraryRegistry.json',
    folders: { libraries: 'libraries', temp: 'temp' },
  },
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import logic from '../../logic';
import * as fs from 'fs';
import { RegisterAdapter } from '../../src/adapters/register-adapter';

describe('RegisterAdapter', () => {
  let adapter: RegisterAdapter;

  beforeEach(() => {
    adapter = new RegisterAdapter();
    vi.clearAllMocks();
  });

  it('delegates getRegistry to logic', async () => {
    const registry = { regular: {}, reversed: {} };
    (logic.getRegistry as ReturnType<typeof vi.fn>).mockResolvedValue(registry);
    const result = await adapter.getRegistry();
    expect(logic.getRegistry).toHaveBeenCalled();
    expect(result).toBe(registry);
  });

  it('delegates registryEntryFromRepoUrl to logic', async () => {
    const entry = { 'H5P.Blanks-1.14': { shortName: 'h5p-blanks' } };
    (logic.registryEntryFromRepoUrl as ReturnType<typeof vi.fn>).mockResolvedValue(entry);
    const result = await adapter.registryEntryFromRepoUrl('https://github.com/h5p/h5p-blanks');
    expect(logic.registryEntryFromRepoUrl).toHaveBeenCalledWith('https://github.com/h5p/h5p-blanks');
    expect(result).toBe(entry);
  });

  it('readJsonFile calls fs.readFileSync and parses JSON', () => {
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"key":"value"}');
    const result = adapter.readJsonFile('/some/path.json');
    expect(fs.readFileSync).toHaveBeenCalledWith('/some/path.json', 'utf-8');
    expect(result).toEqual({ key: 'value' });
  });

  it('writeJsonFile calls fs.writeFileSync with JSON.stringify', () => {
    const data = { key: 'value' };
    adapter.writeJsonFile('/some/path.json', data);
    expect(fs.writeFileSync).toHaveBeenCalledWith('/some/path.json', JSON.stringify(data));
  });

  it('propagates rejection from getRegistry', async () => {
    (logic.getRegistry as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('registry error'));
    await expect(adapter.getRegistry()).rejects.toThrow('registry error');
  });
});
