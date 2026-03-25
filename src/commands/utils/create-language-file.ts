import { Command } from 'commander';
import { TranslationService } from '../../services/translation-service';
import { TranslationAdapter } from '../../adapters/translation-adapter';

export function createLanguageFileCommand(service?: TranslationService): Command {
  const svc = service ?? new TranslationService(new TranslationAdapter());
  return new Command('create-language-file')
    .description('Creates language file')
    .argument('<library>', 'Library name')
    .argument('<languageCode>', 'Language code')
    .action(async (library: string, languageCode: string) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };
      try {
        const result = await svc.createLanguageFile(library, languageCode);
        process.stdout.write(color.emphasize + result.name + color.default);
        if (result.failed) process.stdout.write(' ' + color.red + 'FAILED' + color.default);
        else process.stdout.write(' ' + color.green + 'OK' + color.default);
        if (result.msg) process.stdout.write(' ' + result.msg);
        process.stdout.write(lf);
      } catch (error: any) {
        process.stdout.write(error.message + lf);
      }
    });
}
