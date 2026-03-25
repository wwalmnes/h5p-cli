import { Command } from 'commander';
import { GitAdapter, IGitAdapter } from '../../adapters/git-adapter';
import { findRepos } from '../../lib/process-repos';

export function diffCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('diff')
    .description('Prints combined diff for all repos')
    .action(async () => {
      const color = { default: '\x1B[0m', red: '\x1B[31m' };
      const lf = '\u000A';
      try {
        const repos = await findRepos();
        const diffs = await Promise.all(repos.map(repo => git.diff(repo)));
        process.stdout.write(diffs.join(''));
      } catch (error: any) {
        process.stdout.write(color.red + 'ERROR!' + color.default + lf + error.message);
      }
    });
}
