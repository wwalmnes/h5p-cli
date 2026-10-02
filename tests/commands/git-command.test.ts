import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { Command } from 'commander';
import type { GitOpResult } from '../../src/logic/git.ts';

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

type Call = { method: string; repo: string; args: any[] };

/**
 * Every git operation is recorded and reports success.
 * `statuses` overrides what `status()` reports per repo; the default is a clean repo.
 */
const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  statuses: {} as Record<string, Partial<GitOpResult>>,
}));

vi.mock('../../src/logic/git.ts', () => {
  const ok = (method: string) => vi.fn(async (repo: string, ...args: any[]) => {
    fake.calls.push({ method, repo, args });
    return { name: repo, msg: method };
  });
  return {
    commit: ok('commit'),
    pull: ok('pull'),
    push: ok('push'),
    checkout: ok('checkout'),
    deleteBranch: ok('deleteBranch'),
    merge: ok('merge'),
    tag: ok('tag'),
    tagVersion: ok('tagVersion'),
    diff: vi.fn(async (repo: string) => {
      fake.calls.push({ method: 'diff', repo, args: [] });
      return `diff --git a/${repo}\n`;
    }),
    status: vi.fn(async (repo: string) => {
      fake.calls.push({ method: 'status', repo, args: [] });
      return { name: repo, branch: 'main', ...fake.statuses[repo] };
    }),
  };
});

const git = await import('../../src/logic/git.ts');
const { checkoutCommand } = await import('../../src/commands/git/checkout.ts');
const { newBranchCommand } = await import('../../src/commands/git/new-branch.ts');
const { rmBranchCommand } = await import('../../src/commands/git/rm-branch.ts');
const { commitCommand } = await import('../../src/commands/git/commit.ts');
const { pullCommand } = await import('../../src/commands/git/pull.ts');
const { pushCommand } = await import('../../src/commands/git/push.ts');
const { mergeCommand } = await import('../../src/commands/git/merge.ts');
const { diffCommand } = await import('../../src/commands/git/diff.ts');
const { tagCommand } = await import('../../src/commands/git/tag.ts');
const { statusCommand } = await import('../../src/commands/git/status.ts');
const { ui } = await import('../../src/lib/ui.ts');

/** Commander parses the subcommand in isolation; `from: 'user'` skips argv[0..1]. */
function run(cmd: Command, args: string[]): Promise<unknown> {
  return cmd.parseAsync(args, { from: 'user' });
}

let stdout: MockInstance<typeof process.stdout.write>;
let stderr: MockInstance<typeof process.stderr.write>;
/** Everything the command emitted, on either stream. */
let written: string;
/** The data channel alone — what a pipeline would receive. */
let data: string;

beforeEach(() => {
  fake.calls.length = 0;
  fake.statuses = {};
  written = '';
  data = '';
  // ui splits its output across both streams: chrome on stderr, data on stdout.
  // Most assertions only care that something was said, so accumulate both.
  stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    written += String(chunk);
    data += String(chunk);
    return true;
  });
  stderr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    written += String(chunk);
    return true;
  });
});

afterEach(() => {
  stdout.mockRestore();
  stderr.mockRestore();
  ui.resetLevel();
  vi.useRealTimers();
});

