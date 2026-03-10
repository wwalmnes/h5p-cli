import { Command } from 'commander';
import h5p from '../../../assets/utils/h5p';

export function diffCommand(): Command {
  return new Command('diff')
    .description('Prints combined diff for all repos')
    .action(() => {
      const color = { default: '\x1B[0m', red: '\x1B[31m' };
      const lf = '\u000A';
      h5p.diff(function (error: any, diff: string) {
        if (error) return process.stdout.write(color.red + 'ERROR!' + color.default + lf + error);
        process.stdout.write(diff);
      });
    });
}
