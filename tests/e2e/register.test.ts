import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

vi.mock('../../src/h5p/registry.ts', () => ({
  getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
  registryEntryFromRepoUrl: vi.fn().mockReturnValue({
    'H5P.ImageHotspots 1 0': { id: 'h5p-image-hotspots', org: 'h5p', repo: 'h5p-image-hotspots' },
  }),
}));

describe('register — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.clearAllMocks();
  });

  it('reads a local registry file and writes the merged result to libraryRegistry.json', async () => {
    const entry = { 'H5P.Blanks 1 14': { id: 'h5p-blanks', org: 'h5p', repo: 'h5p-blanks' } };
    const inputPath = path.join(fixture.dir, 'input-registry.json');
    fs.writeFileSync(inputPath, JSON.stringify(entry));

    const { registerCommand } = await import('../../src/commands/register.ts');
    await registerCommand().parseAsync(['node', 'h5p', inputPath]);

    const outputPath = path.join(fixture.dir, 'libraryRegistry.json');
    expect(fs.existsSync(outputPath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(written).toMatchObject(entry);
  });

  it('keeps the entries already in the registry', async () => {
    const registry = await import('../../src/h5p/registry.ts');
    vi.mocked(registry.getRegistry).mockResolvedValueOnce({
      regular: {},
      reversed: { 'H5P.Other 1 0': { id: 'h5p-other' } },
    } as any);
    const inputPath = path.join(fixture.dir, 'input-registry.json');
    fs.writeFileSync(inputPath, JSON.stringify({ 'H5P.Blanks 1 14': { id: 'h5p-blanks' } }));

    const { registerCommand } = await import('../../src/commands/register.ts');
    await registerCommand().parseAsync(['node', 'h5p', inputPath]);

    const written = JSON.parse(fs.readFileSync(path.join(fixture.dir, 'libraryRegistry.json'), 'utf-8'));
    expect(Object.keys(written).sort()).toEqual(['H5P.Blanks 1 14', 'H5P.Other 1 0']);
  });

  it('calls registryEntryFromRepoUrl when given an http URL', async () => {
    const registry = await import('../../src/h5p/registry.ts');
    const { registerCommand } = await import('../../src/commands/register.ts');

    await registerCommand().parseAsync(['node', 'h5p', 'https://github.com/h5p/h5p-image-hotspots']);

    expect(registry.registryEntryFromRepoUrl).toHaveBeenCalledWith(
      'https://github.com/h5p/h5p-image-hotspots'
    );
  });

  it('writes the URL-derived entry to libraryRegistry.json', async () => {
    const { registerCommand } = await import('../../src/commands/register.ts');

    await registerCommand().parseAsync(['node', 'h5p', 'https://github.com/h5p/h5p-image-hotspots']);

    const outputPath = path.join(fixture.dir, 'libraryRegistry.json');
    expect(fs.existsSync(outputPath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(written).toHaveProperty('H5P.ImageHotspots 1 0');
  });
});
