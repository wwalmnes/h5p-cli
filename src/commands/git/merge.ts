import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { processRepos } from '../../repos/process-repos.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function mergeCommand(): Command {
  return new Command('merge')
    .description('Merge in branch')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action(async (branch: string, libraries: string[]) => {
      if (!branch) {
        ui.warn('No branch today.');
        return;
      }

      try {
        const repos = libraries.length ? libraries : ['*'];
        reportResults(await processRepos(repos, repo => git.merge(repo, branch)));
      } catch (error) {
        ui.fail(error);
      }
    });
}
