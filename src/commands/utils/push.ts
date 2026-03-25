import { Command } from 'commander';
import { GitAdapter, IGitAdapter } from '../../adapters/git-adapter';
import { processRepos } from '../../lib/process-repos';

export function pushCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('push')
    .description('Push the given or all repos')
    .argument('[libraries...]', 'Library names')
    .option('--tags', 'Push tags')
    .action(async (libraries: string[], options: { tags?: boolean }) => {
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m' };
      const lf = '\u000A';
      const noCr = process.platform === 'win32';
      const pushOptions: string[] = options.tags ? ['--tags'] : [];

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

      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await processRepos(repos, repo => git.push(repo, pushOptions));
        spinner.stop('done\n');
        for (const result of results) {
          if ('failed' in result && result.failed) {
            process.stdout.write(color.emphasize + result.name + color.default + ' FAILED' + lf);
            if (result.msg) process.stdout.write(result.msg + lf);
          } else if (!('skipped' in result && result.skipped)) {
            process.stdout.write(color.emphasize + result.name + color.default + (result.msg ? ' ' + result.msg : '') + lf);
          }
        }
      } catch (error: any) {
        spinner.stop(error.message);
      }
    });
}
