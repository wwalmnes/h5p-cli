import { Command } from 'commander';

export function getCommand(): Command {
  return new Command('get')
    .description('Clone library and all dependencies')
    .argument('[libraries...]', 'Library names')
    .option('--https', 'Use https:// urls for git repos instead of ssh urls')
    .action((libraries: string[], options: { https?: boolean }) => {
      const h5p = require('../../../assets/utils/h5p.js') as any;
      const color = {
        default: '\x1B[0m',
        emphasize: '\x1B[1m',
        green: '\x1B[32m',
        red: '\x1B[31m',
        yellow: '\x1B[33m',
      };
      const lf = '\u000A';
      const fetchWithHttps = options.https ?? false;

      if (!libraries.length) {
        process.stdout.write('No library specified.' + lf);
        return;
      }

      // Clone helper
      function doClone(fetchWithHttps: boolean) {
        const noCr = process.platform === 'win32';
        const name = h5p.clone(fetchWithHttps, function (error: any) {
          let result: string;
          if (error === -1) result = color.yellow + 'SKIPPED' + color.default + lf;
          else if (error) result = color.red + 'FAILED' + color.default + lf + error;
          else result = color.green + 'OK' + color.default + lf;
          cloneSpinner.stop(result);
          doClone(fetchWithHttps);
        });
        if (!name) return;
        const msg = 'Cloning into \'' + color.emphasize + name + color.default + '\'...';
        let cloneSpinner: any;
        if (noCr) {
          process.stdout.write(msg);
          const interval = setInterval(() => process.stdout.write('.'), 500);
          cloneSpinner = { stop: (r: string) => { clearInterval(interval); process.stdout.write(' ' + r); } };
        } else {
          const parts = ['/', '-', '\\', '|'];
          let curPos = 0;
          const interval = setInterval(() => {
            process.stdout.write('\r' + msg + ' ' + color.emphasize + parts[curPos++] + color.default);
            if (curPos === parts.length) curPos = 0;
          }, 100);
          cloneSpinner = { stop: (r: string) => { clearInterval(interval); process.stdout.write('\r' + msg + ' ' + r); } };
        }
      }

      const prefix = 'Looking up dependencies...';
      const noCr = process.platform === 'win32';
      let spinner: any;
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

      h5p.get(libraries, function (error: any) {
        const result = error ? color.red + 'ERROR: ' + color.default + error : color.green + 'DONE' + color.default;
        spinner.stop(result + lf);
        doClone(fetchWithHttps);
      });
    });
}
