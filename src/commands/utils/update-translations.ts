import { Command } from 'commander';
import { updateTranslations } from '../../translations/translations.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function updateTranslationsCommand(): Command {
  return new Command('update-translations')
    .description('Update all translations')
    .argument('<libraries...>', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0')
    .addHelpText('after', `
Examples:
  $ h5p utils update-translations h5p-accordion`)
    .action(async (libraries: string[]) => {
      try {
        const results = await updateTranslations(libraries);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
