import { Command } from 'commander';
import { TranslationService } from '../../services/translation-service';
import { TranslationAdapter } from '../../adapters/translation-adapter';

export function addEnglishTextsCommand(service?: TranslationService): Command {
  const svc = service ?? new TranslationService(new TranslationAdapter());
  return new Command('add-english-texts')
    .description('Update translations - add english text strings to a given translation')
    .argument('<languageCode>', 'Language code')
    .argument('<libraries...>', 'Library names')
    .option('-P', 'Populate with english texts instead of TODOs')
    .action(async (languageCode: string, libraries: string[], options: { P?: boolean }) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };
      try {
        const results = await svc.addEnglishTexts(languageCode, libraries, options.P ?? false);
        for (const repo of results) {
          process.stdout.write(color.emphasize + repo.name + color.default);
          if ('failed' in repo && repo.failed) process.stdout.write(' ' + color.red + 'FAILED' + color.default);
          else if (repo.skipped) process.stdout.write(' ' + color.yellow + 'SKIPPED' + color.default);
          else process.stdout.write(' ' + color.green + 'OK' + color.default);
          if ('msg' in repo && repo.msg) process.stdout.write(' ' + repo.msg);
          process.stdout.write(lf);
        }
      } catch (error: any) {
        process.stdout.write(error.message + lf);
      }
    });
}
