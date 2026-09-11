import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { execSync, spawnSync, spawn } from 'child_process';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic, { incompleteInstalls } from '../../logic.ts';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
  spawn: vi.fn(),
}));

const CORE = [
  { org: 'h5p', repo: 'h5p-php-library', target: 'h5p-php-library' },
  { org: 'h5p', repo: 'h5p-editor-php-library', target: 'h5p-editor-php-library' },
];

const fakeChild = (status = 0) => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr.setEncoding = () => {};
  process.nextTick(() => child.emit('close', status));
  return child;
};

describe('logic.installCore', () => {
  let fixture: Fixture;
  let originalCwd: string;
  let stderr: string;

  const ran = () => vi.mocked(spawn).mock.calls.map((args) => String(args[0]));
  const clones = () => ran().filter((cmd) => cmd.startsWith('git clone'));

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr += chunk;
      return true;
    });
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' } as any);
    vi.mocked(spawn).mockImplementation(() => fakeChild() as any);
    fs.mkdirSync('libraries', { recursive: true });
    fs.mkdirSync('temp', { recursive: true });
    delete process.env.H5P_NO_UPDATES;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete process.env.H5P_NO_UPDATES;
  });

  it('clones every repo at master, into a folder named after the target', async () => {
    const result = await logic.installCore(CORE, true);

    expect(result).toEqual(['h5p-php-library', 'h5p-editor-php-library']);
    expect(clones()).toHaveLength(2);
    expect(clones().every((cmd) => cmd.endsWith('--branch master'))).toBe(true);
    expect(clones().some((cmd) => cmd.includes('h5p/h5p-php-library.git h5p-php-library'))).toBe(true);
  });

  /* The point of the change: `logic.clone` was spawnSync, so the two core repos
  cloned strictly one after the other and blocked the event loop while they did.
  Both clones must now be in flight at the same time. */
  it('runs the clones concurrently', async () => {
    let inFlight = 0;
    let peak = 0;
    vi.mocked(spawn).mockImplementation((() => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdout.setEncoding = () => {};
      child.stderr.setEncoding = () => {};
      inFlight++;
      peak = Math.max(peak, inFlight);
      setTimeout(() => {
        inFlight--;
        child.emit('close', 0);
      }, 5);
      return child;
    }) as any);

    await logic.installCore(CORE, true);

    expect(peak).toBe(2);
  });

  it('honours the concurrency bound', async () => {
    let inFlight = 0;
    let peak = 0;
    vi.mocked(spawn).mockImplementation((() => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdout.setEncoding = () => {};
      child.stderr.setEncoding = () => {};
      inFlight++;
      peak = Math.max(peak, inFlight);
      setTimeout(() => {
        inFlight--;
        child.emit('close', 0);
      }, 5);
      return child;
    }) as any);

    await logic.installCore(CORE, true, 1);

    expect(peak).toBe(1);
  });

  describe('a repo that is already on disk', () => {
    const gitOutput: Record<string, string> = {};

    beforeEach(() => {
      for (const item of CORE) {
        fs.mkdirSync(`libraries/${item.target}/.git`, { recursive: true });
      }
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

    it('is never re-cloned', async () => {
      await logic.installCore(CORE, true);
      expect(clones()).toHaveLength(0);
    });

    /* h5p core used to skip an existing core library outright, so a stale
    h5p-php-library stayed stale until somebody pulled it by hand. */
    it('is pulled', async () => {
      await logic.installCore(CORE, true);
      expect(ran().filter((cmd) => cmd === 'git pull origin')).toHaveLength(2);
    });

    it('is left alone when it has uncommitted changes', async () => {
      gitOutput['git status --porcelain'] = ' M h5p.classes.php\n';

      await logic.installCore(CORE, true);

      expect(ran()).not.toContain('git pull origin');
      expect(stderr).toContain('uncommitted changes');
    });

    it('is left alone when checked out on another branch', async () => {
      gitOutput['git rev-parse --abbrev-ref HEAD'] = 'feature/thing\n';

      await logic.installCore(CORE, true);

      expect(ran()).not.toContain('git pull origin');
      expect(stderr).toContain('not master');
    });

    it('is not pulled under H5P_NO_UPDATES', async () => {
      process.env.H5P_NO_UPDATES = '1';

      await logic.installCore(CORE, true);

      expect(ran()).not.toContain('git pull origin');
      expect(stderr).toContain('skipping updates');
    });

    it('is not pulled when latest is false', async () => {
      await logic.installCore(CORE, false);

      expect(ran()).not.toContain('git pull origin');
      expect(clones()).toHaveLength(0);
    });
  });

  /* An H5P library entry. Nothing has resolved a graph, so the folder name is not
  known until the clone is on disk and its own library.json can be read. */
  describe('a library repo, named from its own library.json', () => {
    const MD = { org: 'h5p', repo: 'h5p-math-display', machineName: 'H5P.MathDisplay' };

    // stand in for git: the staging clone lands in temp/, carrying a library.json
    const cloneWritingVersion = (major: number, minor: number, extra: Record<string, string> = {}) =>
      vi.mocked(spawn).mockImplementation(((cmd: string) => {
        if (String(cmd).startsWith('git clone')) {
          const staging = 'temp/h5p-math-display_core';
          fs.mkdirSync(staging, { recursive: true });
          fs.writeFileSync(`${staging}/library.json`, JSON.stringify({
            machineName: 'H5P.MathDisplay', majorVersion: major, minorVersion: minor, patchVersion: 50,
          }));
          for (const [file, body] of Object.entries(extra)) {
            fs.writeFileSync(`${staging}/${file}`, body);
          }
        }
        return fakeChild();
      }) as any);

    it('stages in temp/ and places at <machineName>-<major>.<minor>', async () => {
      cloneWritingVersion(1, 0);

      const result = await logic.installCore([MD], true);

      expect(result).toEqual(['H5P.MathDisplay-1.0']);
      expect(fs.existsSync('libraries/H5P.MathDisplay-1.0/library.json')).toBe(true);
      expect(fs.existsSync('temp/h5p-math-display_core')).toBe(false);
      // cloned into temp/, not straight into libraries/
      expect(clones()[0]).toContain('h5p-math-display_core');
    });

    /* The version half of the folder name is genuinely read, not assumed from
    config - an upstream minor bump has to land in its own folder. */
    it('follows a version bump in the cloned library.json', async () => {
      cloneWritingVersion(1, 1);

      const result = await logic.installCore([MD], true);

      expect(result).toEqual(['H5P.MathDisplay-1.1']);
      expect(fs.existsSync('libraries/H5P.MathDisplay-1.1')).toBe(true);
      expect(fs.existsSync('libraries/H5P.MathDisplay-1.0')).toBe(false);
    });

    it('builds it, unlike the plain clone entries', async () => {
      cloneWritingVersion(1, 0, { 'package.json': JSON.stringify({ scripts: { build: 'webpack' } }) });

      await logic.installCore([MD], true);

      expect(ran().some((cmd) => cmd.startsWith('npm '))).toBe(true);
    });

    /* One readdirSync against the machineName prefix - no registry, no network. */
    it('is recognised as installed without cloning again', async () => {
      fs.mkdirSync('libraries/H5P.MathDisplay-1.0', { recursive: true });

      await logic.installCore([MD], false);

      expect(clones()).toHaveLength(0);
    });

    it('does not mistake a prefix of the machine name for an install', async () => {
      cloneWritingVersion(1, 0);
      fs.mkdirSync('libraries/H5P.Math-1.0', { recursive: true });

      await logic.installCore([MD], true);

      expect(clones()).toHaveLength(1);
      expect(fs.existsSync('libraries/H5P.MathDisplay-1.0')).toBe(true);
    });

    it('leaves neither the staging folder nor the destination behind on failure', async () => {
      vi.mocked(spawn).mockImplementation(((cmd: string) => {
        if (String(cmd).startsWith('git clone')) {
          fs.mkdirSync('temp/h5p-math-display_core', { recursive: true });
          return fakeChild(128);
        }
        return fakeChild();
      }) as any);

      await expect(logic.installCore([MD], true)).rejects.toThrow();

      expect(fs.existsSync('temp/h5p-math-display_core')).toBe(false);
      expect(fs.readdirSync('libraries')).toEqual([]);
      expect(incompleteInstalls.size).toBe(0);
    });
  });

  /* h5p-editor-php-library's build rewrites tracked files - webpack regenerates
  styles/css/application.css, npm install rewrites package-lock.json - so building
  on install leaves the checkout permanently dirty and _update's dirty check then
  refuses to refresh it ever again. The repo ships its built CSS committed. */
  it('does not build a core repo, even one with a build script', async () => {
    vi.mocked(spawn).mockImplementation((() => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdout.setEncoding = () => {};
      child.stderr.setEncoding = () => {};
      process.nextTick(() => {
        // the clone is what puts the package.json there, as a real one would
        fs.mkdirSync('libraries/h5p-editor-php-library', { recursive: true });
        fs.writeFileSync(
          'libraries/h5p-editor-php-library/package.json',
          JSON.stringify({ scripts: { build: 'webpack' } }),
        );
        child.emit('close', 0);
      });
      return child;
    }) as any);

    await logic.installCore([CORE[1]], true);

    expect(ran().some((cmd) => cmd.startsWith('npm '))).toBe(false);
  });

  /* logic.clone left the half-written folder behind, and fs.existsSync is the
  whole already-installed test, so the next run reported it as installed. */
  it('leaves no folder behind when a clone fails', async () => {
    vi.mocked(spawn).mockImplementation(((cmd: string) => {
      if (String(cmd).startsWith('git clone')) {
        // a real failed clone has usually already created the target
        fs.mkdirSync('libraries/h5p-php-library', { recursive: true });
        return fakeChild(128);
      }
      return fakeChild();
    }) as any);

    await expect(logic.installCore([CORE[0]], true)).rejects.toThrow();

    expect(fs.existsSync('libraries/h5p-php-library')).toBe(false);
    expect(incompleteInstalls.size).toBe(0);
  });
});
