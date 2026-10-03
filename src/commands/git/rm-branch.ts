import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { resolveRepos } from '../../repos/process-repos.ts';
import { reportResult } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function rmBranchCommand(): Command {
  return new Command('rm-branch')
    .description('Removes branch (local and remote)')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (default: all)')
    .addHelpText('after', `
Examples:
  $ h5p git rm-branch feat/example h5p-accordion`)
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
