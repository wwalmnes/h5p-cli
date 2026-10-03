import { Command } from 'commander';
import { compareTagsWithRelease } from '../../versioning/versioning.ts';
import { printVersionResults } from './versioning-output.ts';

export function compareTagsWithReleaseCommand(): Command {
  return new Command('compare-tags-with-release')
    .description('Compare tag of release and master branch')
    .argument('[libraries...]', 'Library names')
    .action(async (libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await compareTagsWithRelease(repos);
        printVersionResults(results);
      } catch (error: any) {
        process.stdout.write(error.message + '\u000A');
      }
    });
}
