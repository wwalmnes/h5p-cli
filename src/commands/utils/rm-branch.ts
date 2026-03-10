import { Command } from 'commander';

export function rmBranchCommand(): Command {
  return new Command('rm-branch')
    .description('Removes branch (local and remote)')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action((branch: string, libraries: string[]) => {
      const h5p = require('../../../assets/utils/h5p.js') as any;
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };
      const noCr = process.platform === 'win32';

      if (!branch || branch.substr(0, 4) === 'h5p-' || branch === 'master') {
        process.stdout.write('I would think twice about doing that!' + lf);
        return;
      }

      function makeProgress(action: string) {
        let spinner: any;
        return function (status: any, nextRepo: string) {
          if (status) {
            if (status.failed) spinner.stop(color.red + 'FAILED' + color.default + lf + status.msg);
            else if (status.skipped) spinner.stop(color.yellow + 'SKIPPED' + color.default + lf);
            else spinner.stop(color.green + 'OK' + color.default + (status.msg === undefined ? '' : ' ' + status.msg) + lf);
          }
          if (nextRepo) {
            const prefix = action + ' \'' + color.emphasize + nextRepo + color.default + '\'...';
            if (noCr) {
              process.stdout.write(prefix);
              const interval = setInterval(() => process.stdout.write('.'), 500);
              spinner = { stop: (r: string) => { clearInterval(interval); process.stdout.write(' ' + r); } };
            } else {
              const parts = ['/', '-', '\\', '|'];
              let curPos = 0;
              const interval = setInterval(() => {
                process.stdout.write('\r' + prefix + ' ' + color.emphasize + parts[curPos++] + color.default);
                if (curPos === parts.length) curPos = 0;
              }, 100);
              spinner = { stop: (r: string) => { clearInterval(interval); process.stdout.write('\r' + prefix + ' ' + r); } };
            }
          }
        };
      }

      h5p.rmBranch(branch, libraries, makeProgress('De-branching'));
    });
}
