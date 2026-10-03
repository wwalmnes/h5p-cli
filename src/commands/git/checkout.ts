import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { processRepos } from '../../repos/process-repos.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function checkoutCommand(): Command {
  return new Command('checkout')
    .description('Change branch')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action(async (branch: string, libraries: string[]) => {
      if (!branch) {
        ui.warn('No branch today.');
        return;
      }

      try {
        const repos = libraries.length ? libraries : ['*'];
        reportResults(await processRepos(repos, repo => git.checkout(repo, branch)));
      } catch (error) {
        ui.fail(error);
      }
    });
}
