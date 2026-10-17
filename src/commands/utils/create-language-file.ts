import { Command } from 'commander';
import { createLanguageFile } from '../../translations/translations.ts';
import { reportResult } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function createLanguageFileCommand(): Command {
  return new Command('create-language-file')
    .description('Creates language file')
    .argument('<library>', 'Library folder, e.g. h5p-accordion or H5P.Accordion-1.0')
    .argument('<languageCode>', 'Language code')
    .addHelpText('after', `
Examples:
  $ h5p utils create-language-file h5p-accordion nb`)
    .action(async (library: string, languageCode: string) => {
      try {
        reportResult(await createLanguageFile(library, languageCode));
      } catch (error) {
        ui.fail(error);
      }
    });
}
