import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { execSync, spawn } from 'child_process';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../src/logic.ts';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// _exec captures git's output off the child's streams so it cannot bypass ui
const fakeChild = (stdout: string) => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr.setEncoding = () => {};
  process.nextTick(() => {
    child.stdout.emit('data', stdout);
    child.emit('close', 0);
  });
  return child;
};

/* What `git ls-remote --tags --refs` prints: a sha, a tab, then the full ref. */
const lsRemote = (...tags: string[]) =>
  tags.map((tag, i) => `${String(i).repeat(40)}\trefs/tags/${tag}`).join('\n') + '\n';

describe('logic.tags', () => {
  let fixture: Fixture;
  let originalCwd: string;

  beforeEach(() => {
    fixture = createEmptyProject();
    originalCwd = process.cwd();
    process.chdir(fixture.dir);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
    vi.mocked(spawn).mockImplementation(() =>
      fakeChild(lsRemote('1.14.1', '1.14.0', '1.15.0', '1.13.5'))
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns tags sorted descending by semver', async () => {
    const tags = await logic.tags('h5p', 'h5p-blanks');
    expect(tags).toEqual(['1.15.0', '1.14.1', '1.14.0', '1.13.5']);
  });

  it('filters out blank lines in the ls-remote output', async () => {
    vi.mocked(spawn).mockImplementation(() =>
      fakeChild(`\n${lsRemote('1.0.0', '2.0.0')}\n`)
    );
    const tags = await logic.tags('h5p', 'h5p-blanks');
    expect(tags).not.toContain('');
    expect(tags).toEqual(['2.0.0', '1.0.0']);
  });

  /* The point of the rewrite: reading tags used to clone the repo into temp/,
  unshallow it, checkout and pull — once per dependency, for every dependency,
  whenever setup was given a version. */
  it('reads the remote directly and never clones or writes to temp/', async () => {
    await logic.tags('h5p', 'h5p-blanks');

    const commands = vi.mocked(spawn).mock.calls.map(([cmd]) => String(cmd));
    expect(commands).toEqual(['git ls-remote --tags --refs https://github.com/h5p/h5p-blanks.git']);
    expect(vi.mocked(execSync)).not.toHaveBeenCalled();
  });
});
