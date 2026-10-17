import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { processRepos, type RepoResult } from '../../repos/process-repos.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';
import type { GitOpResult } from '../../repos/git.ts';

export function pushCommand(): Command {
  return new Command('push')
    .description('Push the given or all repos')
    .argument('[libraries...]', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (default: all)')
    .option('--tags', 'Push tags')
    .addHelpText('after', `
Examples:
  $ h5p git push h5p-accordion
  $ h5p git push --tags h5p-accordion`)
    .action(async (libraries: string[], options: { tags?: boolean }) => {
      const pushOptions: string[] = options.tags ? ['--tags'] : [];
      const repos = libraries.length ? libraries : ['*'];

      let results: RepoResult<GitOpResult>[];
      ui.status('git-push', `Pushing ${libraries.length || 'all'} repos…`);
      try {
        results = await processRepos(repos, repo => git.push(repo, pushOptions));
      } catch (error) {
        ui.fail(error);
        return;
      } finally {
        // Retire the transient row before any permanent line is committed.
        ui.statusDone('git-push');
      }

      // A skipped repo is not interesting on push; it was never touched.
      reportResults(results.filter(result => !result.skipped));
    });
}
