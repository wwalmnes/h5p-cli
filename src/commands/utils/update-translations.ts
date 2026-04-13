import { Command } from 'commander';
import { TranslationService } from '../../services/translation-service.ts';
import { TranslationAdapter } from '../../adapters/translation-adapter.ts';

export function updateTranslationsCommand(service?: TranslationService): Command {
  const svc = service ?? new TranslationService(new TranslationAdapter());
  return new Command('update-translations')
    .description('Update all translations')
    .argument('<libraries...>', 'Library names')
    .action(async (libraries: string[]) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };
      try {
        const results = await svc.updateTranslations(libraries);
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
