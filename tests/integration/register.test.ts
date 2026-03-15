import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RegisterService } from '../../src/services/register-service';
import type { IRegisterAdapter } from '../../src/adapters/register-adapter';
import { createEmptyProject, type Fixture } from '../helpers/fixture';

function makeRealFsAdapter(
  baseDir: string,
  registryReversedFile: string,
  overrides: Partial<IRegisterAdapter> = {}
): IRegisterAdapter {
  return {
    getRegistry: vi.fn().mockResolvedValue({
      regular: {},
      reversed: JSON.parse(fs.readFileSync(registryReversedFile, 'utf-8')),
    }),
    registryEntryFromRepoUrl: vi.fn(),
    readJsonFile: (filePath: string) => JSON.parse(fs.readFileSync(filePath, 'utf-8')),
    writeJsonFile: (filePath: string, data: Record<string, any>) =>
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2)),
    ...overrides,
  };
}

describe('RegisterService integration — real filesystem', () => {
  let fixture: Fixture;
  let registryPath: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    registryPath = path.join(fixture.dir, 'registry.reversed.json');
    fs.writeFileSync(
      registryPath,
      JSON.stringify({ 'H5P.Existing': { id: 'h5p-existing', org: 'h5p' } }, null, 2)
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fixture.cleanup();
    vi.restoreAllMocks();
  });

  it('registers from a local file path, writes merged result to disk', async () => {
    const entryFile = path.join(fixture.dir, 'new-entry.json');
    const newEntry = { 'H5P.Blanks': { id: 'h5p-blanks', org: 'h5p' } };
    fs.writeFileSync(entryFile, JSON.stringify(newEntry, null, 2));

    const adapter = makeRealFsAdapter(fixture.dir, registryPath);
    const svc = new RegisterService(adapter, registryPath);

    const result = await svc.register(entryFile);

    expect(result).toEqual(newEntry);

    const written = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    expect(written['H5P.Blanks']).toEqual({ id: 'h5p-blanks', org: 'h5p' });
  });

  it('registers from a URL, calls registryEntryFromRepoUrl and writes to disk', async () => {
    const urlEntry = { 'H5P.NewLib': { id: 'h5p-new-lib', org: 'otherorg' } };
    const registryEntryFromRepoUrl = vi.fn().mockResolvedValue(urlEntry);
    const adapter = makeRealFsAdapter(fixture.dir, registryPath, { registryEntryFromRepoUrl });
    const svc = new RegisterService(adapter, registryPath);

    const result = await svc.register('http://github.com/h5p/h5p-new-lib');

    expect(registryEntryFromRepoUrl).toHaveBeenCalledWith('http://github.com/h5p/h5p-new-lib');
    expect(result).toEqual(urlEntry);

    const written = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    expect(written['H5P.NewLib']).toEqual({ id: 'h5p-new-lib', org: 'otherorg' });
  });

  it('merges new entry into existing registry without overwriting unrelated keys', async () => {
    const entryFile = path.join(fixture.dir, 'another-entry.json');
    const newEntry = { 'H5P.Audio': { id: 'h5p-audio', org: 'h5p' } };
    fs.writeFileSync(entryFile, JSON.stringify(newEntry, null, 2));

    const adapter = makeRealFsAdapter(fixture.dir, registryPath);
    const svc = new RegisterService(adapter, registryPath);

    await svc.register(entryFile);

    const written = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    expect(written['H5P.Existing']).toEqual({ id: 'h5p-existing', org: 'h5p' });
    expect(written['H5P.Audio']).toEqual({ id: 'h5p-audio', org: 'h5p' });
  });
});
