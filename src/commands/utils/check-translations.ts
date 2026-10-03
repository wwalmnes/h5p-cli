import { Command } from 'commander';
import checkTranslations from '../../translations/check-translations.ts';
import { splitLibrariesAndLanguages } from '../../repos/resolve-libraries.ts';
import { findRepos } from '../../repos/process-repos.ts';
import { ui } from '../../ui/ui.ts';

export function checkTranslationsCommand(): Command {
  return new Command('check-translations')
    .description('Check that translations match nb language')
    .argument('[language]', 'Language code')
    .argument('[library]', 'Library name')
    .option('-d, --diff', 'Show differences between translations')
    .action(async (language: string, library: string, options: { diff?: boolean }) => {
      try {
        const { libraries, languages } = splitLibrariesAndLanguages([language, library], await findRepos());

        await checkTranslations(libraries, languages, { diff: options.diff });
      } catch (error) {
        ui.fail(error);
      }
    });
}
