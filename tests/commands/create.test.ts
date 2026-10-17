import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createCommand } from '../../src/commands/create.ts';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';

vi.mock('../../src/config/loader', () => ({
  default: { folders: { libraries: 'libraries' } },
}));

describe('createCommand', () => {
  let fixture: Fixture;
  let stderr: string;
  let dir: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    vi.spyOn(process, 'cwd').mockReturnValue(fixture.dir);
    dir = path.join(fixture.dir, 'libraries', 'H5P.MyContentType-1.0');
    stderr = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture.cleanup();
    process.exitCode = 0;
  });

  it('scaffolds library.json, semantics.json and index.js', async () => {
    await createCommand().parseAsync(['node', 'h5p', 'MyContentType']);

    expect(fs.readdirSync(dir).sort()).toEqual(['index.js', 'library.json', 'semantics.json']);
    const library = JSON.parse(fs.readFileSync(path.join(dir, 'library.json'), 'utf-8'));
    expect(library.machineName).toBe('H5P.MyContentType');
    expect(library.preloadedJs).toEqual([{ path: 'index.js' }]);
    expect(fs.readFileSync(path.join(dir, 'index.js'), 'utf-8')).toContain('H5P.MyContentType');
    expect(stderr).toContain(`created ${dir}`);
  });

  it('leaves an existing library alone', async () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'library.json'), 'mine');

    await createCommand().parseAsync(['node', 'h5p', 'MyContentType']);

    expect(fs.readFileSync(path.join(dir, 'library.json'), 'utf-8')).toBe('mine');
    expect(stderr).toContain('already exists');
  });

  it('rejects an empty name', async () => {
    await createCommand().parseAsync(['node', 'h5p', '']);
    expect(fs.existsSync(path.join(fixture.dir, 'libraries'))).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});
