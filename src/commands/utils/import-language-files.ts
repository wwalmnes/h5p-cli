import { Command } from 'commander';
import { importLanguageFiles } from '../../translations/translations.ts';
import { reportResults } from '../../repos/repo-report.ts';
import { ui } from '../../ui/ui.ts';

export function importLanguageFilesCommand(): Command {
  return new Command('import-language-files')
    .description('Get files from dir')
    .argument('<dir>', 'Source directory')
    .action(async (dir: string) => {
      try {
        const results = await importLanguageFiles(dir, ['*']);
        reportResults(results);
      } catch (error) {
        ui.fail(error);
      }
    });
}
