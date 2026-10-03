import { Command } from 'commander';
import { updateTranslations } from '../../translations/translations.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function updateTranslationsCommand(): Command {
  return new Command('update-translations')
    .description('Update all translations')
    .argument('<libraries...>', 'Library names')
    .action(async (libraries: string[]) => {
      try {
        const results = await updateTranslations(libraries);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
