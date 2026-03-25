import { Command } from 'commander';
import { TranslationService } from '../../services/translation-service';
import { TranslationAdapter } from '../../adapters/translation-adapter';

export function copyTranslationCommand(service?: TranslationService): Command {
  const svc = service ?? new TranslationService(new TranslationAdapter());
  return new Command('copy-translation')
    .description('Use one language to create another')
    .argument('<from>', 'Source language code')
    .argument('<to>', 'Target language code')
    .argument('<libraries...>', 'Library names')
    .action(async (from: string, to: string, libraries: string[]) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };
      try {
        const results = await svc.copyTranslation(from, to, libraries);
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
