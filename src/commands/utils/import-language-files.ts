import { Command } from 'commander';
import { importLanguageFiles } from '../../translations/translations.ts';

export function importLanguageFilesCommand(): Command {
  return new Command('import-language-files')
    .description('Get files from dir')
    .argument('<dir>', 'Source directory')
    .action(async (dir: string) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };
      try {
        const results = await importLanguageFiles(dir, ['*']);
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
