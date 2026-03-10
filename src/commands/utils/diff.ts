import { Command } from 'commander';

export function diffCommand(): Command {
  return new Command('diff')
    .description('Prints combined diff for all repos')
    .action(() => {
      const h5p = require('../../../assets/utils/h5p.js') as any;
      const color = { default: '\x1B[0m', red: '\x1B[31m' };
      const lf = '\u000A';
      h5p.diff(function (error: any, diff: string) {
        if (error) return process.stdout.write(color.red + 'ERROR!' + color.default + lf + error);
        process.stdout.write(diff);
      });
    });
}
