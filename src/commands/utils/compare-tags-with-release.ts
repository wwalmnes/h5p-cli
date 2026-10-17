import { Command } from 'commander';
import { compareTagsWithRelease } from '../../versioning/versioning.ts';
import { printVersionResults } from './versioning-output.ts';
import { ui } from '../../ui/ui.ts';

export function compareTagsWithReleaseCommand(): Command {
  return new Command('compare-tags-with-release')
    .description('Compare tag of release and master branch')
    .argument('[libraries...]', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (default: all)')
    .addHelpText('after', `
Examples:
  $ h5p utils compare-tags-with-release h5p-accordion`)
    .action(async (libraries: string[]) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await compareTagsWithRelease(repos);
        printVersionResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
