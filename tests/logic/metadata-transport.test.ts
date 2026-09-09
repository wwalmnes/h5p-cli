import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
// @ts-ignore - no type declarations for superagent v8 in this project
import superAgent from 'superagent';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

vi.mock('child_process', () => ({
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

/* the clone transport goes through logic's _execSync, which is spawnSync - it
has to, so a prompt is impossible and git's stderr cannot bypass ui */
const gitCloneCalls = () =>
  vi.mocked(spawnSync).mock.calls.filter(c => String(c[0]).startsWith('git clone'));

/* _refreshClone's fetch carries -c http.lowSpeedLimit flags before the
subcommand, so match on the subcommand rather than the start of the string */
const gitCalls = (subcommand: string) =>
  vi.mocked(spawnSync).mock.calls.filter(c => String(c[0]).includes(` ${subcommand}`));

/* A checkout that looks like one to _refreshClone, unlike the bare folders
tests/logic/compute-dependencies.test.ts seeds */
const seedClone = (dir: string, git = true) => {
  fs.mkdirSync(dir, { recursive: true });
  if (git) {
    fs.mkdirSync(`${dir}/.git`, { recursive: true });
  }
  fs.writeFileSync(`${dir}/library.json`, JSON.stringify(LIBRARY_JSON));
  fs.writeFileSync(`${dir}/semantics.json`, JSON.stringify([]));
};

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
    vi.mocked(spawnSync).mockImplementation(((command: string) => {
      const match = /^git clone \S+ (\S+)/.exec(command);
      if (match) {
        fs.mkdirSync(match[1], { recursive: true });
        // a real clone leaves a .git behind, and _refreshClone keys off it
        fs.mkdirSync(`${match[1]}/.git`, { recursive: true });
        fs.writeFileSync(`${match[1]}/library.json`, JSON.stringify(LIBRARY_JSON));
        fs.writeFileSync(`${match[1]}/semantics.json`, JSON.stringify([]));
      }
      return { status: 0, stdout: '', stderr: '', error: undefined };
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

  it('never writes master metadata to disk', async () => {
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [200, JSON.stringify([])],
    });

    await logic.computeDependencies('h5p-blanks', 'view');

    /* the contents, not the directory's absence: a writeMetaCache that still
    mkdir'd outside the gate would pass the weaker assertion */
    const entries = fs.existsSync('temp/.metadata') ? fs.readdirSync('temp/.metadata') : [];
    expect(entries).toEqual([]);
  });

  it('never writes a branch ref to disk either', async () => {
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [200, JSON.stringify([])],
    });

    // a branch is as mutable as master; only a x.y.z tag is immutable
    await logic.computeDependencies('h5p-blanks', 'view', 'main');

    /* Filtered rather than asserted empty: the resolver special-cases 'master'
    alone, so under any other ref the dependencies resolve at their own pinned
    patch - immutable, and legitimately cacheable. Only the root's own two files
    are read at the branch ref. */
    const entries = fs.existsSync('temp/.metadata') ? fs.readdirSync('temp/.metadata') : [];
    expect(entries.filter(entry => entry.includes('__main__'))).toEqual([]);
  });

  it('does not persist a git-ref metadata file to disk', async () => {
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [200, JSON.stringify([])],
    });

    await logic.computeDependencies('h5p-blanks', 'view', 'feat/my-pr');

    const cached = fs.existsSync('temp/.metadata') ? fs.readdirSync('temp/.metadata') : [];
    expect(cached.some(name => name.includes('feat'))).toBe(false);
  });

  it('caches an immutable version on disk', async () => {
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [200, JSON.stringify([])],
    });

    /* a full x.y.z skips latestPatch, so both files resolve at the same ref -
    a bare major.minor would file library.json under 1.14 and semantics under
    the 1.14.0 read off library.json */
    await logic.computeDependencies('h5p-blanks', 'view', '1.14.0');

    expect(fs.readdirSync('temp/.metadata').sort()).toEqual([
      'h5p__h5p-blanks__1.14.0__library.json',
      'h5p__h5p-blanks__1.14.0__semantics.json',
    ]);
  });

  it('reads an immutable version back off disk without a request', async () => {
    /* the memo is keyed on the resolved temp path and every test gets a fresh
    fixture dir, so it is cold here and the disk tier is what answers */
    fs.mkdirSync('temp/.metadata', { recursive: true });
    fs.writeFileSync('temp/.metadata/h5p__h5p-blanks__1.14.0__library.json', JSON.stringify(LIBRARY_JSON));
    fs.writeFileSync('temp/.metadata/h5p__h5p-blanks__1.14.0__semantics.json', JSON.stringify([]));
    rawRoutes({ 'library.json': [200, JSON.stringify(LIBRARY_JSON)] });

    const result = await logic.computeDependencies('h5p-blanks', 'view', '1.14.0');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(superAgent.get).not.toHaveBeenCalled();
    expect(gitCloneCalls()).toHaveLength(0);
  });

  it('prefers an existing temp clone over the network for an immutable version', async () => {
    seedClone('temp/h5p-blanks_1.14.0');
    rawRoutes({ 'library.json': [200, JSON.stringify(LIBRARY_JSON)] });

    const result = await logic.computeDependencies('h5p-blanks', 'view', '1.14.0');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(superAgent.get).not.toHaveBeenCalled();
    expect(gitCloneCalls()).toHaveLength(0);
    // a tag cannot move, so there is nothing to fetch forward
    expect(gitCalls('fetch')).toHaveLength(0);
  });

  it('goes to the raw host for master even with a warm temp clone', async () => {
    seedClone('temp/h5p-blanks_master');
    rawRoutes({
      'library.json': [200, JSON.stringify(LIBRARY_JSON)],
      'semantics.json': [200, JSON.stringify([])],
    });

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(superAgent.get).toHaveBeenCalled();
    expect(gitCloneCalls()).toHaveLength(0);
  });

  it('a warm temp clone still resolves master offline', async () => {
    seedClone('temp/h5p-blanks_master');
    vi.mocked(superAgent.get).mockImplementation(() => {
      const chain: any = { set: () => chain, ok: () => Promise.reject(new Error('ENOTFOUND')) };
      return chain;
    });

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    // status 0 -> clone transport -> getRepoFile finds the folder and clones nothing
    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
    expect(gitCloneCalls()).toHaveLength(0);
  });

  it('refreshes a master checkout once per repo, not once per file', async () => {
    process.env.H5P_NO_RAW = '1';
    seedClone('temp/h5p-blanks_master');

    await logic.computeDependencies('h5p-blanks', 'view');

    // library.json and semantics.json are two reads over one checkout
    expect(gitCalls('fetch')).toHaveLength(1);
    expect(gitCalls('reset')).toHaveLength(1);
  });

  it('does not refresh a checkout it just cloned', async () => {
    process.env.H5P_NO_RAW = '1';

    await logic.computeDependencies('h5p-blanks', 'view');

    expect(gitCloneCalls()).toHaveLength(1);
    expect(gitCalls('fetch')).toHaveLength(0);
  });

  it('never runs git in a temp folder that is not a checkout', async () => {
    /* git discovery walks up from its cwd, so a fetch in a stray folder under
    temp/ would find the workspace's own repository and the reset would then
    hard-reset the user's uncommitted work */
    process.env.H5P_NO_RAW = '1';
    seedClone('temp/h5p-blanks_master', false);

    await logic.computeDependencies('h5p-blanks', 'view');

    expect(gitCalls('fetch')).toHaveLength(0);
    expect(gitCalls('reset')).toHaveLength(0);
  });

  it('serves the checkout on disk when the refresh fails', async () => {
    process.env.H5P_NO_RAW = '1';
    seedClone('temp/h5p-blanks_master');
    vi.mocked(spawnSync).mockImplementation(((command: string) =>
      String(command).includes(' fetch')
        ? { status: 1, stdout: '', stderr: 'could not resolve host', error: undefined }
        : { status: 0, stdout: '', stderr: '', error: undefined }) as any);

    const result = await logic.computeDependencies('h5p-blanks', 'view');

    expect(result['h5p-blanks'].id).toBe('H5P.Blanks');
  });
});
