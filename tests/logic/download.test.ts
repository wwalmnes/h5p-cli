import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
// @ts-ignore - no type declarations for superagent v8 in this project
import superAgent from 'superagent';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

vi.mock('superagent', () => ({ default: { get: vi.fn() } }));

/* Stand in for the real archive: extractAllTo writes the <repo>-<ref> root that
GitHub puts inside its zips, derived from the scratch path logic.download built. */
vi.mock('adm-zip', () => ({
  default: class {
    private zipFile: string;
    constructor(zipFile: string) {
      this.zipFile = zipFile;
    }
    extractAllTo(target: string) {
      const name = this.zipFile.split('/').pop()!.replace(/^dl_/, '').replace(/\.zip$/, '');
      const [repo, version] = [name.slice(0, name.lastIndexOf('_')), name.slice(name.lastIndexOf('_') + 1)];
      const root = `${target}/${repo}-${version}`;
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(`${root}/library.json`, JSON.stringify({ machineName: repo }));
    }
  },
}));

describe('logic.download', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    fs.mkdirSync('libraries', { recursive: true });
    fs.mkdirSync('temp', { recursive: true });
    vi.mocked(superAgent.get).mockImplementation(() =>
      Promise.resolve({ _body: Buffer.from('zip') }) as any
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('extracts the archive to the requested target', async () => {
    await logic.download('h5p', 'h5p-blanks', 'master', 'libraries/H5P.Blanks-1.14');

    expect(fs.existsSync('libraries/H5P.Blanks-1.14/library.json')).toBe(true);
  });

  it('concurrent downloads do not clobber each other', async () => {
    await Promise.all([
      logic.download('h5p', 'h5p-blanks', 'master', 'libraries/H5P.Blanks-1.14'),
      logic.download('h5p', 'h5p-joubel-ui', 'master', 'libraries/H5P.JoubelUI-3.3'),
      logic.download('h5p', 'h5p-question', 'master', 'libraries/H5P.Question-1.5'),
    ]);

    expect(JSON.parse(fs.readFileSync('libraries/H5P.Blanks-1.14/library.json', 'utf-8')).machineName).toBe('h5p-blanks');
    expect(JSON.parse(fs.readFileSync('libraries/H5P.JoubelUI-3.3/library.json', 'utf-8')).machineName).toBe('h5p-joubel-ui');
    expect(JSON.parse(fs.readFileSync('libraries/H5P.Question-1.5/library.json', 'utf-8')).machineName).toBe('h5p-question');
  });

  it('cleans up its scratch directory and archive', async () => {
    await logic.download('h5p', 'h5p-blanks', 'master', 'libraries/H5P.Blanks-1.14');

    expect(fs.readdirSync('temp').filter(e => e.startsWith('dl_'))).toEqual([]);
  });

  it('resolves a non-master ref, where the old hardcoded "-master" root was wrong', async () => {
    await logic.download('h5p', 'h5p-blanks', '1.14.0', 'libraries/H5P.Blanks-1.14');

    expect(fs.existsSync('libraries/H5P.Blanks-1.14/library.json')).toBe(true);
  });

  /* The archive URL hardcoded refs/heads/, so a version like 1.14.0 asked
  GitHub for a branch of that name and 404'd — only 'master' ever worked. */
  it('asks for a release tag under refs/tags', async () => {
    await logic.download('h5p', 'h5p-blanks', '1.14.0', 'libraries/H5P.Blanks-1.14');

    expect(vi.mocked(superAgent.get)).toHaveBeenCalledWith(
      'https://github.com/h5p/h5p-blanks/archive/refs/tags/1.14.0.zip');
  });

  it('asks for a branch under refs/heads', async () => {
    await logic.download('h5p', 'h5p-blanks', 'master', 'libraries/H5P.Blanks-1.14');

    expect(vi.mocked(superAgent.get)).toHaveBeenCalledWith(
      'https://github.com/h5p/h5p-blanks/archive/refs/heads/master.zip');
  });
});
