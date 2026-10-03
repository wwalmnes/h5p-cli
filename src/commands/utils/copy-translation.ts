import { Command } from 'commander';
import { copyTranslation } from '../../translations/translations.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function copyTranslationCommand(): Command {
  return new Command('copy-translation')
    .description('Use one language to create another')
    .argument('<from>', 'Source language code')
    .argument('<to>', 'Target language code')
    .argument('<libraries...>', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0')
    .addHelpText('after', `
Examples:
  $ h5p utils copy-translation nb nn h5p-accordion`)
    .action(async (from: string, to: string, libraries: string[]) => {
      try {
        const results = await copyTranslation(from, to, libraries);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
