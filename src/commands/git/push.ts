import { Command } from 'commander';
import * as git from '../../logic/git.ts';
import { processRepos, type RepoResult } from '../../lib/process-repos.ts';
import { reportResults } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';
import type { GitOpResult } from '../../logic/git.ts';

export function pushCommand(): Command {
  return new Command('push')
    .description('Push the given or all repos')
    .argument('[libraries...]', 'Library names')
    .option('--tags', 'Push tags')
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
