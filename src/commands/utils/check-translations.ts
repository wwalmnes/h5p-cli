import { Command } from 'commander';
import checkTranslations from '../../utils/commands/check-translations.ts';

export function checkTranslationsCommand(): Command {
  return new Command('check-translations')
    .description('Check that translations match nb language')
    .argument('[language]', 'Language code')
    .argument('[library]', 'Library name')
    .option('-d, --diff', 'Show differences between translations')
    .action(async (language: string | undefined, library: string | undefined, options: { diff?: boolean }) => {
      const inputList: string[] = [];
      if (options.diff) inputList.push('-diff');
      if (language) inputList.push(language);
      if (library) inputList.push(library);
      try {
        await checkTranslations(...inputList);
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
    });
}
