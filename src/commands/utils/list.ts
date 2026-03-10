import { Command } from 'commander';

export function utilsListCommand(): Command {
  return new Command('list')
    .description('List all H5P libraries')
    .action(() => {
      const h5p = require('../../../assets/utils/h5p.js') as any;
      const color = {
        default: '\x1B[0m',
        emphasize: '\x1B[1m',
        green: '\x1B[32m',
        red: '\x1B[31m',
      };
      const lf = '\u000A';
      const noCr = process.platform === 'win32';

      let spinner: any;
      const prefix = 'Getting library list...';
      if (noCr) {
        process.stdout.write(prefix);
        const interval = setInterval(() => process.stdout.write('.'), 500);
        spinner = {
          stop: (result: string) => { clearInterval(interval); process.stdout.write(' ' + result); }
        };
      } else {
        const parts = ['/', '-', '\\', '|'];
        let curPos = 0;
        const interval = setInterval(() => {
          process.stdout.write('\r' + prefix + ' ' + color.emphasize + parts[curPos++] + color.default);
          if (curPos === parts.length) curPos = 0;
        }, 100);
        spinner = {
          stop: (result: string) => { clearInterval(interval); process.stdout.write('\r' + prefix + ' ' + result); }
        };
      }

      h5p.list(function (error: any, libraries: any) {
        const result = error
          ? color.red + 'ERROR: ' + color.default + error
          : color.green + 'DONE' + color.default;
        spinner.stop(result + lf);
        for (const name in libraries) {
          process.stdout.write('  ' + color.emphasize + name + color.default + lf);
        }
      });
    });
}
