import { Command } from 'commander';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { resolveRepos } from '../../lib/process-repos.ts';
import { reportResult } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

export function rmBranchCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('rm-branch')
    .description('Removes branch (local and remote)')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action(async (branch: string, libraries: string[]) => {
      if (!branch || branch.startsWith('h5p-') || branch === 'master') {
        ui.warn('I would think twice about doing that!');
        return;
      }

      const repos = libraries.length ? libraries : ['*'];
      const allRepos = await resolveRepos(repos);

      try {
        for (const repo of allRepos) {
          ui.status('git-rm-branch', `De-branching '${repo}'…`);

          const deleteResult = await git.deleteBranch(repo, branch);
          if (deleteResult.failed || deleteResult.skipped) {
            reportResult(deleteResult);
            continue;
          }

          reportResult(await git.push(repo, ['origin', `:${branch}`]));
        }
      } catch (error) {
        ui.fail(error);
      } finally {
        ui.statusDone('git-rm-branch');
      }
    });
}
