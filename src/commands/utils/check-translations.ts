import { Command } from 'commander';

export function checkTranslationsCommand(): Command {
  return new Command('check-translations')
    .description('Check that translations match nb language')
    .argument('[language]', 'Language code')
    .argument('[library]', 'Library name')
    .option('-diff', 'Show differences between translations')
    .action(async (language: string | undefined, library: string | undefined, options: { diff?: boolean }) => {
      const checkTranslations = require('../../../assets/utils/commands/check-translations.js') as any;
      const inputList: string[] = [];
      if (options.diff) inputList.push('-diff');
      if (language) inputList.push(language);
      if (library) inputList.push(library);
      try {
        await checkTranslations.apply(null, inputList);
        process.exit(0);
      } catch (error) {
        process.exit(1);
      }
    });
}
