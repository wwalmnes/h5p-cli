import { Command } from 'commander';
import { LibraryInstallService } from '../../services/library-install-service';
import { LibraryInstallAdapter } from '../../adapters/library-install-adapter';

export function getCommand(service?: LibraryInstallService): Command {
  const svc = service ?? new LibraryInstallService(new LibraryInstallAdapter());
  return new Command('get')
    .description('Clone library and all dependencies')
    .argument('[libraries...]', 'Library names')
    .option('--https', 'Use https:// urls for git repos instead of ssh urls')
    .action(async (libraries: string[], options: { https?: boolean }) => {
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

      const noCr = process.platform === 'win32';

      function makeSpinner(msg: string): { stop: (r: string) => void } {
        if (noCr) {
          process.stdout.write(msg);
          const interval = setInterval(() => process.stdout.write('.'), 500);
          return { stop: (r: string) => { clearInterval(interval); process.stdout.write(' ' + r); } };
        }
        const parts = ['/', '-', '\\', '|'];
        let curPos = 0;
        const interval = setInterval(() => {
          process.stdout.write('\r' + msg + ' ' + color.emphasize + parts[curPos++] + color.default);
          if (curPos === parts.length) curPos = 0;
        }, 100);
        return { stop: (r: string) => { clearInterval(interval); process.stdout.write('\r' + msg + ' ' + r); } };
      }

      const lookupSpinner = makeSpinner('Looking up dependencies...');

      let collection: Map<string, { repository: string }>;
      try {
        collection = await svc.resolveCollection(libraries);
        lookupSpinner.stop(color.green + 'DONE' + color.default + lf);
      } catch (error: any) {
        lookupSpinner.stop(color.red + 'ERROR: ' + color.default + error.message + lf);
        return;
      }

      for (const [name, entry] of collection) {
        const msg = 'Cloning into \'' + color.emphasize + name + color.default + '\'...';
        const cloneSpinner = makeSpinner(msg);
        const { status, error } = await svc.cloneLibrary(name, entry.repository, fetchWithHttps);
        if (status === 'skipped') {
          cloneSpinner.stop(color.yellow + 'SKIPPED' + color.default + lf);
        } else if (status === 'failed') {
          cloneSpinner.stop(color.red + 'FAILED' + color.default + lf + (error ?? ''));
        } else {
          cloneSpinner.stop(color.green + 'OK' + color.default + lf);
        }
      }
    });
}
