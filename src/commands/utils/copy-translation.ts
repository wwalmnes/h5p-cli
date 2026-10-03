import { Command } from 'commander';
import { copyTranslation } from '../../translations/translations.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function copyTranslationCommand(): Command {
  return new Command('copy-translation')
    .description('Use one language to create another')
    .argument('<from>', 'Source language code')
    .argument('<to>', 'Target language code')
    .argument('<libraries...>', 'Library names')
    .action(async (from: string, to: string, libraries: string[]) => {
      try {
        const results = await copyTranslation(from, to, libraries);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
