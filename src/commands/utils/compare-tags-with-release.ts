import { Command } from 'commander';
import { VersioningService } from '../../services/versioning-service';
import { VersioningAdapter } from '../../adapters/versioning-adapter';
import { printVersionResults } from './versioning-output';

export function compareTagsWithReleaseCommand(service?: VersioningService): Command {
  const svc = service ?? new VersioningService(new VersioningAdapter());
  return new Command('compare-tags-with-release')
    .description('Compare tag of release and master branch')
    .argument('[libraries...]', 'Library names')
    .action(async (libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await svc.compareTagsWithRelease(repos);
        printVersionResults(results);
      } catch (error: any) {
        process.stdout.write(error.message + '\u000A');
      }
    });
}
