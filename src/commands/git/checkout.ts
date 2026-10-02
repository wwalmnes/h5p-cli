import { Command } from 'commander';
import * as git from '../../logic/git.ts';
import { processRepos } from '../../lib/process-repos.ts';
import { reportResults } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

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
