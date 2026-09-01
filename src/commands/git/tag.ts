import { Command } from 'commander';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { processRepos } from '../../lib/process-repos.ts';
import { reportResults } from '../../lib/repo-report.ts';
import { ui } from '../../lib/ui.ts';

export function tagCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('tag')
    .description('Create a tag')
    .argument('<tagName>', 'Tag name')
    .argument('[libraries...]', 'Library names')
    .action(async (tagName: string, libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        reportResults(await processRepos(repos, repo => git.tag(repo, tagName)));
      } catch (error) {
        ui.error(error);
      }
    });
}
