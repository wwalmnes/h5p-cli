import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import type { GitOpResult } from '../../repos/git.ts';
import { processRepos, type RepoResult } from '../../repos/process-repos.ts';
import { reportResults, reportSummary, sortByNameDescending } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function pullCommand(): Command {
  return new Command('pull')
    .description('Pull the given or all repos')
    .argument('[libraries...]', 'Library names')
    .action(async (libraries: string[]) => {
      const repos = libraries.length ? libraries : ['*'];
      const repoCount = libraries.length ? libraries.length : 'all';
      const repoLabel = libraries.length === 1 ? 'repository' : 'repositories';

      let results: RepoResult<GitOpResult>[];
      ui.status('git-pull', `Pulling ${repoCount} ${repoLabel}`);
      try {
        results = await processRepos(repos, repo => git.pull(repo));
      } catch (error) {
        ui.fail(error);
        return;
      } finally {
        ui.statusDone('git-pull');
      }

      ui.success('Finished pulling repositories');
      const sorted = sortByNameDescending(results);
      reportResults(sorted);
      reportSummary(sorted);
    });
}
