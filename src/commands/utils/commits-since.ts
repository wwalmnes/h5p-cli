import { Command } from 'commander';
import { VersioningService } from '../../services/versioning-service';
import { VersioningAdapter } from '../../adapters/versioning-adapter';
import { printVersionResults } from './versioning-output';

export function commitsSinceCommand(service?: VersioningService): Command {
  const svc = service ?? new VersioningService(new VersioningAdapter());
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
        const results = await svc.commitsSince(repos, versions);
        printVersionResults(results);
      } catch (error: any) {
        process.stdout.write(error.message + '\u000A');
      }
    });
}
