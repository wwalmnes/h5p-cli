import { Command } from 'commander';
import { GitAdapter, IGitAdapter, GitOpResult } from '../../adapters/git-adapter';
import { resolveRepos } from '../../lib/process-repos';

export function rmBranchCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('rm-branch')
    .description('Removes branch (local and remote)')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action(async (branch: string, libraries: string[]) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };
      const noCr = process.platform === 'win32';

      if (!branch || branch.startsWith('h5p-') || branch === 'master') {
        process.stdout.write('I would think twice about doing that!' + lf);
        return;
      }

      let spinner: any;

      function makeSpinner(prefix: string) {
        if (noCr) {
          process.stdout.write(prefix);
          const interval = setInterval(() => process.stdout.write('.'), 500);
          return { stop: (r: string) => { clearInterval(interval); process.stdout.write(' ' + r); } };
        }
        const parts = ['/', '-', '\\', '|'];
        let curPos = 0;
        const interval = setInterval(() => {
          process.stdout.write('\r' + prefix + ' ' + color.emphasize + parts[curPos++] + color.default);
          if (curPos === parts.length) curPos = 0;
        }, 100);
        return { stop: (r: string) => { clearInterval(interval); process.stdout.write('\r' + prefix + ' ' + r); } };
      }

      const repos = libraries.length ? libraries : ['*'];
      const allRepos = await resolveRepos(repos);
      let prev: GitOpResult | undefined;

      const onProgress = (status?: GitOpResult, nextRepo?: string) => {
        if (status) {
          if (status.failed) spinner.stop(color.red + 'FAILED' + color.default + lf + (status.msg ?? ''));
          else if (status.skipped) spinner.stop(color.yellow + 'SKIPPED' + color.default + lf);
          else spinner.stop(color.green + 'OK' + color.default + (status.msg !== undefined ? ' ' + status.msg : '') + lf);
        }
        if (nextRepo) {
          const prefix = 'De-branching \'' + color.emphasize + nextRepo + color.default + '\'...';
          spinner = makeSpinner(prefix);
        }
      };

      for (const repo of allRepos) {
        onProgress(prev, repo);
        const deleteResult = await git.deleteBranch(repo, branch);
        if (deleteResult.failed || deleteResult.skipped) { prev = deleteResult; continue; }
        const pushResult = await git.push(repo, ['origin', `:${branch}`]);
        prev = pushResult;
      }
      onProgress(prev);
    });
}
