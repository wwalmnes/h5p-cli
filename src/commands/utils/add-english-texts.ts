import { Command } from 'commander';
import { addEnglishTexts } from '../../translations/translations.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function addEnglishTextsCommand(): Command {
  return new Command('add-english-texts')
    .description('Update translations - add english text strings to a given translation')
    .argument('<languageCode>', 'Language code')
    .argument('<libraries...>', 'Library folders, e.g. h5p-accordion or H5P.Accordion-1.0')
    .option('-P', 'Populate with english texts instead of TODOs')
    .addHelpText('after', `
Examples:
  $ h5p utils add-english-texts nb h5p-accordion`)
    .action(async (languageCode: string, libraries: string[], options: { P?: boolean }) => {
      try {
        const results = await addEnglishTexts(languageCode, libraries, options.P ?? false);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
