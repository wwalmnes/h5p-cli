import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import bump from '../../src/utils/commands/bump.ts';

vi.mock('child_process', () => ({ execSync: vi.fn() }));

vi.mock('fs', () => {
  const readdirSync = vi.fn(() => ['h5p-accordion', 'h5p-blanks']);
  const readFileSync = vi.fn(() => JSON.stringify({ majorVersion: 1, minorVersion: 2, patchVersion: 3 }));
  const existsSync = vi.fn(() => true);
  const mocked = { readdirSync, readFileSync, existsSync };
  return { default: mocked, ...mocked };
});

const LIB = 'h5p-accordion';

type Call = { command: string; cwd?: string };
const calls = (): Call[] =>
  vi.mocked(execSync).mock.calls.map(([command, options]) => ({
    command: String(command),
    cwd: (options as { cwd?: string } | undefined)?.cwd,
  }));
const gitCalls = (): Call[] => calls().filter((call) => call.command.startsWith('git '));

describe('utils bump', () => {
  let printed: string;
  let chdir: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    printed = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      printed += String(chunk);
      return true;
    });
    chdir = vi.spyOn(process, 'chdir').mockImplementation(() => {
      throw new Error('bump must not chdir the process');
    });
    // `git status --porcelain` must report a change, or bump stops before committing.
    vi.mocked(execSync).mockImplementation(((command: string) => {
      if (String(command).includes('status --porcelain')) return ' M library.json';
      return '';
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(execSync).mockReset();
  });

  it('never changes the process working directory', async () => {
    await bump(LIB, '--yes');

    expect(chdir).not.toHaveBeenCalled();
  });

  it('scopes every git call to the library folder', async () => {
    await bump(LIB, '--yes');

    expect(gitCalls().length).toBeGreaterThan(0);
    for (const call of gitCalls()) {
      expect(call.cwd).toBe(LIB);
    }
  });

  it('runs the full commit, tag and push sequence under --yes', async () => {
    await bump(LIB, '--yes');

    const commands = gitCalls().map((call) => call.command);
    expect(commands).toContain('git add library.json');
    expect(commands).toContain('git commit -m "Bump to 1.2.3"');
    expect(commands).toContain('git tag -a 1.2.3 -m "1.2.3"');
    expect(commands).toContain('git push');
    expect(commands).toContain('git push origin 1.2.3');
  });

  it('delegates the version bump to increase-patch-version', async () => {
    await bump(LIB, '--yes');

    expect(calls()[0].command).toBe(`h5p utils increase-patch-version ${LIB}`);
  });

  it('refuses to guess the library from the current folder', async () => {
    await bump('--yes');

    expect(printed).toContain('No library given.');
    expect(calls()).toHaveLength(0);
    expect(chdir).not.toHaveBeenCalled();
  });

  it('names the library when it is not a folder in the current directory', async () => {
    await bump('h5p-nope', '--yes');

    expect(printed).toContain('No library named');
    expect(printed).toContain('h5p-nope');
    expect(calls()).toHaveLength(0);
  });

  it('stops without committing when increase-patch-version skips', async () => {
    vi.mocked(execSync).mockImplementation(((command: string) =>
      String(command).includes('increase-patch-version') ? 'SKIPPED' : '') as never);

    await bump(LIB, '--yes');

    expect(gitCalls()).toHaveLength(0);
  });
});
