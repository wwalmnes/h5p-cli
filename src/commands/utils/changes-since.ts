import { Command } from 'commander';
import { changesSince } from '../../versioning/versioning.ts';
import { printVersionResults } from './versioning-output.ts';
import { ui } from '../../ui/ui.ts';

export function changesSinceCommand(): Command {
  return new Command('changes-since')
    .description('Show changed files since last version')
    .argument('[numVersions]', 'Number of versions (default 1)')
    .argument('[libraries...]', 'Library names')
    .action(async (numVersions: string | undefined, libraries: string[]) => {
      let versions = 1;
      if (numVersions && numVersions.match(/^-?\d+$/i)) {
        versions = Math.abs(parseInt(numVersions));
      } else if (numVersions) {
        libraries = [numVersions, ...libraries];
      }

      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await changesSince(repos, versions);
        printVersionResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
