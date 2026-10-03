import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { processRepos } from '../../repos/process-repos.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function tagCommand(): Command {
  return new Command('tag')
    .description('Create a tag')
    .argument('<tagName>', 'Tag name')
    .argument('[libraries...]', 'Library names')
    .action(async (tagName: string, libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        reportResults(await processRepos(repos, repo => git.tag(repo, tagName)));
      } catch (error) {
        ui.fail(error);
      }
    });
}
