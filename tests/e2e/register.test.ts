import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

vi.mock('../../logic', () => ({
  default: {
    clone: vi.fn(),
    computeDependencies: vi.fn().mockResolvedValue({}),
    getWithDependencies: vi.fn().mockResolvedValue([]),
    getRegistry: vi.fn().mockResolvedValue({ regular: {}, reversed: {} }),
    registryEntryFromRepoUrl: vi.fn().mockReturnValue({
      'H5P.ImageHotspots 1 0': { id: 'h5p-image-hotspots', org: 'h5p', repo: 'h5p-image-hotspots' },
    }),
    machineToShort: vi.fn(),
    tags: vi.fn(),
    export: vi.fn(),
    import: vi.fn(),
    verifySetup: vi.fn(),
  },
}));

describe('register — end-to-end', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
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

  it('calls registryEntryFromRepoUrl when given an http URL', async () => {
    const logic = await import('../../logic.ts');
    const { registerCommand } = await import('../../src/commands/register.ts');

    await registerCommand().parseAsync(['node', 'h5p', 'https://github.com/h5p/h5p-image-hotspots']);

    expect(logic.default.registryEntryFromRepoUrl).toHaveBeenCalledWith(
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
