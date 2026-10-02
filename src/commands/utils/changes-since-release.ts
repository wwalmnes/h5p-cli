import { Command } from 'commander';
import { changesSinceRelease } from '../../logic/versioning.ts';
import { printVersionResults } from './versioning-output.ts';

export function changesSinceReleaseCommand(): Command {
  return new Command('changes-since-release')
    .description('Show changed files since last release')
    .argument('[libraries...]', 'Library names')
    .action(async (libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await changesSinceRelease(repos);
        printVersionResults(results);
      } catch (error: any) {
        process.stdout.write(error.message + '\u000A');
      }
    });
}
