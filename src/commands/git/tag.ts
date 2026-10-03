import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { processRepos } from '../../repos/process-repos.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function tagCommand(): Command {
  return new Command('tag')
    .description('Create a tag')
    .argument('<tagName>', 'Tag name')
    .argument('[libraries...]', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (default: all)')
    .addHelpText('after', `
Examples:
  $ h5p git tag 1.0.5 h5p-accordion`)
    .action(async (tagName: string, libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        reportResults(await processRepos(repos, repo => git.tag(repo, tagName)));
      } catch (error) {
        ui.fail(error);
      }
    });
}
