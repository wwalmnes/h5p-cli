import { Command } from 'commander';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { processRepos } from '../../lib/process-repos.ts';

export function checkoutCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('checkout')
    .description('Change branch')
    .argument('<branch>', 'Branch name')
    .argument('[libraries...]', 'Library names')
    .action(async (branch: string, libraries: string[]) => {
      const lf = '\u000A';
      const color = { default: '\x1B[0m', emphasize: '\x1B[1m', green: '\x1B[32m', yellow: '\x1B[33m', red: '\x1B[31m' };

      if (!branch) {
        process.stdout.write('No branch today.' + lf);
        return;
      }

      try {
        const repos = libraries.length ? libraries : ['*'];
        const results = await processRepos(repos, repo => git.checkout(repo, branch));
        for (const repo of results) {
          process.stdout.write(color.emphasize + repo.name + color.default);
          if ('failed' in repo && repo.failed) process.stdout.write(' ' + color.red + 'FAILED' + color.default);
          else if (repo.skipped) process.stdout.write(' ' + color.yellow + 'SKIPPED' + color.default);
          else process.stdout.write(' ' + color.green + 'OK' + color.default);
          if ('msg' in repo && repo.msg) process.stdout.write(' ' + repo.msg);
          process.stdout.write(lf);
        }
      } catch (error: any) {
        process.stdout.write(error.message + lf);
      }
    });
}
