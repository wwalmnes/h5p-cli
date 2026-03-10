import { Command } from 'commander';
import h5p from '../../../assets/utils/h5p';

export function pushCommand(): Command {
  return new Command('push')
    .description('Push the given or all repos')
    .argument('[libraries...]', 'Library names')
    .option('--tags', 'Push tags')
    .action((libraries: string[], options: { tags?: boolean }) => {
      const color = {
        default: '\x1B[0m',
        emphasize: '\x1B[1m',
        green: '\x1B[32m',
        red: '\x1B[31m',
      };
      const lf = '\u000A';
      const noCr = process.platform === 'win32';

      const pushOptions: string[] = options.tags ? ['--tags'] : [];

      function doPush(opts: string[]) {
        const prefix = 'Pushing \'all repos\'...';
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
        h5p.pushAll(opts).then((result: any[]) => {
          spinner.stop('done\n');
          for (let i = 0; i < result.length; i++) {
            console.log(result[i].status);
            console.log(result[i].reason);
          }
        }).catch((error: any) => {
          spinner.stop(error.toString());
        });
      }

      h5p.update(libraries, (error: any) => {
        if (error) return process.stdout.write(error + lf);
        doPush(pushOptions);
      });
    });
}