describe('h5p git subcommands', () => {
  it('checkout switches every repo to the given branch', async () => {
    await run(checkoutCommand(), ['main']);

    expect(fake.calls).toEqual([
      { method: 'checkout', repo: 'h5p-accordion', args: ['main'] },
      { method: 'checkout', repo: 'h5p-column', args: ['main'] },
    ]);
    expect(written).toContain('h5p-accordion');
    expect(written).toContain('OK');
  });

  it('checkout limits itself to the named libraries', async () => {
    await run(checkoutCommand(), ['main', 'h5p-column']);

    expect(fake.calls).toEqual([{ method: 'checkout', repo: 'h5p-column', args: ['main'] }]);
  });

  it('new-branch creates the branch and pushes it upstream', async () => {
    await run(newBranchCommand(), ['feature/x', 'h5p-column']);

    expect(fake.calls).toEqual([
      { method: 'checkout', repo: 'h5p-column', args: [['-b', 'feature/x']] },
      { method: 'push', repo: 'h5p-column', args: [['-u', 'origin', 'feature/x']] },
    ]);
  });

  it('rm-branch deletes the branch', async () => {
    await run(rmBranchCommand(), ['feature/x', 'h5p-column']);

    expect(fake.calls.some(c => c.method === 'deleteBranch' && c.args[0] === 'feature/x')).toBe(true);
  });

  it('commit passes the message through', async () => {
    await run(commitCommand(), ['Fix the thing', 'h5p-column']);

    expect(fake.calls).toEqual([{ method: 'commit', repo: 'h5p-column', args: ['Fix the thing'] }]);
  });

  it('pull runs across all repos when none are named', async () => {
    await run(pullCommand(), []);

    expect(fake.calls.map(c => c.repo)).toEqual(REPOS);
    expect(fake.calls.every(c => c.method === 'pull')).toBe(true);
  });

  it('push sends no extra args by default', async () => {
    await run(pushCommand(), ['h5p-column']);

    expect(fake.calls).toEqual([{ method: 'push', repo: 'h5p-column', args: [[]] }]);
  });

  it('push --tags forwards the flag to git', async () => {
    await run(pushCommand(), ['--tags', 'h5p-column']);

    expect(fake.calls).toEqual([{ method: 'push', repo: 'h5p-column', args: [['--tags']] }]);
  });

  it('merge merges the given branch', async () => {
    await run(mergeCommand(), ['release', 'h5p-column']);

    expect(fake.calls).toEqual([{ method: 'merge', repo: 'h5p-column', args: ['release'] }]);
  });

  it('diff concatenates the diff of every repo found', async () => {
    await run(diffCommand(), []);

    expect(fake.calls.map(c => c.repo)).toEqual(REPOS);
    expect(data).toBe('diff --git a/h5p-accordion\ndiff --git a/h5p-column\n');
  });

  it('tag tags the given libraries', async () => {
    await run(tagCommand(), ['1.2.3', 'h5p-column']);

    expect(fake.calls).toEqual([{ method: 'tag', repo: 'h5p-column', args: ['1.2.3'] }]);
  });

  it('status inspects every repo when none are named', async () => {
    await run(statusCommand(), []);

    expect(fake.calls).toEqual([
      { method: 'status', repo: 'h5p-accordion', args: [] },
      { method: 'status', repo: 'h5p-column', args: [] },
    ]);
  });

  it('status limits itself to the named libraries', async () => {
    await run(statusCommand(), ['h5p-column']);

    expect(fake.calls).toEqual([{ method: 'status', repo: 'h5p-column', args: [] }]);
  });

  it('status reports only repos with changes', async () => {
    fake.statuses = { 'h5p-column': { changes: [' M library.json'] } };
    await run(statusCommand(), []);

    expect(written).toContain('h5p-column');
    expect(written).toContain(' M library.json');
    expect(written).not.toContain('h5p-accordion');
  });

  it('status -f reports every repo with its branch', async () => {
    await run(statusCommand(), ['-f']);

    expect(written).toContain('h5p-accordion');
    expect(written).toContain('h5p-column');
    expect(written).toContain('(main)');
  });

  it('status rejects an empty library name', async () => {

    await run(statusCommand(), ['']);

    expect(fake.calls).toEqual([]);
    expect(written).toContain('Library names cannot be empty');
  });

  it('status explains why a named library was skipped', async () => {
    const { processRepos } = await import('../../src/lib/process-repos.ts');
    vi.mocked(processRepos).mockResolvedValueOnce([
      { name: 'not-a-repo', skipped: true, msg: 'no git repository found' },
    ]);

    await run(statusCommand(), ['not-a-repo']);

    expect(written).toContain('not-a-repo');
    expect(written).toContain('no git repository found');
  });

  it('status prints a repo that failed to report', async () => {
    fake.statuses = { 'h5p-column': { error: 'not a git repository' } };
    await run(statusCommand(), []);

    expect(written).toContain('not a git repository');
  });
});

describe('git output channels', () => {
  it('reports a failed repo along with its detail', async () => {
    vi.mocked(git.checkout).mockImplementationOnce(async (repo: string) => ({ name: repo, failed: true, msg: 'local changes' }));

    await run(checkoutCommand(), ['main', 'h5p-column']);

    expect(written).toContain('h5p-column FAILED');
    expect(written).toContain('local changes');
  });

  it('reports why a repo was skipped', async () => {
    const { processRepos } = await import('../../src/lib/process-repos.ts');
    vi.mocked(processRepos).mockResolvedValueOnce([
      { name: 'h5p-column', skipped: true, msg: 'ignored' },
    ]);

    await run(checkoutCommand(), ['main', 'h5p-column']);

    expect(written).toContain('h5p-column SKIPPED');
    expect(written).toContain('ignored');
  });

  it('keeps per-repo chrome off the data channel', async () => {
    await run(checkoutCommand(), ['main']);

    expect(written).toContain('h5p-accordion');
    // Results are annotation, not data: a pipeline must see none of it.
    expect(data).toBe('');
  });

  it('drops per-repo chrome under --quiet but still emits diff data', async () => {
    ui.setLevel('quiet');

    await run(checkoutCommand(), ['main']);
    expect(written).toBe('');

    await run(diffCommand(), []);
    expect(data).toBe('diff --git a/h5p-accordion\ndiff --git a/h5p-column\n');
  });

  it('prints nothing for a diff when no repo has changes', async () => {
    vi.mocked(git.diff).mockResolvedValueOnce('').mockResolvedValueOnce('');

    await run(diffCommand(), []);

    expect(data).toBe('');
  });
});
