import { Command } from 'commander';
import { increasePatchVersion } from '../../versioning/versioning.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function increasePatchVersionCommand(): Command {
  return new Command('increase-patch-version')
    .description('Increases the patch version')
    .argument('[libraries...]', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0 (default: all)')
    .option('-f', 'Force increase even if no new changes')
    .addHelpText('after', `
Examples:
  $ h5p utils increase-patch-version h5p-accordion`)
    .action(async (libraries: string[], options: { f?: boolean }) => {
      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await increasePatchVersion(repos, !!options.f);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
