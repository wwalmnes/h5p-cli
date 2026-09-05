import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';
// @ts-ignore - no type declarations for superagent v8 in this project
import superAgent from 'superagent';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(() => ({ status: 0, stdout: '', stderr: '', error: undefined })),
  spawn: vi.fn(),
}));

vi.mock('superagent', () => ({ default: { get: vi.fn() } }));

const REGISTRY = {
  'H5P.Blanks': { id: 'H5P.Blanks', shortName: 'h5p-blanks', org: 'h5p', repoName: 'h5p-blanks' },
};

const LIBRARY_JSON = {
  machineName: 'H5P.Blanks',
  title: 'Fill in the Blanks',
  majorVersion: 1,
  minorVersion: 14,
  patchVersion: 0,
  runnable: 1,
};

/* superAgent.get(url).set(...).ok(fn) is awaited for its { status, text } */
const respond = (status: number, text: string) => {
  const chain: any = { set: () => chain, ok: () => Promise.resolve({ status, text }) };
  return chain;
};

/* the raw host serves library.json/semantics.json off different URLs */
const rawRoutes = (routes: Record<string, [number, string]>) =>
  vi.mocked(superAgent.get).mockImplementation((url: string) => {
    const file = url.endsWith('semantics.json') ? 'semantics.json' : 'library.json';
    const [status, text] = routes[file] ?? [404, '404: Not Found'];
    return respond(status, text);
  });

const gitCloneCalls = () =>
  vi.mocked(execSync).mock.calls.filter(c => String(c[0]).startsWith('git clone'));

describe('metadata transport', () => {
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
    fs.writeFileSync('libraryRegistry.json', JSON.stringify(REGISTRY));
    delete process.env.H5P_NO_RAW;

    // a "successful" clone materialises the files getRepoFile then reads
    vi.mocked(execSync).mockImplementation(((command: string) => {
      const match = /^git clone \S+ (\S+)/.exec(command);
      if (match) {
        fs.mkdirSync(match[1], { recursive: true });
        fs.writeFileSync(`${match[1]}/library.json`, JSON.stringify(LIBRARY_JSON));
        fs.writeFileSync(`${match[1]}/semantics.json`, JSON.stringify([]));
      }
      return Buffer.from('');
    }) as any);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    delete process.env.H5P_NO_RAW;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('reads metadata over http and never clones for a registered library', async () => {
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [200, JSON.stringify([])],
    });

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(gitCloneCalls()).toHaveLength(0);
  });

  it('treats a 404 semantics.json on a reachable repo as absent, without cloning', async () => {
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [404, '404: Not Found'],
    });

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(gitCloneCalls()).toHaveLength(0);
  });

  it('falls back to cloning when the raw host will not serve library.json', async () => {
    // a private repo: raw 404s, but git clone succeeds via the credential helper
    rawRoutes({ 'library.json': [404, '404: Not Found'] });

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(gitCloneCalls().length).toBeGreaterThan(0);
  });

  it('falls back to cloning when the raw host is unreachable', async () => {
    vi.mocked(superAgent.get).mockImplementation(() => {
      const chain: any = { set: () => chain, ok: () => Promise.reject(new Error('ENOTFOUND')) };
      return chain;
    });

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(gitCloneCalls().length).toBeGreaterThan(0);
  });

  it('H5P_NO_RAW forces cloning and issues no http request', async () => {
    process.env.H5P_NO_RAW = '1';
    rawRoutes({ 'library.json': [200, JSON.stringify(LIBRARY_JSON)] });

    await logic.computeDependencies('h5p-blanks', 'view');

    expect(superAgent.get).not.toHaveBeenCalled();
    expect(gitCloneCalls().length).toBeGreaterThan(0);
  });

  it('caches metadata on disk so a repeated resolution issues no further requests', async () => {
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [200, JSON.stringify([])],
    });

    await logic.computeDependencies('h5p-blanks', 'view');
    const afterFirst = vi.mocked(superAgent.get).mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    expect(fs.existsSync('temp/.metadata')).toBe(true);

    await logic.computeDependencies('h5p-blanks', 'view');

    expect(vi.mocked(superAgent.get).mock.calls.length).toBe(afterFirst);
  });

  it('prefers an existing temp clone over the network', async () => {
    fs.mkdirSync('temp/h5p-blanks_master', { recursive: true });
    fs.writeFileSync('temp/h5p-blanks_master/library.json', JSON.stringify(LIBRARY_JSON));
    fs.writeFileSync('temp/h5p-blanks_master/semantics.json', JSON.stringify([]));
    rawRoutes({ 'library.json': [200, JSON.stringify(LIBRARY_JSON)] });

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(superAgent.get).not.toHaveBeenCalled();
    expect(gitCloneCalls()).toHaveLength(0);
  });
});
