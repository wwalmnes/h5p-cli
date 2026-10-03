import { Command } from 'commander';
import { createLanguageFile } from '../../translations/translations.ts';
import { reportResult } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function createLanguageFileCommand(): Command {
  return new Command('create-language-file')
    .description('Creates language file')
    .argument('<library>', 'Library name')
    .argument('<languageCode>', 'Language code')
    .action(async (library: string, languageCode: string) => {
      try {
        reportResult(await createLanguageFile(library, languageCode));
      } catch (error) {
        ui.fail(error);
      }
    });
}
