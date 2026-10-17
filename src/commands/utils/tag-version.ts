import { Command } from 'commander';
import * as git from '../../repos/git.ts';
import { processRepos } from '../../repos/process-repos.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function tagVersionCommand(): Command {
  return new Command('tag-version')
    .description('Create tag from current version number')
    .argument('[libraries...]', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (default: all)')
    .addHelpText('after', `
Examples:
  $ h5p utils tag-version h5p-accordion`)
    .action(async (libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await processRepos(repos, repo => git.tagVersion(repo));
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
