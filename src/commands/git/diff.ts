import { Command } from 'commander';
import { GitAdapter, type IGitAdapter } from '../../adapters/git-adapter.ts';
import { findRepos } from '../../lib/process-repos.ts';
import { ui } from '../../lib/ui.ts';

export function diffCommand(adapter?: IGitAdapter): Command {
  const git = adapter ?? new GitAdapter();
  return new Command('diff')
    .description('Prints combined diff for all repos')
    .action(async () => {
      try {
        const repos = await findRepos();
        const diffs = await Promise.all(repos.map(repo => git.diff(repo)));
        const combined = diffs.join('');
        // The one data channel in `h5p git`: patch text, pipeable and uncolored.
        // ui.data appends the newline, so drop the trailing one the diff carries.
        if (combined) ui.data(combined.replace(/\n$/, ''));
      } catch (error) {
        ui.error(error);
      }
    });
}
