import { Command } from 'commander';
import { GitAdapter, type GitOpResult, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { resolveRepos } from '../../lib/process-repos.ts';
import { reportResult } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

export function newBranchCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('new-branch')
    .description('Creates a new branch (local and remote)')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action(async (branch: string, libraries: string[]) => {
      if (!branch || branch.startsWith('h5p-')) {
        ui.warn('That is a strange name for a branch..');
        return;
      }

      const repos = libraries.length ? libraries : ['*'];
      const allRepos = await resolveRepos(repos);

      try {
        for (const repo of allRepos) {
          ui.status('git-new-branch', `Branching '${repo}'…`);

          const checkoutResult = await git.checkout(repo, ['-b', branch]);
          if (checkoutResult.failed || checkoutResult.skipped) {
            reportResult(checkoutResult);
            continue;
          }

          const pushResult: GitOpResult = { ...(await git.push(repo, ['-u', 'origin', branch])) };
          // A clean push has nothing worth saying; only failures carry detail.
          if (!pushResult.skipped && !pushResult.failed) delete pushResult.msg;
          reportResult(pushResult);
        }
      } catch (error) {
        ui.fail(error);
      } finally {
        ui.statusDone('git-new-branch');
      }
    });
}
