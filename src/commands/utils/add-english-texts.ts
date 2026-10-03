import { Command } from 'commander';
import { addEnglishTexts } from '../../translations/translations.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function addEnglishTextsCommand(): Command {
  return new Command('add-english-texts')
    .description('Update translations - add english text strings to a given translation')
    .argument('<languageCode>', 'Language code')
    .argument('<libraries...>', 'Library names')
    .option('-P', 'Populate with english texts instead of TODOs')
    .action(async (languageCode: string, libraries: string[], options: { P?: boolean }) => {
      try {
        const results = await addEnglishTexts(languageCode, libraries, options.P ?? false);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
