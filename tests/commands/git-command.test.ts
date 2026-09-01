import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Command } from 'commander';
import type { GitOpResult, IGitAdapter } from '../../src/adapters/git-adapter.ts';

// The repo walk is filesystem-bound; stand in a fixed two-repo workspace so the
// command factories are exercised without touching disk.
const REPOS = ['h5p-accordion', 'h5p-column'];

vi.mock('../../src/lib/process-repos.ts', () => ({
  findRepos: vi.fn(async () => REPOS),
  processRepos: vi.fn(async (repos: string[], fn: (repo: string) => Promise<any>) => {
    const all = !repos.length || (repos.length === 1 && repos[0] === '*');
    return Promise.all((all ? REPOS : repos).map(fn));
  }),
  resolveRepos: vi.fn(async (repos: string[]) => (repos.length ? repos : REPOS)),
}));

const { checkoutCommand } = await import('../../src/commands/git/checkout.ts');
const { newBranchCommand } = await import('../../src/commands/git/new-branch.ts');
const { rmBranchCommand } = await import('../../src/commands/git/rm-branch.ts');
const { commitCommand } = await import('../../src/commands/git/commit.ts');
const { pullCommand } = await import('../../src/commands/git/pull.ts');
const { pushCommand } = await import('../../src/commands/git/push.ts');
const { mergeCommand } = await import('../../src/commands/git/merge.ts');
const { diffCommand } = await import('../../src/commands/git/diff.ts');
const { tagCommand } = await import('../../src/commands/git/tag.ts');

type Call = { method: string; repo: string; args: any[] };

/** Records every adapter call and always reports success. */
function fakeGit(): IGitAdapter & { calls: Call[] } {
  const calls: Call[] = [];
  const ok = (method: string) => async (repo: string, ...args: any[]): Promise<GitOpResult> => {
    calls.push({ method, repo, args });
    return { name: repo, msg: method };
  };
  return {
    calls,
    commit: ok('commit'),
    pull: ok('pull'),
    push: ok('push'),
    checkout: ok('checkout'),
    deleteBranch: ok('deleteBranch'),
    merge: ok('merge'),
    tag: ok('tag'),
    tagVersion: ok('tagVersion'),
    diff: async (repo: string) => {
      calls.push({ method: 'diff', repo, args: [] });
      return `diff --git a/${repo}\n`;
    },
  };
}

/** Commander parses the subcommand in isolation; `from: 'user'` skips argv[0..1]. */
function run(cmd: Command, args: string[]): Promise<unknown> {
  return cmd.parseAsync(args, { from: 'user' });
}

let stdout: ReturnType<typeof vi.spyOn>;
let written: string;

beforeEach(() => {
  written = '';
  stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    written += String(chunk);
    return true;
  });
});

afterEach(() => {
  stdout.mockRestore();
  vi.useRealTimers();
});

describe('h5p git subcommands', () => {
  it('checkout switches every repo to the given branch', async () => {
    const git = fakeGit();
    await run(checkoutCommand(git), ['main']);

    expect(git.calls).toEqual([
      { method: 'checkout', repo: 'h5p-accordion', args: ['main'] },
      { method: 'checkout', repo: 'h5p-column', args: ['main'] },
    ]);
    expect(written).toContain('h5p-accordion');
    expect(written).toContain('OK');
  });

  it('checkout limits itself to the named libraries', async () => {
    const git = fakeGit();
    await run(checkoutCommand(git), ['main', 'h5p-column']);

    expect(git.calls).toEqual([{ method: 'checkout', repo: 'h5p-column', args: ['main'] }]);
  });

  it('new-branch creates the branch and pushes it upstream', async () => {
    const git = fakeGit();
    await run(newBranchCommand(git), ['feature/x', 'h5p-column']);

    expect(git.calls).toEqual([
      { method: 'checkout', repo: 'h5p-column', args: [['-b', 'feature/x']] },
      { method: 'push', repo: 'h5p-column', args: [['-u', 'origin', 'feature/x']] },
    ]);
  });

  it('rm-branch deletes the branch', async () => {
    const git = fakeGit();
    await run(rmBranchCommand(git), ['feature/x', 'h5p-column']);

    expect(git.calls.some(c => c.method === 'deleteBranch' && c.args[0] === 'feature/x')).toBe(true);
  });

  it('commit passes the message through', async () => {
    const git = fakeGit();
    await run(commitCommand(git), ['Fix the thing', 'h5p-column']);

    expect(git.calls).toEqual([{ method: 'commit', repo: 'h5p-column', args: ['Fix the thing'] }]);
  });

  it('pull runs across all repos when none are named', async () => {
    const git = fakeGit();
    await run(pullCommand(git), []);

    expect(git.calls.map(c => c.repo)).toEqual(REPOS);
    expect(git.calls.every(c => c.method === 'pull')).toBe(true);
  });

  it('push sends no extra args by default', async () => {
    const git = fakeGit();
    await run(pushCommand(git), ['h5p-column']);

    expect(git.calls).toEqual([{ method: 'push', repo: 'h5p-column', args: [[]] }]);
  });

  it('push --tags forwards the flag to git', async () => {
    const git = fakeGit();
    await run(pushCommand(git), ['--tags', 'h5p-column']);

    expect(git.calls).toEqual([{ method: 'push', repo: 'h5p-column', args: [['--tags']] }]);
  });

  it('merge merges the given branch', async () => {
    const git = fakeGit();
    await run(mergeCommand(git), ['release', 'h5p-column']);

    expect(git.calls).toEqual([{ method: 'merge', repo: 'h5p-column', args: ['release'] }]);
  });

  it('diff concatenates the diff of every repo found', async () => {
    const git = fakeGit();
    await run(diffCommand(git), []);

    expect(git.calls.map(c => c.repo)).toEqual(REPOS);
    expect(written).toBe('diff --git a/h5p-accordion\ndiff --git a/h5p-column\n');
  });

  it('tag tags the given libraries', async () => {
    const git = fakeGit();
    await run(tagCommand(git), ['1.2.3', 'h5p-column']);

    expect(git.calls).toEqual([{ method: 'tag', repo: 'h5p-column', args: ['1.2.3'] }]);
  });
});
