import { Command } from 'commander';
import h5p from '../../../assets/utils/h5p';

export function increasePatchVersionCommand(): Command {
  return new Command('increase-patch-version')
    .description('Increases the patch version')
    .argument('[libraries...]', 'Library names')
    .option('-f', 'Force increase even if no new changes')
    .action((libraries: string[], options: { f?: boolean }) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };

      function results(error: any, repos: any[]) {
        if (error) return process.stdout.write(error + lf);
        for (let i = 0; i < repos.length; i++) {
          const repo = repos[i];
          process.stdout.write(color.emphasize + repo.name + color.default);
          if (repo.failed) process.stdout.write(' ' + color.red + 'FAILED' + color.default);
          else if (repo.skipped) process.stdout.write(' ' + color.yellow + 'SKIPPED' + color.default);
          else process.stdout.write(' ' + color.green + 'OK' + color.default);
          if (repo.msg) process.stdout.write(' ' + repo.msg);
          process.stdout.write(lf);
        }
      }

      h5p.increasePatchVersion(options.f, libraries, results);
    });
}
