import { Command } from 'commander';
import h5p from '../../utils/h5p';

export function checkoutCommand(): Command {
  return new Command('checkout')
    .description('Change branch')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action((branch: string, libraries: string[]) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };

      if (!branch) {
        process.stdout.write('No branch today.' + lf);
        return;
      }

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

      h5p.checkoutAll(branch, libraries, results);
    });
}
