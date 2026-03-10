import { Command } from 'commander';

export function listDepsCommand(): Command {
  return new Command('list-deps')
    .description('List all libraries that have a dependency to the given library')
    .argument('<libraries...>', 'Library names')
    .action((libraries: string[]) => {
      const h5p = require('../../../assets/utils/h5p.js') as any;
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

      h5p.recursiveMinorBump(libraries, results, true);
    });
}
