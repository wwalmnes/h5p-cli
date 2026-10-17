import { Command } from 'commander';
import { changesSinceRelease } from '../../versioning/versioning.ts';
import { printVersionResults } from './versioning-output.ts';
import { ui } from '../../ui/ui.ts';

export function changesSinceReleaseCommand(): Command {
  return new Command('changes-since-release')
    .description('Show changed files since last release')
    .argument('[libraries...]', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (default: all)')
    .addHelpText('after', `
Examples:
  $ h5p utils changes-since-release h5p-accordion`)
    .action(async (libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await changesSinceRelease(repos);
        printVersionResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
