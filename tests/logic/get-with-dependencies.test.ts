import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { execSync, spawnSync, spawn } from 'child_process';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
  spawn: vi.fn(),
}));

const fakeChild = (status = 0) => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  (child.stdout as any).setEncoding = () => {};
  (child.stderr as any).setEncoding = () => {};
  process.nextTick(() => child.emit('close', status));
  return child;
};

// A fixed dep map returned by the computeDependencies spy.
// Simulates two registered libraries: h5p-joubel-ui (dep) and h5p-blanks (parent).
const DEP_MAP = {
  'h5p-joubel-ui': {
    id: 'H5P.JoubelUI',
    shortName: 'h5p-joubel-ui',
    repoName: 'h5p-joubel-ui',
    org: 'h5p',
    version: { major: 3, minor: 3, patch: 0 },
    optional: false,
    preloadedJs: [],
    preloadedCss: [],
    preloadedDependencies: [],
    editorDependencies: [],
  },
  'h5p-blanks': {
    id: 'H5P.Blanks',
    shortName: 'h5p-blanks',
    repoName: 'h5p-blanks',
    org: 'h5p',
    version: { major: 1, minor: 14, patch: 0 },
    optional: false,
    preloadedJs: [],
    preloadedCss: [],
    preloadedDependencies: [],
    editorDependencies: [],
  },
} as any;

