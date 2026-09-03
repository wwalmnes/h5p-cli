import { Command } from 'commander';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { processRepos } from '../../lib/process-repos.ts';
import { reportResults } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

export function mergeCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
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
