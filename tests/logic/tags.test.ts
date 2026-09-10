import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import { createEmptyProject, type Fixture } from '../helpers/fixture.ts';
import logic from '../../logic.ts';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

// logic._exec routes through spawnSync so git's stderr cannot bypass ui
const spawnResult = (stdout: string) => ({ status: 0, stdout, stderr: '', error: undefined });

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
    vi.mocked(spawnSync).mockImplementation(() =>
      spawnResult(lsRemote('1.14.1', '1.14.0', '1.15.0', '1.13.5')) as any
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fixture.cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns tags sorted descending by semver', () => {
    const tags = logic.tags('h5p', 'h5p-blanks');
    expect(tags).toEqual(['1.15.0', '1.14.1', '1.14.0', '1.13.5']);
  });

  it('filters out blank lines in the ls-remote output', () => {
    vi.mocked(spawnSync).mockImplementation(() =>
      spawnResult(`\n${lsRemote('1.0.0', '2.0.0')}\n`) as any
    );
    const tags = logic.tags('h5p', 'h5p-blanks');
    expect(tags).not.toContain('');
    expect(tags).toEqual(['2.0.0', '1.0.0']);
  });

  /* The point of the rewrite: reading tags used to clone the repo into temp/,
  unshallow it, checkout and pull — once per dependency, for every dependency,
  whenever setup was given a version. */
  it('reads the remote directly and never clones or writes to temp/', () => {
    logic.tags('h5p', 'h5p-blanks');

    const commands = vi.mocked(spawnSync).mock.calls.map(([cmd]) => String(cmd));
    expect(commands).toEqual(['git ls-remote --tags --refs https://github.com/h5p/h5p-blanks.git']);
    expect(vi.mocked(execSync)).not.toHaveBeenCalled();
  });
});