describe('logic.getWithDependencies', () => {
  let fixture: Fixture;
  let originalCwd: string;
  let stderr: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' } as any);
    // the install loop's git/npm calls go through the async logic._exec -> spawn
    vi.mocked(spawn).mockImplementation(() => fakeChild() as any);
    vi.spyOn(logic, 'computeDependencies').mockResolvedValue(DEP_MAP);
    fs.mkdirSync('libraries', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('skips already-installed library and adds it to toSkip', async () => {
    // Pre-create both library folders to simulate already installed
    fs.mkdirSync('libraries/H5P.JoubelUI-3.3', { recursive: true });
    fs.mkdirSync('libraries/H5P.Blanks-1.14', { recursive: true });

    const result = await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    expect(result).toContain('h5p-joubel-ui');
    expect(result).toContain('h5p-blanks');
    // No git clone should have been called
    const cloneCalls = vi.mocked(spawn).mock.calls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).startsWith('git clone'),
    );
    expect(cloneCalls).toHaveLength(0);
  });

  it('calls git clone for a not-yet-installed library', async () => {
    // Do not pre-create library folders
    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    const cloneCalls = vi.mocked(spawn).mock.calls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).startsWith('git clone'),
    );
    expect(cloneCalls.length).toBeGreaterThan(0);
  });

  /* `version` reached _install and was then ignored in favour of a hardcoded
  'master', so a pinned setup resolved the requested tag and cloned the tip
  anyway — while `download`, given the same arguments, honoured it. */
  it('clones the resolved tag when a version is pinned, not master', async () => {
    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    const cloneCalls = vi.mocked(spawn).mock.calls
      .map(args => String(args[0]))
      .filter(cmd => cmd.startsWith('git clone'));
    expect(cloneCalls).toHaveLength(2);
    expect(cloneCalls.some(cmd => cmd.endsWith('--branch 3.3.0'))).toBe(true);
    expect(cloneCalls.some(cmd => cmd.endsWith('--branch 1.14.0'))).toBe(true);
  });

  it('clones master when tracking latest', async () => {
    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', true);

    const cloneCalls = vi.mocked(spawn).mock.calls
      .map(args => String(args[0]))
      .filter(cmd => cmd.startsWith('git clone'));
    expect(cloneCalls.every(cmd => cmd.endsWith('--branch master'))).toBe(true);
  });

  describe('updating a library that is already installed', () => {
    const gitOutput: Record<string, string> = {};
    const folder = 'libraries/H5P.Blanks-1.14';

    beforeEach(() => {
      fs.mkdirSync('libraries/H5P.JoubelUI-3.3', { recursive: true });
      fs.mkdirSync(folder, { recursive: true });
      // clean, on master, and pulling moves nothing unless a test says so
      gitOutput['git status --porcelain'] = '';
      gitOutput['git rev-parse --abbrev-ref HEAD'] = 'master\n';
      gitOutput['git rev-parse HEAD'] = 'abc123\n';
      vi.mocked(spawn).mockImplementation(((cmd: string) => {
        const child: any = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdout.setEncoding = () => {};
        child.stderr.setEncoding = () => {};
        process.nextTick(() => {
          const out = gitOutput[cmd];
          if (out) {
            child.stdout.emit('data', out);
          }
          child.emit('close', 0);
        });
        return child;
      }) as any);
    });

    const ran = () => vi.mocked(spawn).mock.calls.map(args => String(args[0]));

    it('pulls a clean master checkout', async () => {
      await logic.getWithDependencies('clone', 'h5p-blanks', 'view', true);

      expect(ran()).toContain('git pull origin');
    });

    /* A folder under libraries/ is often somebody's working copy. git would
    refuse the checkout anyway, which aborted the entire setup. */
    it('leaves a library with uncommitted changes alone', async () => {
      gitOutput['git status --porcelain'] = ' M src/blanks.js\n';

      await logic.getWithDependencies('clone', 'h5p-blanks', 'view', true);

      expect(ran()).not.toContain('git pull origin');
      expect(stderr).toContain('uncommitted changes');
    });

    it('leaves a library checked out on another branch alone', async () => {
      gitOutput['git rev-parse --abbrev-ref HEAD'] = 'feature/thing\n';

      await logic.getWithDependencies('clone', 'h5p-blanks', 'view', true);

      expect(ran()).not.toContain('git pull origin');
      expect(stderr).toContain('not master');
    });

    it('rebuilds when the pull brought new commits, so dist/ is not left stale', async () => {
      fs.writeFileSync(`${folder}/package.json`, JSON.stringify({ scripts: { build: 'rollup -c' } }));
      // only this library's pull moves HEAD; the sibling's must stay put
      let head = 'before';
      vi.mocked(spawn).mockImplementation(((cmd: string, options: any) => {
        const child: any = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdout.setEncoding = () => {};
        child.stderr.setEncoding = () => {};
        const moves = options?.cwd === folder;
        process.nextTick(() => {
          if (cmd === 'git rev-parse HEAD') {
            child.stdout.emit('data', `${moves ? head : 'fixed'}\n`);
            // the sibling library installs concurrently; it must not advance this
            if (moves) {
              head = 'after';
            }
          }
          else if (cmd === 'git rev-parse --abbrev-ref HEAD') {
            child.stdout.emit('data', 'master\n');
          }
          child.emit('close', 0);
        });
        return child;
      }) as any);

      await logic.getWithDependencies('clone', 'h5p-blanks', 'view', true);

      const builds = vi.mocked(spawn).mock.calls.filter(
        ([cmd, options]) => String(cmd) === 'npm run build' && (options as any)?.cwd === folder,
      );
      expect(builds).toHaveLength(1);
    });

    it('does not rebuild when the pull changed nothing', async () => {
      fs.writeFileSync(`${folder}/package.json`, JSON.stringify({ scripts: { build: 'rollup -c' } }));

      await logic.getWithDependencies('clone', 'h5p-blanks', 'view', true);

      expect(ran()).not.toContain('npm run build');
    });
  });

  it('skips optional unregistered dep with a log message and no throw', async () => {
    vi.spyOn(logic, 'computeDependencies').mockResolvedValue({
      'H5P.SomeOptional': { id: undefined, optional: true, parent: 'h5p-blanks' } as any,
    });

    await expect(
      logic.getWithDependencies('clone', 'h5p-blanks', 'view', false),
    ).resolves.toBeDefined();

    expect(stderr).toContain('skipping optional unregistered');
  });

  it('throws for a required unregistered dep', async () => {
    vi.spyOn(logic, 'computeDependencies').mockResolvedValue({
      'H5P.Required': { id: undefined, optional: false, parent: 'h5p-blanks' } as any,
    });

    await expect(
      logic.getWithDependencies('clone', 'h5p-blanks', 'view', false),
    ).rejects.toThrow('unregistered H5P.Required library');
  });

  it('toSkip accumulates — passing result of first call skips all already-processed libs', async () => {
    const first = await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    vi.mocked(spawn).mockClear();

    // Second call with toSkip = result of first; no clones should happen
    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false, first);

    const cloneCalls = vi.mocked(spawn).mock.calls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).startsWith('git clone'),
    );
    expect(cloneCalls).toHaveLength(0);
  });

  /* a child that stays open long enough for a second one to start, so the test
  can observe whether the loop overlaps installs or serialises them */
  const trackingSpawn = () => {
    const state = { inFlight: 0, peak: 0 };
    vi.mocked(spawn).mockImplementation(() => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      (child.stdout as any).setEncoding = () => {};
      (child.stderr as any).setEncoding = () => {};
      state.inFlight++;
      state.peak = Math.max(state.peak, state.inFlight);
      setTimeout(() => {
        state.inFlight--;
        child.emit('close', 0);
      }, 10);
      return child as any;
    });
    return state;
  };

  it('installs libraries concurrently', async () => {
    const state = trackingSpawn();

    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    expect(state.peak).toBeGreaterThan(1);
  });

  it('concurrency of 1 serialises installs', async () => {
    const state = trackingSpawn();

    await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false, [], 1);

    expect(state.peak).toBe(1);
  });

  it('reserves every library in toSkip before installing, so nothing is claimed twice', async () => {
    trackingSpawn();

    const result = await logic.getWithDependencies('clone', 'h5p-blanks', 'view', false);

    expect(result).toEqual([...new Set(result)]);
    expect(result).toContain('h5p-joubel-ui');
    expect(result).toContain('h5p-blanks');
  });

  it('a required unregistered dep aborts before any install starts', async () => {
    const state = trackingSpawn();
    vi.spyOn(logic, 'computeDependencies').mockResolvedValue({
      ...DEP_MAP,
      'H5P.Required': { id: undefined, optional: false, parent: 'h5p-blanks' },
    } as any);

    await expect(
      logic.getWithDependencies('clone', 'h5p-blanks', 'view', false),
    ).rejects.toThrow('unregistered H5P.Required library');

    expect(state.peak).toBe(0);
  });

  /* The abort has to reach the whole process group, not the /bin/sh wrapper:
  `npm run build` leaves node and git below it, and those hold the stdio pipes
  the parent is waiting on, so a kill aimed at sh alone leaves the CLI hanging
  after it has already reported the error. */
  it('kills the in-flight process groups when one install fails', async () => {
    const signalled: number[] = [];
    const kill = vi.spyOn(process, 'kill').mockImplementation(((pid: number) => {
      signalled.push(pid);
      return true;
    }) as any);
    let spawned = 0;
    vi.mocked(spawn).mockImplementation((() => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      (child.stdout as any).setEncoding = () => {};
      (child.stderr as any).setEncoding = () => {};
      const index = spawned++;
      child.pid = 4200 + index;
      // the first install fails fast; the second is still running when it does
      if (index === 0) {
        setTimeout(() => child.emit('close', 1), 5);
      }
      return child;
    }) as any);

    await expect(
      logic.getWithDependencies('clone', 'h5p-blanks', 'view', false),
    ).rejects.toThrow('Command failed');

    kill.mockRestore();
    // negative pids: the group, not the shell
    expect(signalled.length).toBeGreaterThan(0);
    expect(signalled.every(pid => pid < 0)).toBe(true);
  });

  it('clones only the root library at a git ref; deps stay on their tags', async () => {
    await logic.installDependencies('clone', DEP_MAP, false, [], 1, { library: 'h5p-blanks', ref: 'feat/my-pr' });

    const cloneCalls = vi.mocked(spawn).mock.calls
      .map(args => String(args[0]))
      .filter(cmd => cmd.startsWith('git clone'));
    expect(cloneCalls.some(cmd => cmd.includes('h5p-blanks') && cmd.endsWith('--branch feat/my-pr'))).toBe(true);
    expect(cloneCalls.some(cmd => cmd.includes('h5p-joubel-ui') && cmd.endsWith('--branch 3.3.0'))).toBe(true);
    expect(cloneCalls.some(cmd => cmd.includes('h5p-blanks') && cmd.endsWith('--branch 1.14.0'))).toBe(false);
  });

  it('falls back to master for a missing dep tag, not for the root ref', async () => {
    vi.mocked(spawn).mockImplementation(((cmd: string) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdout.setEncoding = () => {};
      child.stderr.setEncoding = () => {};
      const missing = String(cmd).includes('--branch 3.3.0');
      process.nextTick(() => {
        if (missing) {
          child.stderr.emit('data', 'fatal: Remote branch 3.3.0 not found in upstream origin\n');
        }
        child.emit('close', missing ? 1 : 0);
      });
      return child;
    }) as any);

    await logic.installDependencies('clone', DEP_MAP, false, [], 1, { library: 'h5p-blanks', ref: 'feat/my-pr' });

    const cloneCalls = vi.mocked(spawn).mock.calls
      .map(args => String(args[0]))
      .filter(cmd => cmd.startsWith('git clone'));
    expect(cloneCalls.some(cmd => cmd.includes('h5p-joubel-ui') && cmd.endsWith('--branch master'))).toBe(true);
    expect(cloneCalls.some(cmd => cmd.includes('h5p-blanks') && cmd.endsWith('--branch master'))).toBe(false);
  });

  it('does not fall back to master when the root git ref is missing', async () => {
    vi.mocked(spawn).mockImplementation(((cmd: string) => {
      return fakeChild(String(cmd).includes('--branch feat/my-pr') ? 1 : 0) as any;
    }) as any);

    await expect(
      logic.installDependencies('clone', DEP_MAP, false, [], 1, { library: 'h5p-blanks', ref: 'feat/my-pr' }),
    ).rejects.toThrow('Command failed');
  });

  it('clones the root at a git ref even when the action is download', async () => {
    vi.spyOn(logic, 'download').mockResolvedValue(undefined);

    await logic.installDependencies('download', DEP_MAP, false, [], 1, { library: 'h5p-blanks', ref: 'feat/my-pr' });

    const cloneCalls = vi.mocked(spawn).mock.calls
      .map(args => String(args[0]))
      .filter(cmd => cmd.startsWith('git clone'));
    expect(cloneCalls.some(cmd => cmd.includes('h5p-blanks') && cmd.endsWith('--branch feat/my-pr'))).toBe(true);
    expect(cloneCalls.some(cmd => cmd.includes('h5p-joubel-ui'))).toBe(false);
  });

  it('downloads dependencies when the action is download', async () => {
    const download = vi.spyOn(logic, 'download').mockResolvedValue(undefined);

    await logic.installDependencies('download', DEP_MAP, false, [], 1, { library: 'h5p-blanks', ref: 'feat/my-pr' });

    expect(download).toHaveBeenCalledWith('h5p', 'h5p-joubel-ui', '3.3.0', 'libraries/H5P.JoubelUI-3.3');
    expect(download.mock.calls.some(args => args[1] === 'h5p-blanks')).toBe(false);
  });
});
