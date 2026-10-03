import { Command } from 'commander';
import { commitsSince } from '../../versioning/versioning.ts';
import { printVersionResults } from './versioning-output.ts';

export function commitsSinceCommand(): Command {
  return new Command('commits-since')
    .description('Show commits since last version')
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
        const results = await commitsSince(repos, versions);
        printVersionResults(results);
      } catch (error: any) {
        process.stdout.write(error.message + '\u000A');
      }
    });
}
